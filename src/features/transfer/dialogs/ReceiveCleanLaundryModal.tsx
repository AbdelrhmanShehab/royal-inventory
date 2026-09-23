import React, { useState, useEffect } from 'react';
import { 
  X, 
  CheckCircle2, 
  AlertCircle, 
  PackageCheck, 
  Info,
  Layers,
  Sparkles
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import Button from '../../../components/ui/Button';
import { laundryApi } from '../../../api/laundry.api';
import type { LaundryTransfer, LaundryReturn } from '../../../types/laundry';

interface ReceiveCleanLaundryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  preselectedTransfer?: LaundryTransfer | null;
  preselectedReturn?: LaundryReturn | null;
  activeTransfers?: LaundryTransfer[];
}

interface ItemRow {
  itemCode: string;
  itemNameAr: string;
  maxAvailableAtLaundry: number;
  receivedCleanQty: number;
  damagedQty: number;
  rejectReason?: string;
  notes?: string;
}

export default function ReceiveCleanLaundryModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedTransfer,
  preselectedReturn,
  activeTransfers = []
}: ReceiveCleanLaundryModalProps) {
  const queryClient = useQueryClient();

  const [selectedTransferId, setSelectedTransferId] = useState<number | ''>('');
  const [items, setItems] = useState<ItemRow[]>([]);
  const [notes, setNotes] = useState('');
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize or load transfer details when opened
  useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null);
      setItems([]);
      setSelectedTransferId('');
      setNotes('');
      return;
    }

    if (preselectedReturn) {
      // Verifying an existing return document
      loadReturnDetails(preselectedReturn.id);
    } else if (preselectedTransfer) {
      // Direct clean return from an active transfer
      setSelectedTransferId(preselectedTransfer.id);
      loadTransferDetails(preselectedTransfer.id);
    } else if (activeTransfers.length > 0) {
      // Default to the first active transfer
      const firstId = activeTransfers[0].id;
      setSelectedTransferId(firstId);
      loadTransferDetails(firstId);
    }
  }, [isOpen, preselectedTransfer, preselectedReturn]);

  const loadReturnDetails = async (returnId: number) => {
    setIsLoadingDetails(true);
    setErrorMessage(null);
    try {
      const returnDoc = await laundryApi.getReturnById(returnId);
      if (returnDoc && returnDoc.items) {
        const rows: ItemRow[] = returnDoc.items.map(item => ({
          itemCode: item.itemCode,
          itemNameAr: item.itemNameAr || item.itemCode,
          maxAvailableAtLaundry: item.expectedQty,
          receivedCleanQty: item.expectedQty,
          damagedQty: 0,
          rejectReason: '',
          notes: ''
        }));
        setItems(rows);
      }
    } catch (err: any) {
      console.error('Failed to load return details:', err);
      setErrorMessage(err.response?.data?.message || 'تعذر تحميل بيانات مستند المرتجع.');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const loadTransferDetails = async (transferId: number) => {
    setIsLoadingDetails(true);
    setErrorMessage(null);
    try {
      const transfer = await laundryApi.getTransferById(transferId);
      if (transfer && transfer.items) {
        // Items that have unreturned quantities
        const activeItems = transfer.items
          .filter(i => (i.remainingQty ?? i.sentQty ?? 0) > 0)
          .map(item => {
            const remaining = Number(item.remainingQty ?? item.sentQty ?? 0);
            return {
              itemCode: item.itemCode,
              itemNameAr: item.itemNameAr || item.itemCode,
              maxAvailableAtLaundry: remaining,
              receivedCleanQty: remaining,
              damagedQty: 0,
              rejectReason: '',
              notes: ''
            };
          });

        if (activeItems.length === 0) {
          // If all remaining are 0, still show sent items with 0
          const allItems = transfer.items.map(item => ({
            itemCode: item.itemCode,
            itemNameAr: item.itemNameAr || item.itemCode,
            maxAvailableAtLaundry: Number(item.sentQty || 0),
            receivedCleanQty: Number(item.sentQty || 0),
            damagedQty: 0,
            rejectReason: '',
            notes: ''
          }));
          setItems(allItems);
        } else {
          setItems(activeItems);
        }
      }
    } catch (err: any) {
      console.error('Failed to load transfer items:', err);
      setErrorMessage(err.response?.data?.message || 'تعذر تحميل تفاصيل حركة المغسلة.');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleTransferChange = (transferId: number) => {
    setSelectedTransferId(transferId);
    loadTransferDetails(transferId);
  };

  const handleCleanQtyChange = (index: number, val: number) => {
    setItems(prev => {
      const updated = [...prev];
      const max = updated[index].maxAvailableAtLaundry;
      const cleanVal = Math.max(0, Math.min(val, max));
      updated[index].receivedCleanQty = cleanVal;
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validRows = items.filter(i => (i.receivedCleanQty > 0 || i.damagedQty > 0));
    if (validRows.length === 0) {
      setErrorMessage('يجب تحديد كميات مستلمة نظيفة أكبر من صفر لصنف واحد على الأقل.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (preselectedReturn) {
        // Mode A: Verify existing return document
        const hasDiff = validRows.some(r => r.receivedCleanQty < r.maxAvailableAtLaundry);
        const finalStatus = hasDiff ? 'partial_received' : 'completed';

        await laundryApi.verifyReturn(preselectedReturn.id, {
          status: finalStatus,
          notes: notes.trim() || 'تم مراجعة وتأكيد استلام البياضات النظيفة بالمستودع',
          items: validRows.map(r => ({
            itemCode: r.itemCode,
            actualQty: Number(r.receivedCleanQty),
            rejectReason: r.damagedQty > 0 ? (r.rejectReason || 'Damaged') : null,
            rejectNotes: r.damagedQty > 0 ? (r.notes || `تالف أثناء الغسيل: ${r.damagedQty} عدد`) : null
          }))
        });

        queryClient.invalidateQueries({ queryKey: ['transfers'] });
        queryClient.invalidateQueries({ queryKey: ['laundry-transfers'] });
        queryClient.invalidateQueries({ queryKey: ['laundry-returns'] });
        queryClient.invalidateQueries({ queryKey: ['stock'] });
        queryClient.invalidateQueries({ queryKey: ['node-stock'] });
        queryClient.invalidateQueries({ queryKey: ['inventory'] });

        onSuccess(`تم تأكيد استلام مستند المرتجع #${preselectedReturn.id} بنجاح وإعادة الكميات للرصيد التشغيلي.`);
        onClose();
      } else {
        // Mode B: Direct Clean Return from transfer
        if (!selectedTransferId) {
          setErrorMessage('يرجى تحديد حركة تحويل المغسلة المراد استلامها.');
          setIsSubmitting(false);
          return;
        }

        const res = await laundryApi.createReturn({
          transferId: Number(selectedTransferId),
          notes: notes.trim() || 'استلام بياضات نظيفة بالمستودع',
          items: validRows.map(r => ({
            itemCode: r.itemCode,
            itemNameAr: r.itemNameAr,
            expectedQty: Number(r.receivedCleanQty)
          }))
        });

        queryClient.invalidateQueries({ queryKey: ['transfers'] });
        queryClient.invalidateQueries({ queryKey: ['laundry-transfers'] });
        queryClient.invalidateQueries({ queryKey: ['laundry-returns'] });
        queryClient.invalidateQueries({ queryKey: ['stock'] });
        queryClient.invalidateQueries({ queryKey: ['node-stock'] });
        queryClient.invalidateQueries({ queryKey: ['inventory'] });

        onSuccess(res?.message || 'تم استلام البياضات النظيفة بنجاح وإعادتها فورياً إلى الرصيد الفعلي للمستودع.');
        onClose();
      }
    } catch (err: any) {
      console.error('Failed to accept laundry return:', err);
      const msg = err.response?.data?.message || err.message || 'حدث خطأ أثناء اعتماد واستلام البياضات من المغسلة.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 font-arabic select-none" dir="rtl">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-3xl shadow-2xl overflow-hidden animate-scale-up flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-emerald-900 px-6 py-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold shadow-xs">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold flex items-center gap-2">
                {preselectedReturn ? `اعتماد وتأكيد استلام مرتجع المغسلة #${preselectedReturn.id}` : 'استلام بياضات نظيفة من المغسلة'}
              </h2>
              <p className="text-xs text-emerald-200 mt-0.5">
                تأكيد وصول الشحنة وإعادة الكميات تلقائياً إلى الرصيد الفعلي للمستودع
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-300 hover:text-white hover:bg-emerald-800/60 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-700 text-xs">
          
          {/* Info Banner */}
          <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-3.5 flex items-start gap-3">
            <Info size={18} className="text-emerald-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-extrabold text-emerald-950">تحديث تلقائي وفوري للأرصدة:</span>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                بمجرد اعتماد الاستلام، سيتم تلقائياً خصم الكميات من عمود <strong>(المغسلة)</strong> وإضافتها فوراً إلى <strong>(الرصيد الفعلي)</strong> في شاشات المخزون وتقارير الرقابة بدون الحاجة لأي اعتماد إداري إضافي.
              </p>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-3.5 rounded-xl flex items-center gap-2.5 animate-shake">
              <AlertCircle size={18} className="text-red-600 shrink-0" />
              <span className="font-semibold text-xs">{errorMessage}</span>
            </div>
          )}

          {/* Transfer Selector if not preselected */}
          {!preselectedReturn && !preselectedTransfer && activeTransfers.length > 0 && (
            <div className="space-y-1.5">
              <label className="font-bold text-slate-800 block">
                اختر حركة التحويل الأصلية للمغسلة:
              </label>
              <select
                value={selectedTransferId}
                onChange={(e) => handleTransferChange(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              >
                {activeTransfers.map((t) => (
                  <option key={t.id} value={t.id}>
                    حركة رقم #{t.id} — المستودع: {t.fromWarehouseName || `مستودع ${t.fromWarehouseId}`} ({new Date(t.createdAt).toLocaleDateString('ar-EG')})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-extrabold text-slate-800 flex items-center gap-1.5">
                <Layers size={15} className="text-emerald-700" />
                الأصناف والكميات النظيفة المستلمة:
              </label>
              <span className="text-[11px] text-slate-400 font-semibold">
                {items.length} أصناف في هذه الشحنة
              </span>
            </div>

            {isLoadingDetails ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200">
                <div className="inline-block w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-slate-500 mt-2 font-bold">جاري تحميل أصناف الشحنة من قاعدة البيانات...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-400 font-semibold">
                لا توجد أصناف معلقة قيد الغسيل في هذه الحركة.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-right border-collapse">
                  <thead className="bg-slate-100/90 text-slate-600 text-[11px] font-extrabold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">كود الصنف</th>
                      <th className="py-2.5 px-3">اسم الصنف</th>
                      <th className="py-2.5 px-3 text-center">في المغسلة</th>
                      <th className="py-2.5 px-3 text-center">المستلم نظيف</th>
                      <th className="py-2.5 px-3 text-center">الحالة والمطابقة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold">
                    {items.map((row, idx) => (
                      <tr key={row.itemCode} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {row.itemCode}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800">
                          {row.itemNameAr}
                        </td>
                        <td className="py-2.5 px-3 text-center font-extrabold text-amber-700 bg-amber-50/50">
                          {row.maxAvailableAtLaundry} عدد
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              max={row.maxAvailableAtLaundry}
                              value={row.receivedCleanQty}
                              onChange={(e) => handleCleanQtyChange(idx, Number(e.target.value))}
                              className="w-20 px-2 py-1 bg-white border border-emerald-300 rounded-lg text-center font-extrabold text-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                            <span className="text-[10px] text-slate-400">عدد</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {row.receivedCleanQty < row.maxAvailableAtLaundry ? (
                            <div className="flex items-center justify-center gap-1 text-red-600 font-bold text-[11px]">
                              <span>عجز: {row.maxAvailableAtLaundry - row.receivedCleanQty}</span>
                            </div>
                          ) : (
                            <span className="text-emerald-600 font-bold text-[11px] flex items-center justify-center gap-1">
                              <CheckCircle2 size={13} />
                              مطابق بالكامل
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Notes Input */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-800 block">
              ملاحظات الاستلام والفحص (اختياري):
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: تم استلام البياضات بحالة ممتازة ونظيفة بالكامل..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 font-semibold"
            />
          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="font-bold text-slate-600"
          >
            إلغاء
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting || isLoadingDetails || items.length === 0}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold gap-2 shadow-xs px-5 cursor-pointer"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                جاري تأكيد الاستلام...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <PackageCheck size={16} />
                تأكيد الاستلام وإعادة الرصيد للمستودع
              </span>
            )}
          </Button>
        </div>

      </div>
    </div>
  );
}
