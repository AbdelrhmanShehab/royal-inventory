import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  X, 
  FileText, 
  CheckCircle2, 
  Send, 
  Truck, 
  PackageCheck, 
  XCircle, 
  AlertCircle, 
  Building2, 
  User, 
  Calendar,
  Clock,
  ArrowRightLeft,
  Check
} from 'lucide-react';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import transfersApi from '../../api/transfers.api';
import { useAuth } from '../../context/AuthContext';
import type { TransferStatus } from '../../types/transfer';

interface TransferDetailsModalProps {
  transferId: number | string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

const statusLabels: Record<TransferStatus, { text: string; variant: 'neutral' | 'warning' | 'info' | 'success' | 'danger' }> = {
  draft: { text: 'مسودة جارية', variant: 'neutral' },
  pending_approval: { text: 'بانتظار الاعتماد', variant: 'warning' },
  approved: { text: 'معتمد من الإدارة', variant: 'info' },
  shipped: { text: 'قيد التوصيل (مشحون)', variant: 'info' },
  confirmed: { text: 'مكتمل ومؤكد', variant: 'success' },
  cancelled: { text: 'ملغي', variant: 'danger' }
};

const txnTypeLabels: Record<string, string> = {
  internal_transfer: 'تحويل بين مستودعات',
  consumption: 'استهلاك تشغيلي',
  return: 'مرتجع للمخزن الرئيسي',
  damage: 'تلف مواد/أصل',
  waste: 'هدر تشغيلي',
  disposal: 'تخريد واستبعاد'
};

export const TransferDetailsModal: React.FC<TransferDetailsModalProps> = ({
  transferId,
  isOpen,
  onClose,
  onSuccess
}) => {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch transfer details query
  const { data: transfer, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['transfer-details', transferId],
    queryFn: () => transfersApi.getTransfer(transferId!),
    enabled: !!transferId && isOpen
  });

  // Action Mutations
  const submitMutation = useMutation({
    mutationFn: () => transfersApi.submitForApproval(transferId!),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['transfer-details', transferId] });
      onSuccess(res.message || 'تم تقديم الحركة للاعتماد بنجاح');
    },
    onError: (err: any) => setActionError(err.response?.data?.message || err.message)
  });

  const approveMutation = useMutation({
    mutationFn: () => transfersApi.approveTransfer(transferId!),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['transfer-details', transferId] });
      onSuccess(res.message || 'تم اعتماد طلب التحويل بنجاح');
    },
    onError: (err: any) => setActionError(err.response?.data?.message || err.message)
  });

  const dispatchMutation = useMutation({
    mutationFn: () => transfersApi.dispatchTransfer(transferId!),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['transfer-details', transferId] });
      onSuccess(res.message || 'تم شحن البضاعة وتخصيص الرصيد بنجاح');
    },
    onError: (err: any) => setActionError(err.response?.data?.message || err.message)
  });

  const receiveMutation = useMutation({
    mutationFn: () => transfersApi.receiveTransfer(transferId!),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['transfer-details', transferId] });
      onSuccess(res.message || 'تم استلام الشحنة وإضافتها لعهدة المستودع بنجاح');
    },
    onError: (err: any) => setActionError(err.response?.data?.message || err.message)
  });

  const cancelMutation = useMutation({
    mutationFn: () => transfersApi.cancelTransfer(transferId!),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['transfer-details', transferId] });
      onSuccess(res.message || 'تم إلغاء المستند بنجاح');
    },
    onError: (err: any) => setActionError(err.response?.data?.message || err.message)
  });

  const confirmMutation = useMutation({
    mutationFn: () => transfersApi.confirmTransfer(transferId!),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['transfer-details', transferId] });
      onSuccess(res.message || 'تم تأكيد العملية التشغيلية بنجاح');
    },
    onError: (err: any) => setActionError(err.response?.data?.message || err.message)
  });

  if (!isOpen || !transferId) return null;

  const isPendingAction = 
    submitMutation.isPending || 
    approveMutation.isPending || 
    dispatchMutation.isPending || 
    receiveMutation.isPending || 
    cancelMutation.isPending || 
    confirmMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 font-arabic select-none" dir="rtl">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-4xl shadow-2xl overflow-hidden animate-scale-up flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2">
                مستند حركة مخزنية رقم #{transferId}
              </h2>
              <p className="text-[10px] text-slate-400">تفاصيل وسجل مسار الاعتماد وتغييرات الأرصدة التشغيلية</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          
          {/* Action Error Banner */}
          {actionError && (
            <div className="p-4 rounded-xl bg-red-50 border-2 border-red-200 flex items-start gap-3 text-right animate-fade-in shadow-xs">
              <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <h4 className="text-xs font-black text-red-900">خطأ في تنفيذ الإجراء</h4>
                <p className="text-xs text-red-800 font-bold mt-0.5 leading-relaxed">{actionError}</p>
              </div>
              <button onClick={() => setActionError(null)} className="text-red-600 hover:text-red-900 cursor-pointer">
                <X size={16} />
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-4 animate-pulse p-4">
              <div className="h-16 bg-slate-100 rounded-xl w-full"></div>
              <div className="h-32 bg-slate-50 rounded-xl w-full"></div>
              <div className="h-48 bg-slate-100 rounded-xl w-full"></div>
            </div>
          ) : isError || !transfer ? (
            <div className="p-8 text-center bg-red-50 rounded-xl border border-red-200 text-red-800 text-xs font-bold space-y-3">
              <AlertCircle size={24} className="mx-auto text-red-600" />
              <p>{error instanceof Error ? error.message : 'تعذر تحميل تفاصيل الحركة المخزنية من السيرفر.'}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>إعادة المحاولة</Button>
            </div>
          ) : (
            <>
              {/* General Summary Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">نوع الحركة:</span>
                  <span className="font-bold text-slate-800 bg-white border border-slate-200 px-2.5 py-1 rounded-lg inline-block">
                    {txnTypeLabels[transfer.txnType] || transfer.txnType}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">الحالة الحالية:</span>
                  <Badge variant={statusLabels[transfer.status]?.variant || 'neutral'}>
                    {statusLabels[transfer.status]?.text || transfer.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">مستودع المصدر (من):</span>
                  <span className="font-bold text-slate-800 flex items-center gap-1.5 mt-1">
                    <Building2 size={13} className="text-slate-400" />
                    {transfer.fromNodeNameAr || `مستودع #${transfer.fromNodeId}`}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">مستودع الوجهة (إلى):</span>
                  <span className="font-bold text-slate-800 flex items-center gap-1.5 mt-1">
                    <ArrowRightLeft size={13} className="text-slate-400" />
                    {transfer.toNodeNameAr || (transfer.toNodeId ? `مستودع #${transfer.toNodeId}` : 'لا يوجد')}
                  </span>
                </div>
              </div>

              {/* Document Creator & Reason */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-white border border-slate-200 p-3.5 rounded-xl space-y-1">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1 font-semibold">
                    <User size={12} /> منشئ الطلب والتاريخ:
                  </span>
                  <p className="font-bold text-slate-800">{transfer.createdByNameAr || transfer.createdBy}</p>
                  <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                    <Clock size={11} /> {transfer.createdAt ? new Date(transfer.createdAt).toLocaleString('ar-SA') : 'غير محدد'}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 p-3.5 rounded-xl space-y-1">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1 font-semibold">
                    <Calendar size={12} /> سبب الحركة والملاحظات:
                  </span>
                  <p className="font-bold text-slate-800">{transfer.reason || 'لا يوجد سبب محدد'}</p>
                  <p className="text-[10px] text-slate-500">{transfer.notes || 'لا توجد ملاحظات إضافية'}</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  الأصناف المتضمنة في الحركة ({transfer.lines?.length || 0})
                </h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <tr>
                        <th className="px-4 py-3">كود الصنف</th>
                        <th className="px-4 py-3">اسم الصنف</th>
                        <th className="px-4 py-3 text-center">الكمية</th>
                        <th className="px-4 py-3 text-center">الوحدة</th>
                        <th className="px-4 py-3 text-center">التكلفة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(transfer.lines || []).map((line, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-mono font-bold text-blue-700">{line.itemCode}</td>
                          <td className="px-4 py-3 font-bold text-slate-800">{line.itemNameAr || line.itemCode}</td>
                          <td className="px-4 py-3 text-center font-bold text-slate-900 bg-slate-50/40">{line.quantity}</td>
                          <td className="px-4 py-3 text-center text-slate-600 font-semibold">{line.unitNameAr || line.unitCode || 'وحدة'}</td>
                          <td className="px-4 py-3 text-center font-mono text-slate-600">{(line.unitCost || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Workflow Actions Section */}
              <div className="border-t border-slate-200 pt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-[11px] text-slate-400 font-semibold">
                  الإجراءات المتاحة حسب حالة المستند وصلاحية المستخدم الحالي
                </div>
                
                <div className="flex items-center gap-2">
                  
                  {/* DRAFT STATE ACTIONS */}
                  {transfer.status === 'draft' && (
                    <>
                      {/* Submit for Approval (for transfer/return) */}
                      {(transfer.txnType === 'internal_transfer' || transfer.txnType === 'return') && hasPermission('submit_approval') && (
                        <Button 
                          variant="primary" 
                          size="sm" 
                          onClick={() => submitMutation.mutate()}
                          disabled={isPendingAction}
                          className="gap-2 bg-blue-600 hover:bg-blue-700"
                        >
                          <Send size={14} />
                          {submitMutation.isPending ? 'جاري التقديم...' : 'تقديم طلب للاعتماد'}
                        </Button>
                      )}

                      {/* Confirm (for single-node: consumption, waste, damage, disposal) */}
                      {transfer.txnType !== 'internal_transfer' && transfer.txnType !== 'return' && hasPermission('confirm_transfer') && (
                        <Button 
                          variant="primary" 
                          size="sm" 
                          onClick={() => confirmMutation.mutate()}
                          disabled={isPendingAction}
                          className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                        >
                          <CheckCircle2 size={14} />
                          {confirmMutation.isPending ? 'جاري التأكيد...' : 'تأكيد وحسم الرصيد'}
                        </Button>
                      )}
                    </>
                  )}

                  {/* PENDING APPROVAL ACTIONS */}
                  {transfer.status === 'pending_approval' && hasPermission('approve_transfer') && (
                    <Button 
                      variant="primary" 
                      size="sm" 
                      onClick={() => approveMutation.mutate()}
                      disabled={isPendingAction}
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Check size={14} />
                      {approveMutation.isPending ? 'جاري الاعتماد...' : 'اعتماد الطلب'}
                    </Button>
                  )}

                  {/* APPROVED ACTIONS */}
                  {transfer.status === 'approved' && hasPermission('dispatch_transfer') && (
                    <Button 
                      variant="primary" 
                      size="sm" 
                      onClick={() => dispatchMutation.mutate()}
                      disabled={isPendingAction}
                      className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                    >
                      <Truck size={14} />
                      {dispatchMutation.isPending ? 'جاري الشحن...' : 'شحن وصرف البضاعة'}
                    </Button>
                  )}

                  {/* SHIPPED ACTIONS */}
                  {transfer.status === 'shipped' && hasPermission('receive_transfer') && (
                    <Button 
                      variant="primary" 
                      size="sm" 
                      onClick={() => receiveMutation.mutate()}
                      disabled={isPendingAction}
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                    >
                      <PackageCheck size={14} />
                      {receiveMutation.isPending ? 'جاري الاستلام...' : 'تأكيد استلام الشحنة'}
                    </Button>
                  )}

                  {/* CANCEL ACTION (Available for active non-final states) */}
                  {transfer.status !== 'confirmed' && transfer.status !== 'cancelled' && hasPermission('cancel_transfer') && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => cancelMutation.mutate()}
                      disabled={isPendingAction}
                      className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <XCircle size={14} />
                      {cancelMutation.isPending ? 'جاري الإلغاء...' : 'إلغاء الحركة'}
                    </Button>
                  )}

                </div>
              </div>

            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default TransferDetailsModal;
