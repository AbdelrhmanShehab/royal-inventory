import { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  Plus, 
  Search, 
  Check, 
  AlertCircle, 
  X,
  ArrowDownLeft,
  ArrowUpRight,
  PackageCheck,
  Truck,
  Inbox,
  Send,
  Sparkles
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import Button from '../../../components/ui/Button';
import PermissionGate from '../../../components/auth/PermissionGate';
import { useTransfersList } from '../hooks/useTransfers';
import TransferTable from '../tables/TransferTable';
import { TransferTableSkeleton } from '../tables/TransferSkeleton';
import CreateTransferDialog from '../dialogs/CreateTransferDialog';
import TransferDetailsDialog from '../dialogs/TransferDetailsDialog';
import LaundryReturnsTab from '../components/LaundryReturnsTab';
import { laundryApi } from '../../../api/laundry.api';
import { TRANSFER_PERMISSIONS } from '../constants/transfer.constants';
import { useWarehouseScope } from '../../../hooks/useWarehouseScope';

interface TransferPageProps {
  defaultTab?: 'all' | 'incoming' | 'outgoing' | 'laundry';
}

export default function TransferPage({ defaultTab = 'all' }: TransferPageProps) {
  const { currentNodeId, isGlobalAdmin, currentNodeName } = useWarehouseScope();
  const [activeTab, setActiveTab] = useState<'all' | 'incoming' | 'outgoing' | 'laundry'>(defaultTab);

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTransferId, setSelectedTransferId] = useState<number | string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterTxnType, setFilterTxnType] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Notifications
  const [pageSuccess, setPageSuccess] = useState<string | null>(null);

  const triggerSuccess = (msg: string) => {
    setPageSuccess(msg);
    setTimeout(() => setPageSuccess(null), 5000);
  };

  // React Query hook using node-scoped transferKeys
  const { data: transfers = [], isLoading, isError, error, refetch } = useTransfersList();

  // Tab Filtering & Client side searching
  const filteredTransfers = transfers.filter(item => {
    // 1. Tab filtering
    if (activeTab === 'incoming' && !isGlobalAdmin && currentNodeId) {
      if (Number(item.toNodeId) !== currentNodeId) return false;
    }
    if (activeTab === 'outgoing' && !isGlobalAdmin && currentNodeId) {
      if (Number(item.fromNodeId) !== currentNodeId) return false;
    }

    // 2. Status & TxnType filtering
    const matchesStatus = filterStatus === 'pending_or_draft'
      ? (item.status === 'pending_approval' || item.status === 'draft')
      : (filterStatus ? item.status === filterStatus : true);
    const matchesTxnType = filterTxnType 
      ? (filterTxnType === 'laundry' ? (item.txnType === 'laundry' || Number(item.toNodeId) === 29) : item.txnType === filterTxnType)
      : true;
    
    const query = searchQuery.toLowerCase().trim();
    if (!query) return matchesStatus && matchesTxnType;

    const idMatch = item.id.toString().includes(query);
    const fromMatch = (item.fromNodeNameAr || '').toLowerCase().includes(query);
    const toMatch = (item.toNodeNameAr || '').toLowerCase().includes(query);
    const creatorMatch = (item.createdByNameAr || item.createdBy || '').toString().toLowerCase().includes(query);

    return matchesStatus && matchesTxnType && (idMatch || fromMatch || toMatch || creatorMatch);
  }).sort((a, b) => Number(b.id) - Number(a.id));

  // Query laundry returns and active transfers for live laundry counts
  const { data: laundryReturns = [] } = useQuery({
    queryKey: ['laundry-returns', currentNodeId, isGlobalAdmin],
    queryFn: laundryApi.getReturns
  });
  const pendingLaundryCount = laundryReturns.filter(r => r.status === 'draft' || r.status === 'pending' || r.status === 'partial_received').length;

  // Calculate counts for stats
  const incomingPendingCount = transfers.filter(t => (isGlobalAdmin || Number(t.toNodeId) === currentNodeId) && t.status === 'pending_approval').length;
  const outgoingPendingDraftCount = transfers.filter(t => (isGlobalAdmin || Number(t.fromNodeId) === currentNodeId) && (t.status === 'pending_approval' || t.status === 'draft')).length;
  const outgoingApprovedCount = transfers.filter(t => (isGlobalAdmin || Number(t.fromNodeId) === currentNodeId) && t.status === 'approved').length;
  const shippedInTransitCount = transfers.filter(t => (isGlobalAdmin || Number(t.toNodeId) === currentNodeId || Number(t.fromNodeId) === currentNodeId) && t.status === 'shipped').length;

  return (
    <div className="flex flex-col gap-6 font-arabic select-none" dir="rtl">
      
      {/* Top Banner & Controls */}
      <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <ClipboardList size={20} className="text-blue-600 animate-pulse" />
              إدارة حركات المخزون وطلبات التحويل (COMSYS Enterprise ERP)
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              مسار تبادلي بين المستودعات (2-Party Transfer Workflow) — {currentNodeName}
            </p>
          </div>
          <div className="flex gap-2">
            <PermissionGate permission={TRANSFER_PERMISSIONS.CREATE_DRAFT}>
              <Button 
                variant="primary" 
                size="sm" 
                onClick={() => setIsCreateOpen(true)} 
                className="gap-2 shadow-xs bg-blue-600 hover:bg-blue-700 font-bold"
              >
                <Plus size={15} />
                إنشاء مستند حركة جديد
              </Button>
            </PermissionGate>
          </div>
        </div>

        {/* Workflow Stats Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          
          {/* Card 1: Incoming Pending */}
          <div 
            onClick={() => {
              if (activeTab === 'incoming' && filterStatus === 'pending_approval') {
                setActiveTab('all');
                setFilterStatus('');
              } else {
                setActiveTab('incoming');
                setFilterStatus('pending_approval');
              }
            }}
            className={`cursor-pointer transition-all duration-200 rounded-xl p-3 flex items-center justify-between border ${
              activeTab === 'incoming' && filterStatus === 'pending_approval'
                ? 'bg-amber-100/90 border-amber-500 shadow-md ring-2 ring-amber-400/50 scale-[1.02]'
                : 'bg-amber-50/60 border-amber-200/80 hover:bg-amber-100/60 hover:border-amber-300 hover:shadow-xs'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                <Inbox size={16} />
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[10px] text-amber-700 font-bold">طلبات واردة بانتظار الاعتماد</span>
                <span className="text-xs font-extrabold text-amber-900">{incomingPendingCount} مستند</span>
              </div>
            </div>
            {activeTab === 'incoming' && filterStatus === 'pending_approval' && (
              <span className="text-[9px] bg-amber-600 text-white px-1.5 py-0.5 rounded font-bold">مُفعل</span>
            )}
          </div>

          {/* Card 2: Outgoing Pending / Draft */}
          <div 
            onClick={() => {
              if (activeTab === 'outgoing' && (filterStatus === 'pending_or_draft' || filterStatus === 'pending_approval')) {
                setActiveTab('all');
                setFilterStatus('');
              } else {
                setActiveTab('outgoing');
                setFilterStatus('pending_or_draft');
              }
            }}
            className={`cursor-pointer transition-all duration-200 rounded-xl p-3 flex items-center justify-between border ${
              activeTab === 'outgoing' && (filterStatus === 'pending_or_draft' || filterStatus === 'pending_approval')
                ? 'bg-orange-100/90 border-orange-500 shadow-md ring-2 ring-orange-400/50 scale-[1.02]'
                : 'bg-orange-50/60 border-orange-200/80 hover:bg-orange-100/60 hover:border-orange-300 hover:shadow-xs'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-800 flex items-center justify-center font-bold">
                <Send size={16} />
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[10px] text-orange-700 font-bold">طلبات صادرة بانتظار الاعتماد</span>
                <span className="text-xs font-extrabold text-orange-900">{outgoingPendingDraftCount} مستند</span>
              </div>
            </div>
            {activeTab === 'outgoing' && (filterStatus === 'pending_or_draft' || filterStatus === 'pending_approval') && (
              <span className="text-[9px] bg-orange-600 text-white px-1.5 py-0.5 rounded font-bold">مُفعل</span>
            )}
          </div>

          {/* Card 3: Outgoing Approved */}
          <div 
            onClick={() => {
              if (activeTab === 'outgoing' && filterStatus === 'approved') {
                setActiveTab('all');
                setFilterStatus('');
              } else {
                setActiveTab('outgoing');
                setFilterStatus('approved');
              }
            }}
            className={`cursor-pointer transition-all duration-200 rounded-xl p-3 flex items-center justify-between border ${
              activeTab === 'outgoing' && filterStatus === 'approved'
                ? 'bg-blue-100/90 border-blue-500 shadow-md ring-2 ring-blue-400/50 scale-[1.02]'
                : 'bg-blue-50/60 border-blue-200/80 hover:bg-blue-100/60 hover:border-blue-300 hover:shadow-xs'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                <Truck size={16} />
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[10px] text-blue-700 font-bold">طلبات معتمدة جاهزة للشحن</span>
                <span className="text-xs font-extrabold text-blue-900">{outgoingApprovedCount} مستند</span>
              </div>
            </div>
            {activeTab === 'outgoing' && filterStatus === 'approved' && (
              <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold">مُفعل</span>
            )}
          </div>

          {/* Card 4: Shipped in Transit */}
          <div 
            onClick={() => {
              if (filterStatus === 'shipped') {
                setActiveTab('all');
                setFilterStatus('');
              } else {
                setActiveTab('all');
                setFilterStatus('shipped');
              }
            }}
            className={`cursor-pointer transition-all duration-200 rounded-xl p-3 flex items-center justify-between border ${
              filterStatus === 'shipped'
                ? 'bg-indigo-100/90 border-indigo-500 shadow-md ring-2 ring-indigo-400/50 scale-[1.02]'
                : 'bg-indigo-50/60 border-indigo-200/80 hover:bg-indigo-100/60 hover:border-indigo-300 hover:shadow-xs'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold">
                <PackageCheck size={16} />
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[10px] text-indigo-700 font-bold">شحنات جارية في الطريق</span>
                <span className="text-xs font-extrabold text-indigo-900">{shippedInTransitCount} مستند</span>
              </div>
            </div>
            {filterStatus === 'shipped' && (
              <span className="text-[9px] bg-indigo-600 text-white px-1.5 py-0.5 rounded font-bold">مُفعل</span>
            )}
          </div>

          {/* Card 5: Laundry Returns */}
          <div 
            onClick={() => {
              if (activeTab === 'laundry') {
                setActiveTab('all');
              } else {
                setActiveTab('laundry');
              }
            }}
            className={`cursor-pointer transition-all duration-200 rounded-xl p-3 flex items-center justify-between border ${
              activeTab === 'laundry'
                ? 'bg-emerald-100/90 border-emerald-500 shadow-md ring-2 ring-emerald-400/50 scale-[1.02]'
                : 'bg-emerald-50/60 border-emerald-200/80 hover:bg-emerald-100/60 hover:border-emerald-300 hover:shadow-xs'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                <Sparkles size={16} />
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[10px] text-emerald-700 font-bold">مرتجع واستلام المغسلة</span>
                <span className="text-xs font-extrabold text-emerald-900">{pendingLaundryCount > 0 ? `${pendingLaundryCount} بانتظار الاستلام` : 'استلام بياضات'}</span>
              </div>
            </div>
            {activeTab === 'laundry' && (
              <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold">مُفعل</span>
            )}
          </div>

        </div>

        {/* Tab Navigation Header */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-4">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ClipboardList size={14} />
            جميع الحركات
          </button>
          
          <button
            onClick={() => setActiveTab('incoming')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'incoming'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ArrowDownLeft size={14} />
            التحويلات الواردة (إلى {currentNodeName})
          </button>

          <button
            onClick={() => setActiveTab('outgoing')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'outgoing'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ArrowUpRight size={14} />
            التحويلات الصادرة (من {currentNodeName})
          </button>

          <button
            onClick={() => setActiveTab('laundry')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'laundry'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Sparkles size={14} />
            مرتجع المغسلة (استلام البياضات)
            {pendingLaundryCount > 0 && (
              <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-extrabold animate-pulse">
                {pendingLaundryCount}
              </span>
            )}
          </button>
        </div>

        {/* Search & Filters Grid (Only shown when not in laundry tab) */}
        {activeTab !== 'laundry' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Search Input */}
            <div className="relative flex items-center">
              <Search size={16} className="absolute right-3 text-slate-400 pointer-events-none" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث برقم المستند، المستودع، أو المنشئ..."
                className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 text-xs rounded-xl placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-semibold"
              />
            </div>

            {/* Status Filter */}
            <div className="flex flex-col gap-1">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-xs rounded-xl text-slate-700 font-semibold focus:outline-none focus:border-blue-500"
              >
                <option value="">جميع حالات المستندات</option>
                <option value="pending_or_draft">بانتظار الاعتماد والمسودات (Pending / Draft)</option>
                <option value="draft">مسودة (Draft)</option>
                <option value="pending_approval">بانتظار الاعتماد (Pending Approval)</option>
                <option value="approved">معتمد (Approved)</option>
                <option value="shipped">مشحون وفي الطريق (Shipped)</option>
                <option value="confirmed">مكتمل ومستلم (Confirmed)</option>
                <option value="cancelled">ملغي/مرفوض (Cancelled)</option>
              </select>
            </div>

            {/* Txn Type Filter */}
            <div className="flex flex-col gap-1">
              <select
                value={filterTxnType}
                onChange={(e) => setFilterTxnType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-xs rounded-xl text-slate-700 font-semibold focus:outline-none focus:border-blue-500"
              >
                <option value="">جميع أنواع الحركات</option>
                <option value="internal_transfer">تحويل بين مستودعات</option>
                <option value="laundry">مغسلة (Laundry)</option>
                <option value="consumption">استهلاك تشغيلي</option>
                <option value="return">مرتجع للمخزن الرئيسي</option>
                <option value="damage">تلف مواد/أصل</option>
                <option value="waste">هدر تشغيلي</option>
                <option value="disposal">تخريد واستبعاد</option>
              </select>
            </div>

          </div>
        )}
      </div>

      {/* Success Notification Banner */}
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

      {/* Error Notification Banner */}
      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-xs font-semibold p-4 rounded-xl flex items-center justify-between animate-fade-in shadow-2xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={18} className="text-red-600 flex-shrink-0" />
            <span>{error instanceof Error ? error.message : 'تعذر تحميل بيانات الحركة المخزنية من الخادم.'}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="text-xs">إعادة المحاولة</Button>
        </div>
      )}

      {/* Main Content Area: Laundry Returns Tab vs ERP Transfers Table */}
      {activeTab === 'laundry' ? (
        <LaundryReturnsTab onSuccess={(msg) => triggerSuccess(msg)} />
      ) : isLoading ? (
        <TransferTableSkeleton />
      ) : (
        <TransferTable 
          transfers={filteredTransfers} 
          onSelect={(id) => setSelectedTransferId(id)} 
        />
      )}

      {/* Create Dialog */}
      <CreateTransferDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={(msg) => triggerSuccess(msg)}
      />

      {/* Details Dialog */}
      <TransferDetailsDialog
        transferId={selectedTransferId}
        isOpen={!!selectedTransferId}
        onClose={() => setSelectedTransferId(null)}
        onSuccess={(msg) => triggerSuccess(msg)}
      />

    </div>
  );
}
