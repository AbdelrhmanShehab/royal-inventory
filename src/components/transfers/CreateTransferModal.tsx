import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Trash2, AlertCircle, FileText, Send, Building2, User } from 'lucide-react';
import Button from '../ui/Button';
import AsyncItemSelector from '../ui/AsyncItemSelector';
import { hierarchyApi } from '../../api/hierarchy.api';
import transfersApi from '../../api/transfers.api';
import { useAuth } from '../../context/AuthContext';
import type { TxnType, CreateTransferPayload, MasterItem } from '../../types/transfer';
import type { OrganizationNode } from '../../types/hierarchy';

interface CreateTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

// Transaction Types mapping
const TXN_TYPES: { key: TxnType; label: string; requiresDestination: boolean; desc: string }[] = [
  { key: 'internal_transfer', label: 'تحويل بين مستودعات (Internal Transfer)', requiresDestination: true, desc: 'نقل كميات بين مستودعين مع دورة اعتماد وتأكيد استلام' },
  { key: 'consumption', label: 'استهلاك تشغيلي (Consumption)', requiresDestination: false, desc: 'استهلاك فوري ومباشر للمواد في القسم أو الفرع' },
  { key: 'return', label: 'مرتجع للمخزن الرئيسي (Return)', requiresDestination: true, desc: 'إعادة مواد غير مستعملة للمستودع الرئيسي' },
  { key: 'damage', label: 'تلف أصل / مواد (Damage)', requiresDestination: false, desc: 'إثبات تلف أصول أو كميات مخزنية غير صالحة للاستخدام' },
  { key: 'waste', label: 'هدر تشغيلي (Waste)', requiresDestination: false, desc: 'توثيق نسبة الهدر اليومي في أقسام التشغيل والطهي' },
  { key: 'disposal', label: 'تخريد واستبعاد (Disposal)', requiresDestination: false, desc: 'إعدام واستبعاد مخزني رسمي' },
];

// Helper to flatten node tree for selection
function flattenNodes(nodes: OrganizationNode[]): { id: number; name: string; type: string }[] {
  let result: { id: number; name: string; type: string }[] = [];
  for (const node of nodes) {
    const numId = Number(node.id.replace('group-', ''));
    if (!isNaN(numId)) {
      result.push({ id: numId, name: node.name, type: node.type });
    }
    if (node.children && node.children.length > 0) {
      result = result.concat(flattenNodes(node.children));
    }
  }
  return result;
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
}

export const CreateTransferModal: React.FC<CreateTransferModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Form State
  const [txnType, setTxnType] = useState<TxnType>('internal_transfer');
  const [fromNodeId, setFromNodeId] = useState<number | ''>('');
  const [toNodeId, setToNodeId] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  
  // Lines Grid State
  const [lines, setLines] = useState<FormLineItem[]>([
    { id: '1', itemCode: '', itemNameAr: '', quantity: 1, unitCode: '', unitNameAr: 'وحدة', unitCost: 0, notes: '' }
  ]);

  // Error Banners & Field Error States
  const [modalError, setModalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ fromNodeId?: string; toNodeId?: string; lines?: string }>({});

  // Fetch Nodes
  const { data: treeNodes = [] } = useQuery({
    queryKey: ['hierarchy-tree'],
    queryFn: hierarchyApi.getTree
  });
  const availableNodes = flattenNodes(treeNodes);

  const selectedTxnConfig = TXN_TYPES.find(t => t.key === txnType);

  // Add new line row
  const handleAddLine = () => {
    setLines(prev => [
      ...prev,
      { id: Date.now().toString(), itemCode: '', itemNameAr: '', quantity: 1, unitCode: '', unitNameAr: 'وحدة', unitCost: 0, notes: '' }
    ]);
  };

  // Remove line row
  const handleRemoveLine = (id: string) => {
    if (lines.length === 1) {
      setModalError('يجب أن تحتوي الحركة على صنف واحد على الأقل.');
      return;
    }
    setLines(prev => prev.filter(l => l.id !== id));
  };

  // Line item update
  const handleLineItemSelect = (id: string, item: MasterItem) => {
    setLines(prev => prev.map(line => {
      if (line.id === id) {
        return {
          ...line,
          itemCode: item.itemCode,
          itemNameAr: item.itemNameAr,
          unitCode: item.unitCode || '',
          unitNameAr: item.unitNameAr || item.unitCode || 'وحدة',
          unitCost: item.avgCost || 0
        };
      }
      return line;
    }));
  };

  const handleLineQuantityChange = (id: string, qty: number) => {
    setLines(prev => prev.map(line => line.id === id ? { ...line, quantity: Math.max(0, qty) } : line));
  };

  // Mutation
  const createMutation = useMutation({
    mutationFn: (payload: CreateTransferPayload) => transfersApi.createDraft(payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      onSuccess(res.message || 'تم إنشاء مسودة طلب الحركة بنجاح');
      onClose();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'فشل في إنشاء مسودة الحركة المخزنية';
      setModalError(msg);
    }
  });

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    const errors: { fromNodeId?: string; toNodeId?: string; lines?: string } = {};

    if (!fromNodeId) {
      errors.fromNodeId = 'يرجى اختيار مستودع / مخزن المصدر';
    }

    if (selectedTxnConfig?.requiresDestination) {
      if (!toNodeId) {
        errors.toNodeId = 'يرجى اختيار مستودع / مخزن الوجهة';
      } else if (fromNodeId === toNodeId) {
        errors.toNodeId = 'لا يمكن اختيار نفس المستودع كـ مصدر ووجهة';
      }
    }

    // Validate Lines
    const invalidLine = lines.find(l => !l.itemCode.trim() || l.quantity <= 0);
    if (invalidLine) {
      errors.lines = 'يرجى اختيار صنف صحيح وتحديد كمية أكبر من صفر لجميع الأسطر';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setModalError('يرجى تصحيح الأخطاء الموضحة قبل إرسال طلب الحركة.');
      return;
    }

    setFieldErrors({});

    const payload: CreateTransferPayload = {
      txnType,
      fromNodeId: Number(fromNodeId),
      toNodeId: selectedTxnConfig?.requiresDestination && toNodeId ? Number(toNodeId) : null,
      reason: reason.trim() || undefined,
      notes: notes.trim() || undefined,
      lines: lines.map(l => ({
        itemCode: l.itemCode,
        quantity: Number(l.quantity),
        unitCode: l.unitCode || undefined,
        unitCost: Number(l.unitCost || 0)
      }))
    };

    createMutation.mutate(payload);
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
              <h2 className="text-sm font-bold">إنشاء الحركة المخزنية (ERP Transaction Document)</h2>
              <p className="text-[10px] text-slate-400">إصدار سند تحويل أو استهلاك تشغيلي في نظام المخازن الرئيسي</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-5 overflow-y-auto flex-1">
          
          {/* Modal Error Banner */}
          {modalError && (
            <div className="p-4 rounded-xl bg-red-50 border-2 border-red-200 flex items-start gap-3 text-right animate-fade-in shadow-xs">
              <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <h4 className="text-xs font-black text-red-900">خطأ في مستند الحركة</h4>
                <p className="text-xs text-red-800 font-bold mt-0.5 leading-relaxed">{modalError}</p>
              </div>
            </div>
          )}

          {/* Top Info Bar: Requester & Doc Status */}
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

          {/* Header Grid: TxnType, From Node, To Node */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Txn Type */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                نوع الحركة المخزنية <span className="text-red-500">*</span>
              </label>
              <select
                value={txnType}
                onChange={(e) => {
                  setTxnType(e.target.value as TxnType);
                  setModalError(null);
                }}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white font-semibold text-slate-800"
              >
                {TXN_TYPES.map(t => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
              {selectedTxnConfig && (
                <p className="text-[10px] text-slate-400 leading-tight mt-1">{selectedTxnConfig.desc}</p>
              )}
            </div>

            {/* From Node */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                مستودع / مخزن المصدر (من) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={fromNodeId}
                  onChange={(e) => {
                    setFromNodeId(e.target.value ? Number(e.target.value) : '');
                    if (fieldErrors.fromNodeId) setFieldErrors({ ...fieldErrors, fromNodeId: undefined });
                    setModalError(null);
                  }}
                  className={`w-full px-3 py-2 text-xs border rounded-xl outline-none bg-white font-semibold text-slate-800 ${
                    fieldErrors.fromNodeId ? 'border-2 border-red-500 bg-red-50/20' : 'border-slate-200 focus:ring-1 focus:ring-blue-500'
                  }`}
                >
                  <option value="">اختر المستودع المصدر...</option>
                  {availableNodes.map(node => (
                    <option key={node.id} value={node.id}>
                      {node.name} ({node.type})
                    </option>
                  ))}
                </select>
              </div>
              {fieldErrors.fromNodeId && (
                <p className="text-[10px] text-red-600 font-bold flex items-center gap-1 mt-1">
                  <AlertCircle size={11} /> {fieldErrors.fromNodeId}
                </p>
              )}
            </div>

            {/* To Node */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                مستودع / مخزن الوجهة (إلى) {selectedTxnConfig?.requiresDestination && <span className="text-red-500">*</span>}
              </label>
              <select
                disabled={!selectedTxnConfig?.requiresDestination}
                value={toNodeId}
                onChange={(e) => {
                  setToNodeId(e.target.value ? Number(e.target.value) : '');
                  if (fieldErrors.toNodeId) setFieldErrors({ ...fieldErrors, toNodeId: undefined });
                  setModalError(null);
                }}
                className={`w-full px-3 py-2 text-xs border rounded-xl outline-none bg-white font-semibold text-slate-800 disabled:bg-slate-100 disabled:text-slate-400 ${
                  fieldErrors.toNodeId ? 'border-2 border-red-500 bg-red-50/20' : 'border-slate-200 focus:ring-1 focus:ring-blue-500'
                }`}
              >
                <option value="">
                  {selectedTxnConfig?.requiresDestination ? 'اختر المستودع الوجهة...' : 'غير مطلوب لهذا النوع'}
                </option>
                {availableNodes.map(node => (
                  <option key={node.id} value={node.id}>
                    {node.name} ({node.type})
                  </option>
                ))}
              </select>
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
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات إضافية (اختياري)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أي ملاحظات خاصة بالتوصيل أو الاستلام..."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Lines Table Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <Building2 size={16} className="text-blue-600" />
                جدول الأصناف المطلوبة للتحويل/الاستهلاك (Line Items)
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

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-right border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold">
                  <tr>
                    <th className="px-3 py-2.5 w-10 text-center">#</th>
                    <th className="px-3 py-2.5 min-w-[260px]">الصنف (البحث بالرمز أو الاسم)</th>
                    <th className="px-3 py-2.5 w-24 text-center">الوحدة</th>
                    <th className="px-3 py-2.5 w-28 text-center">الكمية</th>
                    <th className="px-3 py-2.5 w-28 text-center">التكلفة (تقديري)</th>
                    <th className="px-3 py-2.5 w-28 text-center">الإجمالي</th>
                    <th className="px-3 py-2.5 w-12 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {lines.map((line, index) => {
                    const lineTotal = line.quantity * line.unitCost;
                    return (
                      <tr key={line.id} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2 text-center font-bold text-slate-400">{index + 1}</td>
                        <td className="px-3 py-2">
                          <AsyncItemSelector
                            value={line.itemCode}
                            onSelect={(item) => handleLineItemSelect(line.id, item)}
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-bold">
                            {line.unitNameAr}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min={1}
                            step="any"
                            value={line.quantity}
                            onChange={(e) => handleLineQuantityChange(line.id, parseFloat(e.target.value) || 0)}
                            className="w-full text-center px-2 py-1 border border-slate-200 rounded-lg font-bold text-slate-800 outline-none focus:border-blue-500"
                          />
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

          {/* Bottom Summary Bar */}
          <div className="bg-slate-900 text-white rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-[10px] text-slate-400 block">إجمالي الأصناف:</span>
                <span className="text-sm font-extrabold text-blue-400">{lines.length} صنف</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">القيمة التقديرية الكلية:</span>
                <span className="text-sm font-extrabold text-emerald-400">{totalEstimatedCost.toFixed(2)} ريال</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-white border-slate-700 hover:bg-slate-800">
                إلغاء
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={createMutation.isPending} className="gap-2 bg-blue-600 hover:bg-blue-700">
                <Send size={14} />
                {createMutation.isPending ? 'جاري الإنشاء...' : 'حفظ كـ مسودة جديدة'}
              </Button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};

export default CreateTransferModal;
