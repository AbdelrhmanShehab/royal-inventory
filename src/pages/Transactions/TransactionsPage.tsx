import { useState, useEffect } from 'react';
import {
  History,
  ArrowUpDown,
  Download
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import EmptyState from '../../components/ui/EmptyState';
import PermissionGate from '../../components/auth/PermissionGate';
import { transactionsApi } from '../../api/transactions.api';
import { hierarchyApi } from '../../api/hierarchy.api';
import CreateTransferDialog from '../../features/transfer/dialogs/CreateTransferDialog';
import TransferDetailsDialog from '../../features/transfer/dialogs/TransferDetailsDialog';
import { warehousesApi } from '../../api/warehouses.api';
import { useWarehouseScope } from '../../hooks/useWarehouseScope';
import type { TransferTransaction } from '../../types/transaction';
import type { OrganizationNode } from '../../types/hierarchy';

export default function TransactionsPage() {
  const { currentNodeId, isGlobalAdmin, currentNodeName } = useWarehouseScope();
  const [transactions, setTransactions] = useState<TransferTransaction[]>([]);
  const [nodes, setNodes] = useState<OrganizationNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState<TransferTransaction | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  // Filters State
  const [filterType, setFilterType] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Sorting & Pagination
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Flatten tree nodes helper
  const flattenNodes = (list: OrganizationNode[]): OrganizationNode[] => {
    const result: OrganizationNode[] = [];
    const recurse = (nodesList: OrganizationNode[]) => {
      for (const node of nodesList) {
        result.push(node);
        if (node.children && node.children.length > 0) {
          recurse(node.children);
        }
      }
    };
    recurse(list);
    return result;
  };

  // Load Data
  const loadData = async () => {
    try {
      const txs = await transactionsApi.getTransfers(!isGlobalAdmin && currentNodeId ? { nodeId: currentNodeId } : undefined);
      setTransactions(txs || []);
      const tree = await hierarchyApi.getTree();
      const flat = flattenNodes(tree);
      setNodes(flat);

      await warehousesApi.getWarehouses();
    } catch (err) {
      console.error('Error loading transactions data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentNodeId, isGlobalAdmin]);

  // Map node ID to name helper
  const getNodeName = (nodeId?: number | string) => {
    if (!nodeId) return '—';
    const found = nodes.find(n => Number(n.id) === Number(nodeId) || String(n.id) === String(nodeId));
    return found ? found.name : `وحدة #${nodeId}`;
  };

  // Filter logic
  const filteredTxs = transactions.filter(tx => {
    // 1. Warehouse isolation scope
    if (!isGlobalAdmin && currentNodeId) {
      const fromId = Number(tx.fromNodeId);
      const toId = Number(tx.toNodeId);
      if (fromId !== currentNodeId && toId !== currentNodeId) {
        return false;
      }
    }

    const matchesType = filterType
      ? (filterType === 'laundry' ? (tx.txnType === 'laundry' || Number(tx.toNodeId) === 29 || tx.toNodeName?.includes('مغسلة')) : (tx.txnType === filterType || (filterType === 'transfer' && tx.txnType === 'internal_transfer')))
      : true;

    const fromName = getNodeName(tx.fromNodeId);
    const toName = getNodeName(tx.toNodeId);
    const matchesUnit = filterUnit ? (
      fromName.includes(filterUnit) || toName.includes(filterUnit)
    ) : true;

    const matchesDate = filterDate ? (tx.createdAt || '').startsWith(filterDate) : true;
    const matchesStatus = filterStatus ? tx.status === filterStatus : true;
    return matchesType && matchesUnit && matchesDate && matchesStatus;
  });

  // Sort logic (defaults to latest timestamp)
  const sortedTxs = [...filteredTxs].sort((a, b) => {
    const timeA = a.createdAt || '';
    const timeB = b.createdAt || '';
    return sortOrder === 'desc'
      ? timeB.localeCompare(timeA)
      : timeA.localeCompare(timeB);
  });

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTxs = sortedTxs.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedTxs.length / itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleRowClick = (tx: TransferTransaction) => {
    setSelectedTx(tx);
    setIsDrawerOpen(true);
  };

  // Export CSV
  const handleExport = () => {
    const headers = ['رقم الحركة,النوع,من,إلى,المرجع,المنشئ,التاريخ,الحالة,ملاحظات\n'];
    const rows = filteredTxs.map(tx =>
      `${tx.txnId},${tx.txnType},${getNodeName(tx.fromNodeId)},${getNodeName(tx.toNodeId)},${tx.referenceNo || ''},${tx.createdBy},${tx.createdAt},${tx.status},${tx.notes || ''}`
    );
    const blob = new Blob(['\uFEFF' + headers.concat(rows.join('\n'))], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `حركات_المخزون_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return <div className="h-full flex items-center justify-center"><Loader size="lg" label="جاري تحميل سجل التحويلات..." /></div>;
  }

  const txTypeNames: Record<string, string> = {
    transfer: 'تحويل داخلي',
    internal_transfer: 'تحويل بين مستودعات',
    laundry: 'مغسلة',
    consumption: 'استهلاك قسم',
    return: 'مرتجع مستودع',
    damage: 'تلفيات',
    waste: 'هالك هدر',
    disposal: 'إعدام مواد'
  };

  return (
    <div className="flex flex-col gap-6">

      {/* Filters Area */}
      <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs select-none">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <History size={18} className="text-blue-600" />
              تتبع الحركات والتحويلات المخزنية
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              تتبع وتوثيق جميع الحركات والتحويلات — النطاق النشط: {currentNodeName}
            </p>
          </div>
          <div className="flex gap-2">
            <PermissionGate permission="view_reports">
              <Button variant="outline" size="sm" onClick={handleExport} disabled={filteredTxs.length === 0}>
                <Download size={14} />
                تصدير تقرير الحركات
              </Button>
            </PermissionGate>
          </div>
        </div>

        {/* Input filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500">نوع الحركة</label>
            <select
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}
              className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 text-xs rounded-lg text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">الكل</option>
              <option value="transfer">تحويل داخلي</option>
              <option value="laundry">مغسلة (Laundry)</option>
              <option value="consumption">استهلاك قسم</option>
              <option value="return">مرتجع مستودع</option>
              <option value="damage">تلفيات</option>
              <option value="waste">هالك هدر</option>
              <option value="disposal">إعدام مواد</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500">الوحدة التشغيلية</label>
            <input
              type="text"
              value={filterUnit}
              onChange={(e) => { setFilterUnit(e.target.value); setCurrentPage(1); }}
              placeholder="ابحث باسم الوحدة..."
              className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 text-xs rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500">التاريخ</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => { setFilterDate(e.target.value); setCurrentPage(1); }}
              className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 text-xs rounded-lg text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500">الحالة</label>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
              className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 text-xs rounded-lg text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">جميع الحالات</option>
              <option value="draft">مسودة (Draft)</option>
              <option value="pending_approval">بانتظار الاعتماد (Pending Approval)</option>
              <option value="approved">معتمد (Approved)</option>
              <option value="shipped">قيد التوصيل (Shipped)</option>
              <option value="confirmed">مكتمل ومؤكد (Confirmed)</option>
              <option value="cancelled">ملغي (Cancelled)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transaction Table */}
      {currentTxs.length === 0 ? (
        <EmptyState title="لا توجد حركات مطابقة لفلاتر البحث" description="يرجى تعديل معايير البحث والمحاولة مجدداً." />
      ) : (
        <div className="flex flex-col gap-4">
          <Card className="border-slate-200/60 overflow-hidden shadow-xs">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-right border-collapse select-none">
                <thead className="bg-slate-50/75 border-b border-slate-100 sticky top-0">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500">رقم الحركة</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500">نوع الحركة</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500">البيان والملاحظات</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500">من وحدة</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500">إلى وحدة</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500">المسؤول</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 cursor-pointer hover:text-slate-800" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                      <div className="flex items-center gap-1.5">
                        التاريخ
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentTxs.map((tx) => {
                    const typeVariants: Record<string, string> = {
                      transfer: 'info',
                      consumption: 'neutral',
                      return: 'success',
                      damage: 'danger',
                      waste: 'warning',
                      disposal: 'danger'
                    };
                    const typeVar = typeVariants[tx.txnType] || 'neutral';

                    return (
                      <tr
                        key={tx.txnId}
                        onClick={() => handleRowClick(tx)}
                        className="hover:bg-slate-50/50 cursor-pointer transition-colors duration-150"
                      >
                        <td className="px-6 py-4 text-xs font-bold text-slate-700">#{tx.txnId}</td>
                        <td className="px-6 py-4 text-xs">
                          <Badge variant={typeVar as any}>{txTypeNames[tx.txnType] || tx.txnType}</Badge>
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-850">
                          <div className="flex flex-col">
                            <span>{tx.notes || 'تحويل مخزني داخلي'}</span>
                            {tx.referenceNo && <span className="text-[9px] text-slate-400 mt-0.5">مرجع: {tx.referenceNo}</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500 font-semibold">{getNodeName(tx.fromNodeId)}</td>
                        <td className="px-6 py-4 text-xs text-slate-500 font-semibold">{getNodeName(tx.toNodeId)}</td>
                        <td className="px-6 py-4 text-xs text-slate-600 font-semibold">{tx.createdBy}</td>
                        <td className="px-6 py-4 text-xs text-slate-400 font-bold">{tx.createdAt}</td>
                        <td className="px-6 py-4 text-xs">
                          {(() => {
                            const statusMap: Record<string, { label: string; variant: 'neutral' | 'warning' | 'info' | 'success' | 'danger' }> = {
                              draft: { label: 'مسودة', variant: 'neutral' },
                              pending_approval: { label: 'بانتظار الاعتماد', variant: 'warning' },
                              pending: { label: 'بانتظار الاعتماد', variant: 'warning' },
                              approved: { label: 'معتمد', variant: 'info' },
                              shipped: { label: 'قيد التوصيل', variant: 'info' },
                              confirmed: { label: 'مكتمل ومؤكد', variant: 'success' },
                              completed: { label: 'مكتمل', variant: 'success' },
                              cancelled: { label: 'ملغي', variant: 'danger' }
                            };
                            const statusInfo = statusMap[tx.status] || { label: tx.status || 'مسودة', variant: 'neutral' };
                            return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
                          })()}
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
                عرض {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, filteredTxs.length)} من أصل {filteredTxs.length} حركة تشغيلية
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                >
                  السابق
                </Button>
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => handlePageChange(idx + 1)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${currentPage === idx + 1
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
                  onClick={() => handlePageChange(currentPage + 1)}
                >
                  التالي
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ENTERPRISE ERP TRANSFER DETAILS DIALOG */}
      <TransferDetailsDialog
        transferId={selectedTx?.txnId || null}
        isOpen={isDrawerOpen && !!selectedTx}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedTx(null);
        }}
        onSuccess={() => {
          loadData();
        }}
      />



      {/* ENTERPRISE ERP TRANSFER DIALOGS */}
      <CreateTransferDialog
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        onSuccess={() => { loadData(); }}
      />

    </div>
  );
}