import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, Plus, Trash2, AlertCircle, FileText, Send, Building2, User, Shirt } from 'lucide-react';
import Button from '../../../components/ui/Button';
import AsyncItemSelector from '../selectors/AsyncItemSelector';
import TreeNodeSelector from '../selectors/TreeNodeSelector';
import { useCreateTransfer } from '../hooks/useTransfers';
import { TRANSFER_TYPES_CONFIG } from '../constants/transfer.constants';
import { useAuth } from '../../../context/AuthContext';
import { useWarehouseScope } from '../../../hooks/useWarehouseScope';
import { laundryApi } from '../../../api/laundry.api';
import type { TransferType, CreateTransferPayload, MasterItem } from '../types/transfer.types';

const LAUNDRY_NODE_ID = 29;
const LAUNDRY_NODE_NAME = 'المغسلة + (المغسلة المركزية)';

interface CreateTransferDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

interface FormLineItem {
  id: string;
  itemCode: string;
  itemNameAr: string;
  quantity: number;
  unitCode: string;
  unitNameAr: string;
  unitCost: number;
  notes: string;
  availableQty?: number;
}

export const CreateTransferDialog: React.FC<CreateTransferDialogProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { user } = useAuth();
  const { 
    currentNodeId, 
    isGlobalAdmin, 
    isParentScope, 
    childWarehouses, 
    currentNodeName, 
    isFromNodeLocked 
  } = useWarehouseScope();
  const queryClient = useQueryClient();
  const createMutation = useCreateTransfer();

  // Form State
  const [txnType, setTxnType] = useState<TransferType>('internal_transfer');
  const [fromNodeId, setFromNodeId] = useState<number | ''>(isParentScope ? '' : (currentNodeId || ''));
  const [toNodeId, setToNodeId] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  React.useEffect(() => {
    if (isParentScope) {
      setFromNodeId('');
    } else if (currentNodeId && !isGlobalAdmin) {
      setFromNodeId(currentNodeId);
    }
  }, [currentNodeId, isParentScope, isGlobalAdmin, isOpen]);
  
  // Lines Grid State
  const [lines, setLines] = useState<FormLineItem[]>([
    { id: '1', itemCode: '', itemNameAr: '', quantity: 1, unitCode: '', unitNameAr: 'وحدة', unitCost: 0, notes: '', availableQty: 0 }
  ]);

  // Error Banners & Field Error States
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ fromNodeId?: string; toNodeId?: string; lines?: string }>({});

  const selectedTxnConfig = TRANSFER_TYPES_CONFIG[txnType];

  const handleFromNodeChange = (newFromId: number | '') => {
    setFromNodeId(newFromId);
    if (fieldErrors.fromNodeId) setFieldErrors(prev => ({ ...prev, fromNodeId: undefined }));
    setDialogError(null);
    // Reset lines when source warehouse changes because stock belongs to that specific warehouse
    setLines([
      { id: Date.now().toString(), itemCode: '', itemNameAr: '', quantity: 1, unitCode: '', unitNameAr: 'وحدة', unitCost: 0, notes: '', availableQty: 0 }
    ]);
  };

  const handleAddLine = () => {
    setLines(prev => [
      ...prev,
      { id: Date.now().toString(), itemCode: '', itemNameAr: '', quantity: 1, unitCode: '', unitNameAr: 'وحدة', unitCost: 0, notes: '', availableQty: 0 }
    ]);
  };

  const handleRemoveLine = (id: string) => {
    if (lines.length === 1) {
      setDialogError('يجب أن تحتوي الحركة على صنف واحد على الأقل.');
      return;
    }
    setLines(prev => prev.filter(l => l.id !== id));
  };

  const handleLineItemSelect = (id: string, item: MasterItem) => {
    const avail = Number(item.availableQty || 0);
    setLines(prev => prev.map(line => {
      if (line.id === id) {
        return {
          ...line,
          itemCode: item.itemCode,
          itemNameAr: item.itemNameAr,
          unitCode: item.unitCode || '',
          unitNameAr: item.unitNameAr || item.unitCode || 'وحدة',
          unitCost: item.avgCost || 0,
          availableQty: avail,
          quantity: avail > 0 ? Math.min(line.quantity || 1, avail) : 1
        };
      }
      return line;
    }));
  };

  const handleLineQuantityChange = (id: string, qty: number) => {
    setLines(prev => prev.map(line => line.id === id ? { ...line, quantity: Math.max(0, qty) } : line));
  };

  const resetForm = () => {
    setTxnType('internal_transfer');
    setFromNodeId(isParentScope ? '' : (currentNodeId || ''));
    setToNodeId('');
    setReason('');
    setNotes('');
    setLines([
      { id: '1', itemCode: '', itemNameAr: '', quantity: 1, unitCode: '', unitNameAr: 'وحدة', unitCost: 0, notes: '', availableQty: 0 }
    ]);
    setDialogError(null);
    setFieldErrors({});
  };

  const handleSave = (submitForApproval: boolean) => {
    setDialogError(null);
    const errors: Record<string, string> = {};

    if (!fromNodeId) errors.fromNodeId = 'يرجى اختيار مستودع المصدر';
    if (selectedTxnConfig?.requiresDestination && !toNodeId) {
      errors.toNodeId = 'يرجى اختيار مستودع الوجهة لحركة التحويل';
    }
    if (lines.length === 0) errors.lines = 'يجب إضافة صنف واحد على الأقل للمستند';

    lines.forEach((l, idx) => {
      if (!l.itemCode.trim()) {
        errors[`line_${idx}_item`] = 'يرجى اختيار صنف';
      }
      if (!l.quantity || l.quantity <= 0) {
        errors[`line_${idx}_qty`] = 'الكمية يجب أن تكون أكبر من صفر';
      } else if (l.availableQty !== undefined && l.quantity > l.availableQty) {
        errors[`line_${idx}_qty`] = `الكمية المطلوبة (${l.quantity}) تتجاوز الرصيد المتوفر (${l.availableQty}) للصنف [${l.itemCode}]`;
      } else if (l.availableQty !== undefined && l.availableQty <= 0) {
        errors[`line_${idx}_qty`] = `رصيد الصنف [${l.itemCode}] في مخزن المصدر غير كافٍ (المتاح: 0). لا يمكن تنفيذ التحويل.`;
      }
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const stockError = Object.values(errors).find(msg => msg.includes('تتجاوز الرصيد') || msg.includes('غير كافٍ'));
      setDialogError(stockError || 'يرجى تصحيح الأخطاء الموضحة قبل إرسال مستند الحركة المخزنية.');
      return;
    }

    const destinationNodeId = txnType === 'laundry'
      ? LAUNDRY_NODE_ID
      : (selectedTxnConfig?.requiresDestination && toNodeId ? Number(toNodeId) : null);

    const payload: CreateTransferPayload = {
      txnType: txnType === 'laundry' ? 'internal_transfer' : txnType,
      fromNodeId: Number(fromNodeId),
      toNodeId: destinationNodeId,
      reason: reason.trim() || undefined,
      notes: txnType === 'laundry'
        ? (notes.trim() ? `[تحويل للمغسلة] ${notes.trim()}` : '[تحويل للمغسلة]')
        : (notes.trim() || undefined),
      submitForApproval,
      lines: lines.map(l => ({
        itemCode: l.itemCode,
        quantity: Number(l.quantity),
        unitCode: l.unitCode || undefined,
        unitCost: Number(l.unitCost || 0)
      }))
    };

    if (txnType === 'laundry') {
      laundryApi.createTransfer({
        fromWarehouseId: Number(fromNodeId),
        fromNodeId: Number(fromNodeId),
        notes: notes.trim() || reason.trim() || 'تحويل إلى المغسلة',
        items: lines.map(l => ({
          itemCode: l.itemCode,
          itemNameAr: l.itemNameAr,
          sentQty: Number(l.quantity),
          quantity: Number(l.quantity),
          unitCode: l.unitCode || 'PCS',
          unitCost: Number(l.unitCost || 0)
        }))
      }).then((res: any) => {
        queryClient.invalidateQueries({ queryKey: ['transfers'] });
        queryClient.invalidateQueries({ queryKey: ['laundry-transfers'] });
        queryClient.invalidateQueries({ queryKey: ['laundry-returns'] });
        queryClient.invalidateQueries({ queryKey: ['stock'] });
        queryClient.invalidateQueries({ queryKey: ['node-stock'] });
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        const msg = res?.message || 'تم إرسال الأصناف إلى المغسلة بنجاح وخصمها من الرصيد الفعلي للمستودع.';
        onSuccess(msg);
        onClose();
        resetForm();
      }).catch((err: any) => {
        console.error('Laundry transfer dispatch error:', err);
        const msg = err.response?.data?.message || err.message || 'فشل في إرسال التحويل إلى المغسلة';
        setDialogError(msg);
      });
      return;
    }

    createMutation.mutate(payload, {
      onSuccess: (res: any) => {
        const msg = typeof res === 'string' 
          ? res 
          : (res?.message || (submitForApproval ? `تم إرسال طلب التحويل #${res?.txnId || ''} للاعتماد بنجاح` : `تم إنشاء مسودة الحركة المخزنية #${res?.txnId || ''} بنجاح في نظام COMSYS ERP`));
        onSuccess(msg);
        onClose();
        resetForm();
      },
      onError: (err: any) => {
        console.error('Transfer draft creation error:', err);
        let msg = 'فشل في إنشاء مسودة الحركة المخزنية';
        if (err.response?.data) {
          const data = err.response.data;
          if (data.message) {
            msg = data.message;
          }
          if (Array.isArray(data.details)) {
            const detailMsgs = data.details.map((d: any) => d.message || d).join(' | ');
            msg += `: ${detailMsgs}`;
          } else if (data.error) {
            const errDetail = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
            if (errDetail && errDetail !== '{}') {
              msg += `: ${errDetail}`;
            }
          }
        } else if (err.message) {
          msg = err.message;
        }
        setDialogError(msg);
      }
    });
  };

  if (!isOpen) return null;

  const totalEstimatedCost = lines.reduce((acc, curr) => acc + (curr.quantity * curr.unitCost), 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 font-arabic select-none" dir="rtl">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-4xl shadow-2xl overflow-hidden animate-scale-up flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
              <FileText size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold">إنشاء الحركة المخزنية (SAP / Oracle Order Grid)</h2>
              <p className="text-[10px] text-slate-400">إصدار سند تحويل أو استهلاك تشغيلي بنظام المخازن الرئيسي</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={(e) => { e.preventDefault(); handleSave(false); }} noValidate className="p-6 pb-44 space-y-5 overflow-y-auto flex-1">
          
          {/* Error Banner */}
          {dialogError && (
            <div className="p-4 rounded-xl bg-red-50 border-2 border-red-200 flex items-start gap-3 text-right animate-fade-in shadow-xs">
              <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <h4 className="text-xs font-black text-red-900">خطأ في مستند الحركة</h4>
                <p className="text-xs text-red-800 font-bold mt-0.5 leading-relaxed">{dialogError}</p>
              </div>
            </div>
          )}

          {/* User Info Bar */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <User size={15} className="text-blue-600" />
              <span className="font-bold">مُنشئ المستند:</span>
              <span className="bg-white border border-slate-200 px-2.5 py-1 rounded-lg font-bold text-slate-800">
                {user?.fullNameAr || user?.username || 'المستخدم الحالي'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <span className="font-semibold">الحالة المبدئية:</span>
              <span className="bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold text-[10px]">
                مسودة جديدة (Draft)
              </span>
            </div>
          </div>

          {/* Header Grid: TxnType, From Node (Tree), To Node (Tree) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Txn Type */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                نوع الحركة المخزنية <span className="text-red-500">*</span>
              </label>
              <select
                value={txnType}
                onChange={(e) => {
                  const newType = e.target.value as TransferType;
                  setTxnType(newType);
                  if (newType === 'laundry') {
                    setToNodeId(LAUNDRY_NODE_ID);
                  } else if (toNodeId === LAUNDRY_NODE_ID) {
                    setToNodeId('');
                  }
                  setDialogError(null);
                }}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white font-semibold text-slate-800"
              >
                {Object.entries(TRANSFER_TYPES_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
              {selectedTxnConfig && (
                <p className="text-[10px] text-slate-400 leading-tight mt-1">{selectedTxnConfig.desc}</p>
              )}
            </div>

            {/* From Node (Tree Selector) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700">
                  مستودع / مخزن المصدر (من) <span className="text-red-500">*</span>
                </label>
                {isFromNodeLocked ? (
                  <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                    🔒 مقفل ({currentNodeName || 'مستودعك المخصص'})
                  </span>
                ) : isParentScope ? (
                  <span className="text-[10px] text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                    🏢 نطاق المنشأة: اختر المستودع الفرعي المصدر
                  </span>
                ) : null}
              </div>
              <TreeNodeSelector
                value={fromNodeId}
                disabled={isFromNodeLocked}
                placeholder={isParentScope ? `اختر المستودع الفرعي المصدر (التابع لـ ${currentNodeName})...` : 'اختر مستودع المصدر...'}
                error={!!fieldErrors.fromNodeId}
                onChange={(id) => handleFromNodeChange(id)}
              />
              {isParentScope && childWarehouses.length > 0 && (
                <div className="pt-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-slate-500 font-bold">مستودعات المنشأة الفرعية:</span>
                  {childWarehouses.map(child => (
                    <button
                      key={child.nodeId}
                      type="button"
                      onClick={() => handleFromNodeChange(child.nodeId)}
                      className={`text-[10px] px-2 py-0.5 rounded-lg border font-medium transition-all ${
                        fromNodeId === child.nodeId
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-bold'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-blue-50 hover:border-blue-300'
                      }`}
                    >
                      {child.name}
                    </button>
                  ))}
                </div>
              )}
              {fieldErrors.fromNodeId && (
                <p className="text-[10px] text-red-600 font-bold flex items-center gap-1 mt-1">
                  <AlertCircle size={11} /> {fieldErrors.fromNodeId}
                </p>
              )}
            </div>

            {/* To Node (Tree Selector) */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                مستودع / مخزن الوجهة (إلى) {selectedTxnConfig?.requiresDestination && <span className="text-red-500">*</span>}
              </label>
              {txnType === 'laundry' ? (
                <div className="flex items-center justify-between p-2.5 bg-purple-50/70 border border-purple-200 rounded-xl text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                      <Shirt size={16} />
                    </div>
                    <div>
                      <span className="font-bold text-purple-900 block">{LAUNDRY_NODE_NAME}</span>
                      <span className="text-[10px] text-purple-600 font-medium">تم التوجيه تلقائياً إلى المغسلة</span>
                    </div>
                  </div>
                  <span className="text-[10px] bg-purple-200 text-purple-800 font-bold px-2 py-0.5 rounded-full">
                    تلقائي ومقفل
                  </span>
                </div>
              ) : (
                <TreeNodeSelector
                  value={toNodeId}
                  excludeNodeId={fromNodeId}
                  disabled={!selectedTxnConfig?.requiresDestination}
                  error={!!fieldErrors.toNodeId}
                  placeholder={selectedTxnConfig?.requiresDestination ? 'اختر مستودع الوجهة...' : 'غير مطلوب لهذا النوع'}
                  onChange={(id) => {
                    setToNodeId(id);
                    if (fieldErrors.toNodeId) setFieldErrors({ ...fieldErrors, toNodeId: undefined });
                    setDialogError(null);
                  }}
                />
              )}
              {fieldErrors.toNodeId && (
                <p className="text-[10px] text-red-600 font-bold flex items-center gap-1 mt-1">
                  <AlertCircle size={11} /> {fieldErrors.toNodeId}
                </p>
              )}
            </div>

          </div>

          {/* Reason & Notes Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">سبب الحركة (اختياري)</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="مثال: تغطية احتياج بار النزلاء لفعالية نهاية الأسبوع"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-500 outline-none font-semibold text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات إضافية (اختياري)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أي ملاحظات خاصة بالتوصيل أو الاستلام..."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-500 outline-none font-semibold text-slate-800"
              />
            </div>
          </div>

          {/* Items Table Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <Building2 size={16} className="text-blue-600" />
                جدول الأصناف المطلوبة (Order Grid)
              </h3>
              <Button type="button" variant="outline" size="sm" onClick={handleAddLine} className="gap-1.5 text-xs">
                <Plus size={14} /> إضافة صنف آخر
              </Button>
            </div>

            {fieldErrors.lines && (
              <p className="text-[11px] text-red-600 font-bold flex items-center gap-1">
                <AlertCircle size={12} /> {fieldErrors.lines}
              </p>
            )}

            <div className="border border-slate-200 rounded-xl bg-white shadow-2xs">
              <table className="w-full text-right border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold rounded-t-xl">
                  <tr>
                    <th className="px-3 py-2.5 w-10 text-center">#</th>
                    <th className="px-3 py-2.5 min-w-[260px]">الصنف (البحث بالرمز أو الاسم)</th>
                    <th className="px-3 py-2.5 w-20 text-center">الوحدة</th>
                    <th className="px-3 py-2.5 w-28 text-center">الرصيد المتاح بالمصدر</th>
                    <th className="px-3 py-2.5 w-28 text-center">الكمية المطلوبة</th>
                    <th className="px-3 py-2.5 w-24 text-center">التكلفة (تقديري)</th>
                    <th className="px-3 py-2.5 w-24 text-center">الإجمالي</th>
                    <th className="px-3 py-2.5 w-12 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {lines.map((line, index) => {
                    const lineTotal = line.quantity * line.unitCost;
                    const rowIndexZ = 100 - index;
                    const isExceeding = line.availableQty !== undefined && line.quantity > line.availableQty;
                    return (
                      <tr key={line.id} style={{ zIndex: rowIndexZ }} className="relative hover:bg-slate-50/50 focus-within:z-[500]">
                        <td className="px-3 py-2 text-center font-bold text-slate-400">{index + 1}</td>
                        <td className="px-3 py-2 relative">
                          <AsyncItemSelector
                            value={line.itemCode}
                            nodeId={fromNodeId}
                            onSelect={(item) => handleLineItemSelect(line.id, item)}
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-bold">
                            {line.unitNameAr}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {line.itemCode ? (
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 ${
                              (line.availableQty || 0) > 0 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                              {(line.availableQty || 0) > 0 ? `${line.availableQty} ${line.unitNameAr}` : 'غير متوفر (0)'}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-[10px]">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min={1}
                            max={line.availableQty && line.availableQty > 0 ? line.availableQty : undefined}
                            step="any"
                            value={line.quantity}
                            onChange={(e) => handleLineQuantityChange(line.id, parseFloat(e.target.value) || 0)}
                            className={`w-full text-center px-2 py-1 border rounded-lg font-bold text-slate-800 outline-none transition-colors ${
                              isExceeding
                                ? 'border-red-500 bg-red-50 text-red-700 ring-1 ring-red-500'
                                : 'border-slate-200 focus:border-blue-500'
                            }`}
                          />
                          {isExceeding && (
                            <p className="text-[9px] text-red-600 font-bold mt-1 leading-tight">
                              تجاوز المتاح ({line.availableQty})
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center font-mono font-semibold text-slate-600">
                          {line.unitCost.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-center font-mono font-bold text-slate-800">
                          {lineTotal.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(line.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer Summary */}
          <div className="bg-slate-900 text-white rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-[10px] text-slate-400 block">إجمالي الأصناف:</span>
                <span className="text-sm font-extrabold text-blue-400">{lines.length} صنف</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">القيمة التقديرية الكلية:</span>
                <span className="text-sm font-extrabold text-emerald-400">{totalEstimatedCost.toFixed(2)} جنيه</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="dark" size="sm" onClick={onClose} className="px-4">
                إلغاء
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                disabled={createMutation.isPending} 
                onClick={() => handleSave(false)}
                className="font-bold text-slate-800 border-slate-300 hover:bg-slate-100"
              >
                حفظ كـ مسودة
              </Button>
              <Button 
                type="button" 
                variant="primary" 
                size="sm" 
                disabled={createMutation.isPending} 
                onClick={() => handleSave(true)}
                className="gap-1.5 bg-blue-600 hover:bg-blue-700 font-bold"
              >
                <Send size={14} />
                {createMutation.isPending ? 'جاري الإرسال...' : 'تقديم للاعتماد فوراً'}
              </Button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};

export default CreateTransferDialog;
