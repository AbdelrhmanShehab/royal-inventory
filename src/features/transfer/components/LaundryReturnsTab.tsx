import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Sparkles, 
  RotateCcw, 
  Search, 
  PackageCheck, 
  CheckCircle2, 
  Clock, 
  Building2, 
  ChevronDown, 
  ChevronUp, 
  Layers
} from 'lucide-react';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import EmptyState from '../../../components/ui/EmptyState';
import { laundryApi } from '../../../api/laundry.api';
import { useWarehouseScope } from '../../../hooks/useWarehouseScope';
import ReceiveCleanLaundryModal from '../dialogs/ReceiveCleanLaundryModal';
import type { LaundryTransfer, LaundryReturn } from '../../../types/laundry';

interface LaundryReturnsTabProps {
  onSuccess: (message: string) => void;
}

export default function LaundryReturnsTab({ onSuccess }: LaundryReturnsTabProps) {
  const { currentNodeId, isGlobalAdmin, currentNodeName } = useWarehouseScope();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [expandedTransferId, setExpandedTransferId] = useState<number | null>(null);

  // Modal State
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [selectedTransferForReceive, setSelectedTransferForReceive] = useState<LaundryTransfer | null>(null);
  const [selectedReturnForReceive, setSelectedReturnForReceive] = useState<LaundryReturn | null>(null);

  // 1. Fetch Laundry Transfers
  const { 
    data: transfers = [], 
    isLoading: isLoadingTransfers, 
    refetch: refetchTransfers 
  } = useQuery({
    queryKey: ['laundry-transfers', currentNodeId, isGlobalAdmin],
    queryFn: laundryApi.getTransfers
  });

  // 2. Fetch Laundry Returns
  const { 
    data: returns = [], 
    isLoading: isLoadingReturns, 
    refetch: refetchReturns 
  } = useQuery({
    queryKey: ['laundry-returns', currentNodeId, isGlobalAdmin],
    queryFn: laundryApi.getReturns
  });

  // Filter transfers scoped to current warehouse
  const scopedTransfers = useMemo(() => {
    return transfers
      .filter(t => {
        if (!isGlobalAdmin && currentNodeId) {
          return Number(t.fromWarehouseId) === currentNodeId;
        }
        return true;
      })
      .sort((a, b) => Number(b.id) - Number(a.id));
  }, [transfers, currentNodeId, isGlobalAdmin]);

  // Filter returns scoped to current warehouse transfers
  const scopedReturns = useMemo(() => {
    const scopedTransferIds = new Set(scopedTransfers.map(t => t.id));
    return returns.filter(r => scopedTransferIds.has(r.transferId));
  }, [returns, scopedTransfers]);

  // Build active transfers (transfers that have outstanding items at the laundry)
  const activeLaundryTransfers = useMemo(() => {
    return scopedTransfers.filter(t => {
      // If transfer status is sent or partially_received or items remaining > 0
      return t.status === 'sent' || t.status === 'received' || t.status === 'partially_received';
    });
  }, [scopedTransfers]);

  // Client search filtering
  const filteredTransfers = useMemo(() => {
    return scopedTransfers.filter(t => {
      // Status filter
      const isDone = t.status === 'received' && t.returnStatus === 'completed';
      if (statusFilter === 'active' && isDone) return false;
      if (statusFilter === 'completed' && !isDone) return false;

      // Text query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const idMatch = t.id.toString().includes(q);
      const whMatch = (t.fromWarehouseName || '').toLowerCase().includes(q);
      const notesMatch = (t.notes || '').toLowerCase().includes(q);
      return idMatch || whMatch || notesMatch;
    });
  }, [scopedTransfers, statusFilter, searchQuery]);

  // Compute summary metrics
  const totalTransfersCount = scopedTransfers.length;
  const activeAtLaundryCount = activeLaundryTransfers.length;
  const completedReturnsCount = scopedReturns.filter(r => r.status === 'completed').length;
  const pendingReturnsCount = scopedReturns.filter(r => r.status === 'draft' || r.status === 'pending' || r.status === 'partial_received').length;

  const handleOpenReceive = (transfer?: LaundryTransfer, ret?: LaundryReturn) => {
    setSelectedTransferForReceive(transfer || null);
    setSelectedReturnForReceive(ret || null);
    setIsReceiveModalOpen(true);
  };

  const handleToggleExpand = (id: number) => {
    setExpandedTransferId(prev => prev === id ? null : id);
  };

  const isLoading = isLoadingTransfers || isLoadingReturns;

  return (
    <div className="flex flex-col gap-5 select-none" dir="rtl">
      
      {/* Top Banner & Action Controls */}
      <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
              <Sparkles size={18} className="text-emerald-600 animate-pulse" />
              إدارة واستلام مرتجعات المغسلة
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              متابعة البياضات المرسلة للمغسلة واعتماد استلام البياضات النظيفة وإعادتها للرصيد الفعلي فورياً — {currentNodeName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleOpenReceive()}
              className="gap-2 shadow-xs bg-emerald-600 hover:bg-emerald-700 font-extrabold cursor-pointer"
            >
              <PackageCheck size={16} />
              استلام بياضات نظيفة من المغسلة
            </Button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          
          <div 
            onClick={() => setStatusFilter('all')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              statusFilter === 'all' 
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs' 
                : 'bg-slate-50/80 text-slate-700 border-slate-200/80 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold">إجمالي حركات المغسلة</span>
              <Layers size={15} className={statusFilter === 'all' ? 'text-slate-300' : 'text-slate-500'} />
            </div>
            <div className="text-lg font-black mt-1">
              {totalTransfersCount} <span className="text-xs font-normal">شحنة</span>
            </div>
          </div>

          <div 
            onClick={() => setStatusFilter('active')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              statusFilter === 'active' 
                ? 'bg-amber-600 text-white border-amber-600 shadow-xs' 
                : 'bg-amber-50/60 text-amber-900 border-amber-200/80 hover:bg-amber-100/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold">شحنات معلقة قيد الغسيل</span>
              <Clock size={15} className={statusFilter === 'active' ? 'text-white' : 'text-amber-700'} />
            </div>
            <div className="text-lg font-black mt-1">
              {activeAtLaundryCount} <span className="text-xs font-normal">شحنة بالمغسلة</span>
            </div>
          </div>

          <div 
            onClick={() => setStatusFilter('active')}
            className="p-3 rounded-xl border bg-orange-50/60 text-orange-900 border-orange-200/80 hover:bg-orange-100/60 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold">مرتجعات بانتظار الاعتماد</span>
              <RotateCcw size={15} className="text-orange-700" />
            </div>
            <div className="text-lg font-black mt-1">
              {pendingReturnsCount} <span className="text-xs font-normal">مستند إرجاع</span>
            </div>
          </div>

          <div 
            onClick={() => setStatusFilter('completed')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              statusFilter === 'completed' 
                ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs' 
                : 'bg-emerald-50/60 text-emerald-900 border-emerald-200/80 hover:bg-emerald-100/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold">شحنات مستلمة ومغلقة</span>
              <CheckCircle2 size={15} className={statusFilter === 'completed' ? 'text-white' : 'text-emerald-700'} />
            </div>
            <div className="text-lg font-black mt-1">
              {completedReturnsCount} <span className="text-xs font-normal">شحنة مستلمة</span>
            </div>
          </div>

        </div>

        {/* Search & Filter Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          
          <div className="relative flex items-center col-span-2">
            <Search size={16} className="absolute right-3 text-slate-400 pointer-events-none" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث برقم الشحنة، المستودع، أو تفاصيل الملاحظات..."
              className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 text-xs rounded-xl placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 font-semibold"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-xs rounded-xl text-slate-700 font-semibold focus:outline-none focus:border-emerald-600"
            >
              <option value="all">جميع الشحنات والمرتجعات</option>
              <option value="active">شحنات جارية / معلقة بالمغسلة</option>
              <option value="completed">شحنات مستلمة ومغلقة بالكامل</option>
            </select>
          </div>

        </div>
      </div>

      {/* Main Table or Loading Skeleton */}
      {isLoading ? (
        <Card className="border-slate-200/60 p-6 shadow-xs">
          <div className="space-y-3 animate-pulse">
            <div className="h-10 bg-slate-100 rounded-lg w-full"></div>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-14 bg-slate-50 rounded-lg w-full"></div>
            ))}
          </div>
        </Card>
      ) : filteredTransfers.length === 0 ? (
        <EmptyState 
          title="لا توجد شحنات مغسلة مطابقة" 
          description="لم نجد أي حركات تحويل أو مرتجعات مغسلة مسجلة لهذا المستودع تطابق معايير التصفية."
        />
      ) : (
        <Card className="border-slate-200/60 overflow-hidden shadow-xs">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-right border-collapse select-none">
              <thead className="bg-slate-50/80 border-b border-slate-200 sticky top-0 text-slate-500 text-xs font-bold">
                <tr>
                  <th className="px-5 py-3.5">رقم الحركة</th>
                  <th className="px-5 py-3.5">المستودع المصدر</th>
                  <th className="px-5 py-3.5">تاريخ الإرسال</th>
                  <th className="px-5 py-3.5">ملاحظات</th>
                  <th className="px-5 py-3.5">حالة الشحنة بالمغسلة</th>
                  <th className="px-5 py-3.5">حالة المرتجع النظيف</th>
                  <th className="px-5 py-3.5 text-center">الإجراءات التشغيلية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredTransfers.map((t) => {
                  const isExpanded = expandedTransferId === t.id;
                  const isCompleted = t.returnStatus === 'completed';
                  return (
                    <React.Fragment key={t.id}>
                      <tr 
                        className={`transition-colors ${
                          (t.status === 'sent' || t.status === 'dispatched')
                            ? 'bg-amber-50/70 border-r-4 border-r-amber-500 hover:bg-amber-100/50'
                            : isExpanded ? 'bg-slate-50/50' : 'hover:bg-slate-50/70'
                        }`}
                      >
                        {/* Transfer ID */}
                        <td className="px-5 py-3.5 font-mono font-extrabold text-slate-800">
                          <div className="flex items-center gap-2">
                            <span className="text-blue-700 text-sm font-black">#{t.id}</span>
                            {(t.status === 'sent' || t.status === 'dispatched') && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-500 text-white shadow-2xs animate-pulse">
                                <Sparkles size={11} />
                                طلب جديد
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Warehouse */}
                        <td className="px-5 py-3.5 font-bold text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <Building2 size={14} className="text-slate-400 shrink-0" />
                            <span>{t.fromWarehouseName || `مستودع ${t.fromWarehouseId}`}</span>
                          </div>
                        </td>

                        {/* Date */}
                        <td className="px-5 py-3.5 text-slate-500 font-semibold">
                          {new Date(t.createdAt).toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>

                        {/* Notes */}
                        <td className="px-5 py-3.5 text-slate-600 max-w-xs truncate font-medium">
                          {t.notes || '—'}
                        </td>

                        {/* Laundry Status */}
                        <td className="px-5 py-3.5">
                          {t.status === 'sent' && (
                            <Badge variant="warning" className="font-bold">
                              مرسلة للمغسلة
                            </Badge>
                          )}
                          {t.status === 'received' && (
                            <Badge variant="info" className="font-bold">
                              مستلمة بالمغسلة
                            </Badge>
                          )}
                          {t.status === 'partially_received' && (
                            <Badge variant="info" className="font-bold">
                              استلام جزئي بالمغسلة
                            </Badge>
                          )}
                          {t.status === 'draft' && (
                            <Badge variant="neutral" className="font-bold">
                              مسودة جارية
                            </Badge>
                          )}
                        </td>

                        {/* Return Status */}
                        <td className="px-5 py-3.5">
                          {isCompleted ? (
                            <Badge variant="success" className="font-bold gap-1 inline-flex items-center">
                              <CheckCircle2 size={12} />
                              مستلم بالكامل بالمستودع
                            </Badge>
                          ) : t.returnId ? (
                            <Badge variant="warning" className="font-bold gap-1 inline-flex items-center animate-pulse">
                              <RotateCcw size={12} />
                              مرتجع جاهز للاعتماد #{t.returnId}
                            </Badge>
                          ) : (
                            <Badge variant="neutral" className="font-semibold text-slate-400">
                              قيد الغسيل
                            </Badge>
                          )}
                        </td>

                        {/* Action Buttons */}
                        <td className="px-5 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            
                            {/* Primary Button: Accept / Receive Clean Linens */}
                            {!isCompleted && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleOpenReceive(t)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold gap-1.5 shadow-xs py-1 px-3 cursor-pointer"
                              >
                                <PackageCheck size={14} />
                                استلام المرتجع النظيف
                              </Button>
                            )}

                            {/* Secondary Expand Details Button */}
                            <button
                              onClick={() => handleToggleExpand(t.id)}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                              title="عرض تفاصيل الأصناف"
                            >
                              {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                            </button>

                          </div>
                        </td>
                      </tr>

                      {/* Expanded Item Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 border-b border-slate-200">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
                              <div className="flex items-center justify-between">
                                <h4 className="font-extrabold text-slate-800 flex items-center gap-2 text-xs">
                                  <Layers size={15} className="text-emerald-600" />
                                  تفاصيل الأصناف والكميات المعلقة في حركة المغسلة #{t.id}
                                </h4>
                                {!isCompleted && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenReceive(t)}
                                    className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 text-[11px] font-extrabold gap-1.5"
                                  >
                                    <Sparkles size={13} />
                                    تسجيل استلام نظيف لهذه الحركة
                                  </Button>
                                )}
                              </div>

                              <p className="text-[11px] text-slate-500 font-medium">
                                تتبع دقيق للبياضات: بمجرد اعتماد الاستلام يتم إرجاع الكميات المحددة فورياً إلى الرصيد الفعلي للمستودع وخصمها من رصيد المغسلة.
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Receive Clean Laundry Modal */}
      <ReceiveCleanLaundryModal
        isOpen={isReceiveModalOpen}
        onClose={() => {
          setIsReceiveModalOpen(false);
          setSelectedTransferForReceive(null);
          setSelectedReturnForReceive(null);
        }}
        onSuccess={(msg) => {
          onSuccess(msg);
          refetchTransfers();
          refetchReturns();
        }}
        preselectedTransfer={selectedTransferForReceive}
        preselectedReturn={selectedReturnForReceive}
        activeTransfers={activeLaundryTransfers}
      />

    </div>
  );
}
