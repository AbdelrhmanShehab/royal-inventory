import { useState, useEffect, useMemo } from 'react';
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
  Sparkles,
  Download,
  Filter,
  RotateCcw,
  Clock,
  CheckCircle2,
  XCircle,
  FileEdit
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
import { warehousesApi } from '../../../api/warehouses.api';
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
  const [filterFromNodeId, setFilterFromNodeId] = useState<number | ''>('');
  const [filterToNodeId, setFilterToNodeId] = useState<number | ''>('');
  const [filterWarehouseNodeId, setFilterWarehouseNodeId] = useState<number | ''>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Notifications
  const [pageSuccess, setPageSuccess] = useState<string | null>(null);

  const triggerSuccess = (msg: string) => {
    setPageSuccess(msg);
    setTimeout(() => setPageSuccess(null), 5000);
  };

  // React Query hook using node-scoped transferKeys
  const { data: transfers = [], isLoading, isError, error, refetch } = useTransfersList();

  // Load all warehouses list for warehouse filtering
  const { data: warehouseData } = useQuery({
    queryKey: ['all-operational-warehouses'],
    queryFn: () => warehousesApi.getOperationalWarehouses(true),
    staleTime: 5 * 60 * 1000
  });

  const allWarehouses = useMemo(() => {
    const map = new Map<number, string>();
    (warehouseData?.allWarehouses || []).forEach(w => {
      if (w.nodeId) map.set(Number(w.nodeId), w.name);
    });
    (warehouseData?.parentEntities || []).forEach(p => {
      if (p.nodeId) map.set(Number(p.nodeId), p.name);
    });
    transfers.forEach(t => {
      if (t.fromNodeId && t.fromNodeNameAr) map.set(Number(t.fromNodeId), t.fromNodeNameAr);
      if (t.toNodeId && t.toNodeNameAr) map.set(Number(t.toNodeId), t.toNodeNameAr);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [warehouseData, transfers]);

  // Tab Filtering & Client side searching
  const filteredTransfers = transfers.filter(item => {
    // 1. Tab filtering
    if (activeTab === 'incoming' && !isGlobalAdmin && currentNodeId) {
      if (Number(item.toNodeId) !== currentNodeId) return false;
    }
    if (activeTab === 'outgoing' && !isGlobalAdmin && currentNodeId) {
      if (Number(item.fromNodeId) !== currentNodeId) return false;
    }

    // 2. Status & Flow filtering
    const matchesStatus = filterStatus === 'pending_or_draft'
      ? (item.status === 'pending_approval' || item.status === 'draft')
      : (filterStatus ? item.status === filterStatus : true);
    
    // 3. TxnType filtering
    const matchesTxnType = filterTxnType 
      ? (filterTxnType === 'laundry' ? (item.txnType === 'laundry' || Number(item.toNodeId) === 29) : item.txnType === filterTxnType)
      : true;

    // 4. Warehouse Filters
    const matchesFromNode = filterFromNodeId ? Number(item.fromNodeId) === Number(filterFromNodeId) : true;
    const matchesToNode = filterToNodeId ? Number(item.toNodeId) === Number(filterToNodeId) : true;
    const matchesAnyNode = filterWarehouseNodeId 
      ? (Number(item.fromNodeId) === Number(filterWarehouseNodeId) || Number(item.toNodeId) === Number(filterWarehouseNodeId))
      : true;
    
    const query = searchQuery.toLowerCase().trim();
    if (!query) {
      return matchesStatus && matchesTxnType && matchesFromNode && matchesToNode && matchesAnyNode;
    }

    const idMatch = item.id.toString().includes(query);
    const fromMatch = (item.fromNodeNameAr || '').toLowerCase().includes(query);
    const toMatch = (item.toNodeNameAr || '').toLowerCase().includes(query);
    const creatorMatch = (item.createdByNameAr || item.creatorUsername || item.createdBy || '').toString().toLowerCase().includes(query);
    const confirmerMatch = (item.confirmerNameAr || item.confirmerUsername || '').toString().toLowerCase().includes(query);

    return matchesStatus && matchesTxnType && matchesFromNode && matchesToNode && matchesAnyNode && 
      (idMatch || fromMatch || toMatch || creatorMatch || confirmerMatch);
  }).sort((a, b) => Number(b.id) - Number(a.id));

  // Count active filters
  const activeFiltersCount = [
    filterStatus,
    filterTxnType,
    filterFromNodeId,
    filterToNodeId,
    filterWarehouseNodeId,
    searchQuery
  ].filter(Boolean).length;

  const resetAllFilters = () => {
    setFilterStatus('');
    setFilterTxnType('');
    setFilterFromNodeId('');
    setFilterToNodeId('');
    setFilterWarehouseNodeId('');
    setSearchQuery('');
  };

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

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['رقم الحركة,نوع الحركة,مستودع المصدر,مستودع الوجهة,المنشئ,التاريخ,عدد الأصناف,الحالة\n'];
    const rows = filteredTransfers.map(t =>
      `#${t.id},${t.txnType},${t.fromNodeNameAr || t.fromNodeId},${t.toNodeNameAr || t.toNodeId || '—'},${t.createdByNameAr || t.createdBy},${t.createdAt || ''},${t.itemCount},${t.status}`
    );
    const blob = new Blob(['\uFEFF' + headers.concat(rows.join('\n'))], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `حركات_وتحويلات_المخزون_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-6 font-arabic select-none" dir="rtl">
      
      {/* Top Banner & Controls */}
      <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <ClipboardList size={20} className="text-blue-600 animate-pulse" />
              إدارة الحركات والتحويلات المخزنية (COMSYS Enterprise ERP)
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              مسار تبادلي بين المستودعات ومتابعة سجل العمليات التشغيلية المعتمدة — {currentNodeName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 border-slate-200"
            >
              <Download size={14} />
              تصدير السجل (CSV)
            </Button>
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

        {/* Flow Lifecycle Stage Pipeline (فلتر مسار الاعتماد والتدفق) */}
        {activeTab !== 'laundry' && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                <Filter size={13} className="text-blue-600" />
                تصفية سريعة بمحطة مسار الحركة والاعتماد (Flow Pipeline):
              </span>
              {activeFiltersCount > 0 && (
                <button
                  onClick={resetAllFilters}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200 transition-colors"
                >
                  <RotateCcw size={11} />
                  إعادة ضبط الفلاتر ({activeFiltersCount} نشط)
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              
              {/* All */}
              <button
                onClick={() => setFilterStatus('')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 border whitespace-nowrap ${
                  filterStatus === ''
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>جميع المراحل</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${filterStatus === '' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {transfers.length}
                </span>
              </button>

              {/* Draft */}
              <button
                onClick={() => setFilterStatus(filterStatus === 'draft' ? '' : 'draft')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 border whitespace-nowrap ${
                  filterStatus === 'draft'
                    ? 'bg-slate-700 text-white border-slate-700 shadow-xs ring-2 ring-slate-400/40'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <FileEdit size={13} className="text-slate-400" />
                <span>1. مسودة (Draft)</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${filterStatus === 'draft' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {transfers.filter(t => t.status === 'draft').length}
                </span>
              </button>

              {/* Pending Approval */}
              <button
                onClick={() => setFilterStatus(filterStatus === 'pending_approval' ? '' : 'pending_approval')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 border whitespace-nowrap ${
                  filterStatus === 'pending_approval'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs ring-2 ring-amber-400/50'
                    : 'bg-amber-50/60 text-amber-900 border-amber-200/80 hover:bg-amber-100/60'
                }`}
              >
                <Clock size={13} className={filterStatus === 'pending_approval' ? 'text-white' : 'text-amber-600'} />
                <span>2. بانتظار الاعتماد</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${filterStatus === 'pending_approval' ? 'bg-amber-800 text-white' : 'bg-amber-100 text-amber-800'}`}>
                  {transfers.filter(t => t.status === 'pending_approval').length}
                </span>
              </button>

              {/* Approved */}
              <button
                onClick={() => setFilterStatus(filterStatus === 'approved' ? '' : 'approved')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 border whitespace-nowrap ${
                  filterStatus === 'approved'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-400/50'
                    : 'bg-blue-50/60 text-blue-900 border-blue-200/80 hover:bg-blue-100/60'
                }`}
              >
                <CheckCircle2 size={13} className={filterStatus === 'approved' ? 'text-white' : 'text-blue-600'} />
                <span>3. معتمد للشحن</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${filterStatus === 'approved' ? 'bg-blue-800 text-white' : 'bg-blue-100 text-blue-800'}`}>
                  {transfers.filter(t => t.status === 'approved').length}
                </span>
              </button>

              {/* Shipped */}
              <button
                onClick={() => setFilterStatus(filterStatus === 'shipped' ? '' : 'shipped')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 border whitespace-nowrap ${
                  filterStatus === 'shipped'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-400/50'
                    : 'bg-indigo-50/60 text-indigo-900 border-indigo-200/80 hover:bg-indigo-100/60'
                }`}
              >
                <Truck size={13} className={filterStatus === 'shipped' ? 'text-white' : 'text-indigo-600'} />
                <span>4. قيد التوصيل (مشحون)</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${filterStatus === 'shipped' ? 'bg-indigo-800 text-white' : 'bg-indigo-100 text-indigo-800'}`}>
                  {transfers.filter(t => t.status === 'shipped').length}
                </span>
              </button>

              {/* Confirmed / Completed */}
              <button
                onClick={() => setFilterStatus(filterStatus === 'confirmed' ? '' : 'confirmed')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 border whitespace-nowrap ${
                  filterStatus === 'confirmed'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-400/50'
                    : 'bg-emerald-50/60 text-emerald-900 border-emerald-200/80 hover:bg-emerald-100/60'
                }`}
              >
                <PackageCheck size={13} className={filterStatus === 'confirmed' ? 'text-white' : 'text-emerald-600'} />
                <span>5. مكتمل ومستلم</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${filterStatus === 'confirmed' ? 'bg-emerald-800 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                  {transfers.filter(t => t.status === 'confirmed').length}
                </span>
              </button>

              {/* Cancelled */}
              <button
                onClick={() => setFilterStatus(filterStatus === 'cancelled' ? '' : 'cancelled')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 border whitespace-nowrap ${
                  filterStatus === 'cancelled'
                    ? 'bg-red-600 text-white border-red-600 shadow-xs ring-2 ring-red-400/50'
                    : 'bg-red-50/60 text-red-900 border-red-200/80 hover:bg-red-100/60'
                }`}
              >
                <XCircle size={13} className={filterStatus === 'cancelled' ? 'text-white' : 'text-red-600'} />
                <span>ملغي / مرفوض</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${filterStatus === 'cancelled' ? 'bg-red-800 text-white' : 'bg-red-100 text-red-800'}`}>
                  {transfers.filter(t => t.status === 'cancelled').length}
                </span>
              </button>

            </div>
          </div>
        )}

        {/* Detailed Filters & Search Row (Only shown when not in laundry tab) */}
        {activeTab !== 'laundry' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-100">
            
            {/* Search Input */}
            <div className="relative flex items-center lg:col-span-2">
              <Search size={15} className="absolute right-3 text-slate-400 pointer-events-none" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث برقم المستند، الصنف، المنشئ، أو المستودع..."
                className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 text-xs rounded-xl placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-semibold"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute left-2.5 text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* From Warehouse Filter */}
            <div className="flex flex-col gap-1">
              <div className="relative">
                <select
                  value={filterFromNodeId}
                  onChange={(e) => setFilterFromNodeId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-xs rounded-xl text-slate-700 font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="">من مستودع المصدر: (الكل)</option>
                  {allWarehouses.map(w => (
                    <option key={`from-${w.id}`} value={w.id}>
                      من: {w.name} (#{w.id})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* To Warehouse Filter */}
            <div className="flex flex-col gap-1">
              <div className="relative">
                <select
                  value={filterToNodeId}
                  onChange={(e) => setFilterToNodeId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-xs rounded-xl text-slate-700 font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="">إلى مستودع الوجهة: (الكل)</option>
                  {allWarehouses.map(w => (
                    <option key={`to-${w.id}`} value={w.id}>
                      إلى: {w.name} (#{w.id})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Txn Type Filter */}
            <div className="flex flex-col gap-1">
              <select
                value={filterTxnType}
                onChange={(e) => setFilterTxnType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-xs rounded-xl text-slate-700 font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
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
