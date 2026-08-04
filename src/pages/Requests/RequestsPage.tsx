import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  ClipboardList, 
  Plus, 
  Search, 
  Check, 
  AlertCircle, 
  X, 
  Building2, 
  Eye
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import PermissionGate from '../../components/auth/PermissionGate';
import transfersApi from '../../api/transfers.api';
import CreateTransferModal from '../../components/transfers/CreateTransferModal';
import TransferDetailsModal from '../../components/transfers/TransferDetailsModal';
import type { TransferStatus } from '../../types/transfer';

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

export default function RequestsPage() {
  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTransferId, setSelectedTransferId] = useState<number | string | null>(null);

  // Filters & Search
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterTxnType, setFilterTxnType] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Page Notifications
  const [pageSuccess, setPageSuccess] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const triggerSuccess = (msg: string) => {
    setPageSuccess(msg);
    setPageError(null);
    setTimeout(() => setPageSuccess(null), 5000);
  };

  // React Query fetch transfers list from real backend
  const { data: transfers = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['transfers'],
    queryFn: () => transfersApi.listTransfers()
  });

  // Client-side filtering
  const filteredTransfers = transfers.filter(item => {
    const matchesStatus = filterStatus ? item.status === filterStatus : true;
    const matchesTxnType = filterTxnType ? item.txnType === filterTxnType : true;
    
    const query = searchQuery.toLowerCase().trim();
    if (!query) return matchesStatus && matchesTxnType;

    const idMatch = item.id.toString().includes(query);
    const fromMatch = (item.fromNodeNameAr || '').toLowerCase().includes(query);
    const toMatch = (item.toNodeNameAr || '').toLowerCase().includes(query);
    const creatorMatch = (item.createdByNameAr || item.createdBy || '').toString().toLowerCase().includes(query);
    const itemMatch = (item.lines || []).some(l => l.itemCode.toLowerCase().includes(query) || (l.itemNameAr || '').toLowerCase().includes(query));

    return matchesStatus && matchesTxnType && (idMatch || fromMatch || toMatch || creatorMatch || itemMatch);
  });

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTransfers = filteredTransfers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredTransfers.length / itemsPerPage);

  return (
    <div className="flex flex-col gap-6 font-arabic select-none" dir="rtl">
      
      {/* Top Banner & Action Controls */}
      <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <ClipboardList size={20} className="text-blue-600 animate-pulse" />
              إدارة حركات المخزون وطلبات التحويل (ERP Transfers)
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              متابعة طلبات التموين والتحويلات بين مستودعات وفروع المؤسسة، وإجراء مسارات الاعتماد والشحن والاستلام
            </p>
          </div>
          <div className="flex gap-2">
            <PermissionGate permission="create_draft">
              <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)} className="gap-2 shadow-xs bg-blue-600 hover:bg-blue-700">
                <Plus size={15} />
                إنشاء مستند حركة جديد
              </Button>
            </PermissionGate>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Search Box */}
          <div className="relative flex items-center">
            <Search size={16} className="absolute right-3 text-slate-400 pointer-events-none" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="ابحث برقم المستند، المستودع، أو كود الصنف..."
              className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 text-xs rounded-xl placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-semibold"
            />
          </div>

          {/* Status Filter */}
          <div className="flex flex-col gap-1">
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-xs rounded-xl text-slate-700 font-semibold focus:outline-none focus:border-blue-500"
            >
              <option value="">جميع حالات المستندات</option>
              <option value="draft">مسودة (Draft)</option>
              <option value="pending_approval">بانتظار الاعتماد (Pending Approval)</option>
              <option value="approved">معتمد (Approved)</option>
              <option value="shipped">قيد التوصيل / مشحون (Shipped)</option>
              <option value="confirmed">مكتمل ومؤكد (Confirmed)</option>
              <option value="cancelled">ملغي (Cancelled)</option>
            </select>
          </div>

          {/* Txn Type Filter */}
          <div className="flex flex-col gap-1">
            <select
              value={filterTxnType}
              onChange={(e) => { setFilterTxnType(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-xs rounded-xl text-slate-700 font-semibold focus:outline-none focus:border-blue-500"
            >
              <option value="">جميع أنواع الحركات</option>
              <option value="internal_transfer">تحويل بين مستودعات</option>
              <option value="consumption">استهلاك تشغيلي</option>
              <option value="return">مرتجع للمخزن الرئيسي</option>
              <option value="damage">تلف مواد/أصل</option>
              <option value="waste">هدر تشغيلي</option>
              <option value="disposal">تخريد واستبعاد</option>
            </select>
          </div>

        </div>
      </div>

      {/* Page Success Banner */}
      {pageSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold p-4 rounded-xl flex items-center justify-between animate-fade-in shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Check size={18} className="text-emerald-600 flex-shrink-0" />
            <span>{pageSuccess}</span>
          </div>
          <button onClick={() => setPageSuccess(null)} className="text-emerald-600 hover:text-emerald-900 cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Page Error Banner */}
      {(pageError || isError) && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-xs font-semibold p-4 rounded-xl flex items-center justify-between animate-fade-in shadow-2xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={18} className="text-red-600 flex-shrink-0" />
            <span>{pageError || (error instanceof Error ? error.message : 'تعذر تحميل سجل حركات التحويل من السيرفر.')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs">إعادة المحاولة</Button>
            <button onClick={() => setPageError(null)} className="text-red-600 hover:text-red-900 cursor-pointer">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Transactions Table Section */}
      {isLoading ? (
        <Card className="border-slate-200/60 p-6 shadow-xs">
          <div className="space-y-4 animate-pulse">
            <div className="h-10 bg-slate-100 rounded-lg w-full"></div>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-14 bg-slate-50 rounded-lg w-full"></div>
            ))}
          </div>
        </Card>
      ) : currentTransfers.length === 0 ? (
        <EmptyState title="لا توجد حركات مخزنية مطابقة" description="لم نجد أي سجلات تحويل مخزني تطابق معايير البحث أو التصفية الحالية." />
      ) : (
        <div className="flex flex-col gap-4">
          <Card className="border-slate-200/60 overflow-hidden shadow-xs">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-right border-collapse select-none">
                <thead className="bg-slate-50/80 border-b border-slate-100 sticky top-0 text-slate-500 text-xs font-bold">
                  <tr>
                    <th className="px-6 py-4">رقم المستند</th>
                    <th className="px-6 py-4">نوع الحركة</th>
                    <th className="px-6 py-4">مستودع المصدر (من)</th>
                    <th className="px-6 py-4">مستودع الوجهة (إلى)</th>
                    <th className="px-6 py-4">عدد الأصناف</th>
                    <th className="px-6 py-4">الحالة التشغيلية</th>
                    <th className="px-6 py-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentTransfers.map((item) => {
                    const statusInfo = statusLabels[item.status] || { text: item.status, variant: 'neutral' };
                    return (
                      <tr 
                        key={item.id}
                        onClick={() => setSelectedTransferId(item.id)}
                        className="hover:bg-slate-50/60 cursor-pointer transition-colors duration-150"
                      >
                        <td className="px-6 py-4 text-xs font-mono font-extrabold text-blue-700">
                          #{item.id}
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-800">
                          {txnTypeLabels[item.txnType] || item.txnType}
                        </td>
                        <td className="px-6 py-4 text-xs font-semibold text-slate-700 flex items-center gap-1.5 mt-2">
                          <Building2 size={13} className="text-slate-400" />
                          <span>{item.fromNodeNameAr || `مستودع #${item.fromNodeId}`}</span>
                        </td>
                        <td className="px-6 py-4 text-xs font-semibold text-slate-700">
                          {item.toNodeNameAr || (item.toNodeId ? `مستودع #${item.toNodeId}` : '—')}
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-600 font-mono">
                          {item.lines?.length || 0} صنف
                        </td>
                        <td className="px-6 py-4 text-xs">
                          <Badge variant={statusInfo.variant}>{statusInfo.text}</Badge>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedTransferId(item.id); }}
                            className="px-3 py-1.5 bg-slate-50 border border-slate-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 rounded-lg text-xs font-bold text-slate-600 transition-all flex items-center gap-1 mx-auto cursor-pointer"
                          >
                            <Eye size={13} />
                            عرض المستند
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center bg-white border border-slate-200/80 px-6 py-3.5 rounded-xl shadow-xs select-none">
              <span className="text-xs text-slate-400 font-bold">
                عرض {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, filteredTransfers.length)} من أصل {filteredTransfers.length} مستند
              </span>
              <div className="flex gap-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                >
                  السابق
                </Button>
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentPage(idx + 1)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      currentPage === idx + 1 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-transparent text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                >
                  التالي
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE TRANSFER MODAL */}
      <CreateTransferModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={(msg) => triggerSuccess(msg)}
      />

      {/* TRANSFER DETAILS MODAL */}
      <TransferDetailsModal
        transferId={selectedTransferId}
        isOpen={!!selectedTransferId}
        onClose={() => setSelectedTransferId(null)}
        onSuccess={(msg) => triggerSuccess(msg)}
      />

    </div>
  );
}
