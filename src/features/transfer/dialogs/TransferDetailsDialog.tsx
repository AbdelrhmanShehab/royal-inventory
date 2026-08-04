import React, { useState } from 'react';
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
  Check,
  History,
  Info,
  Package
} from 'lucide-react';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import PermissionGate from '../../../components/auth/PermissionGate';
import WorkflowTimeline from '../timeline/WorkflowTimeline';
import { 
  useTransferDetails, 
  useSubmitTransfer, 
  useApproveTransfer, 
  useDispatchTransfer, 
  useReceiveTransfer, 
  useCancelTransfer, 
  useConfirmTransfer 
} from '../hooks/useTransfers';
import { TRANSFER_STATUS_CONFIG, TRANSFER_TYPES_CONFIG, TRANSFER_PERMISSIONS } from '../constants/transfer.constants';

interface TransferDetailsDialogProps {
  transferId: number | string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

type TabType = 'general' | 'items' | 'workflow' | 'audit';

export const TransferDetailsDialog: React.FC<TransferDetailsDialogProps> = ({
  transferId,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [actionError, setActionError] = useState<string | null>(null);

  // React Query details hook
  const { data: transfer, isLoading, isError, error, refetch } = useTransferDetails(transferId, isOpen);

  // Workflow Action Mutations
  const submitMutation = useSubmitTransfer(transferId || '');
  const approveMutation = useApproveTransfer(transferId || '');
  const dispatchMutation = useDispatchTransfer(transferId || '');
  const receiveMutation = useReceiveTransfer(transferId || '');
  const cancelMutation = useCancelTransfer(transferId || '');
  const confirmMutation = useConfirmTransfer(transferId || '');

  const isPendingAction = 
    submitMutation.isPending || 
    approveMutation.isPending || 
    dispatchMutation.isPending || 
    receiveMutation.isPending || 
    cancelMutation.isPending || 
    confirmMutation.isPending;

  if (!isOpen || !transferId) return null;

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

        {/* Tab Navigation Header */}
        <div className="bg-slate-100/70 border-b border-slate-200 px-6 flex gap-4 text-xs font-bold shrink-0">
          {[
            { key: 'general', label: 'البيانات العامة (General)', icon: Info },
            { key: 'items', label: 'جدول الأصناف (Items)', icon: Package },
            { key: 'workflow', label: 'مسار الاعتماد (Workflow)', icon: Clock },
            { key: 'audit', label: 'سجل التعديلات (Audit Trail)', icon: History },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabType)}
              className={`py-3.5 px-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                activeTab === tab.key 
                  ? 'border-blue-600 text-blue-700 bg-white shadow-2xs font-extrabold' 
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <tab.icon size={15} />
              {tab.label}
            </button>
          ))}
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
              {/* TAB 1: GENERAL INFO */}
              {activeTab === 'general' && (
                <div className="space-y-5">
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-1">نوع الحركة:</span>
                      <span className="font-bold text-slate-800 bg-white border border-slate-200 px-2.5 py-1 rounded-lg inline-block">
                        {TRANSFER_TYPES_CONFIG[transfer.txnType]?.label || transfer.txnType}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-1">الحالة الحالية:</span>
                      <Badge variant={TRANSFER_STATUS_CONFIG[transfer.status]?.variant || 'neutral'}>
                        {TRANSFER_STATUS_CONFIG[transfer.status]?.label || transfer.status}
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-1.5">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 font-semibold">
                        <User size={13} /> منشئ المستند:
                      </span>
                      <p className="font-bold text-slate-800 text-sm">{transfer.createdByNameAr || transfer.createdBy}</p>
                      <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                        <Clock size={11} /> {transfer.createdAt ? new Date(transfer.createdAt).toLocaleString('ar-SA') : 'غير محدد'}
                      </p>
                    </div>

                    <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-1.5">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 font-semibold">
                        <Calendar size={13} /> سبب الحركة والملاحظات:
                      </span>
                      <p className="font-bold text-slate-800">{transfer.reason || 'لا يوجد سبب محدد'}</p>
                      <p className="text-[10px] text-slate-500">{transfer.notes || 'لا توجد ملاحظات إضافية'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ITEMS TABLE */}
              {activeTab === 'items' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      الأصناف المتضمنة في المستند ({transfer.lines?.length || 0})
                    </h3>
                  </div>
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
              )}

              {/* TAB 3: WORKFLOW TIMELINE */}
              {activeTab === 'workflow' && (
                <WorkflowTimeline currentStatus={transfer.status} timeline={transfer.timeline} />
              )}

              {/* TAB 4: AUDIT TRAIL */}
              {activeTab === 'audit' && (
                <div className="space-y-4 text-xs">
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                    <History size={16} className="text-blue-600" />
                    سجل التغييرات والاعتمادات النظامية (Audit Trail Log)
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
                    {(transfer.timeline || []).length === 0 ? (
                      <div className="p-4 text-center text-slate-400">لا توجد سجلات تعديل إضافية</div>
                    ) : (
                      transfer.timeline.map((entry, idx) => (
                        <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-50">
                          <div>
                            <span className="font-bold text-slate-800 text-xs">
                              تغيير الحالة إلى: {TRANSFER_STATUS_CONFIG[entry.status]?.label || entry.status}
                            </span>
                            <p className="text-[10px] text-slate-400 mt-0.5">بواسطة: {entry.updatedBy}</p>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(entry.timestamp).toLocaleString('ar-SA')}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Workflow Action Buttons Section (Wrapped in PermissionGate) */}
              <div className="border-t border-slate-200 pt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-[11px] text-slate-400 font-semibold">
                  الإجراءات المتاحة حسب حالة المستند وصلاحيات RBAC للمستخدم الحالي
                </div>
                
                <div className="flex items-center gap-2">
                  
                  {/* DRAFT ACTIONS */}
                  {transfer.status === 'draft' && (
                    <>
                      {(transfer.txnType === 'internal_transfer' || transfer.txnType === 'return') && (
                        <PermissionGate permission={TRANSFER_PERMISSIONS.SUBMIT_APPROVAL}>
                          <Button 
                            variant="primary" 
                            size="sm" 
                            onClick={() => submitMutation.mutate(undefined, {
                              onSuccess: (res) => onSuccess(res.message || 'تم التقديم للاعتماد بنجاح'),
                              onError: (err: any) => setActionError(err.response?.data?.message || err.message)
                            })}
                            disabled={isPendingAction}
                            className="gap-2 bg-blue-600 hover:bg-blue-700"
                          >
                            <Send size={14} />
                            {submitMutation.isPending ? 'جاري التقديم...' : 'تقديم طلب للاعتماد'}
                          </Button>
                        </PermissionGate>
                      )}

                      {transfer.txnType !== 'internal_transfer' && transfer.txnType !== 'return' && (
                        <PermissionGate permission={TRANSFER_PERMISSIONS.CONFIRM_TRANSFER}>
                          <Button 
                            variant="primary" 
                            size="sm" 
                            onClick={() => confirmMutation.mutate(undefined, {
                              onSuccess: (res) => onSuccess(res.message || 'تم تأكيد الحركة بنجاح'),
                              onError: (err: any) => setActionError(err.response?.data?.message || err.message)
                            })}
                            disabled={isPendingAction}
                            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                          >
                            <CheckCircle2 size={14} />
                            {confirmMutation.isPending ? 'جاري التأكيد...' : 'تأكيد وحسم الرصيد'}
                          </Button>
                        </PermissionGate>
                      )}
                    </>
                  )}

                  {/* PENDING APPROVAL ACTIONS */}
                  {transfer.status === 'pending_approval' && (
                    <PermissionGate permission={TRANSFER_PERMISSIONS.APPROVE_TRANSFER}>
                      <Button 
                        variant="primary" 
                        size="sm" 
                        onClick={() => approveMutation.mutate(undefined, {
                          onSuccess: (res) => onSuccess(res.message || 'تم الاعتماد بنجاح'),
                          onError: (err: any) => setActionError(err.response?.data?.message || err.message)
                        })}
                        disabled={isPendingAction}
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Check size={14} />
                        {approveMutation.isPending ? 'جاري الاعتماد...' : 'اعتماد الطلب'}
                      </Button>
                    </PermissionGate>
                  )}

                  {/* APPROVED ACTIONS */}
                  {transfer.status === 'approved' && (
                    <PermissionGate permission={TRANSFER_PERMISSIONS.DISPATCH_TRANSFER}>
                      <Button 
                        variant="primary" 
                        size="sm" 
                        onClick={() => dispatchMutation.mutate(undefined, {
                          onSuccess: (res) => onSuccess(res.message || 'تم الشحن والصرف بنجاح'),
                          onError: (err: any) => setActionError(err.response?.data?.message || err.message)
                        })}
                        disabled={isPendingAction}
                        className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                      >
                        <Truck size={14} />
                        {dispatchMutation.isPending ? 'جاري الشحن...' : 'شحن وصرف البضاعة'}
                      </Button>
                    </PermissionGate>
                  )}

                  {/* SHIPPED ACTIONS */}
                  {transfer.status === 'shipped' && (
                    <PermissionGate permission={TRANSFER_PERMISSIONS.RECEIVE_TRANSFER}>
                      <Button 
                        variant="primary" 
                        size="sm" 
                        onClick={() => receiveMutation.mutate(undefined, {
                          onSuccess: (res) => onSuccess(res.message || 'تم استلام الشحنة بنجاح'),
                          onError: (err: any) => setActionError(err.response?.data?.message || err.message)
                        })}
                        disabled={isPendingAction}
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                      >
                        <PackageCheck size={14} />
                        {receiveMutation.isPending ? 'جاري الاستلام...' : 'تأكيد استلام الشحنة'}
                      </Button>
                    </PermissionGate>
                  )}

                  {/* CANCEL ACTION */}
                  {transfer.status !== 'confirmed' && transfer.status !== 'cancelled' && (
                    <PermissionGate permission={TRANSFER_PERMISSIONS.CANCEL_TRANSFER}>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => cancelMutation.mutate(undefined, {
                          onSuccess: (res) => onSuccess(res.message || 'تم إلغاء المستند بنجاح'),
                          onError: (err: any) => setActionError(err.response?.data?.message || err.message)
                        })}
                        disabled={isPendingAction}
                        className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <XCircle size={14} />
                        {cancelMutation.isPending ? 'جاري الإلغاء...' : 'إلغاء الحركة'}
                      </Button>
                    </PermissionGate>
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

export default TransferDetailsDialog;
