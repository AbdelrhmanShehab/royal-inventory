import { useState, useEffect } from 'react';
import { 
  History, 
  ArrowUpDown, 
  ArrowLeftRight, 
  Download
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Drawer from '../../components/ui/Drawer';
import Loader from '../../components/ui/Loader';
import EmptyState from '../../components/ui/EmptyState';
import { transactionsApi } from '../../api/transactions.api';
import { hierarchyApi } from '../../api/hierarchy.api';
import type { TransferTransaction } from '../../types/transaction';
import type { OrganizationNode } from '../../types/hierarchy';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransferTransaction[]>([]);
  const [nodes, setNodes] = useState<OrganizationNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState<TransferTransaction | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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
      const txs = await transactionsApi.getTransfers();
      setTransactions(txs || []);
      const tree = await hierarchyApi.getTree();
      const flat = flattenNodes(tree);
      setNodes(flat);
    } catch (err) {
      console.error('Error loading transactions data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Map node ID to name helper
  const getNodeName = (nodeId?: number | string) => {
    if (!nodeId) return '—';
    const found = nodes.find(n => Number(n.id) === Number(nodeId) || String(n.id) === String(nodeId));
    return found ? found.name : `وحدة #${nodeId}`;
  };

  // Filter logic
  const filteredTxs = transactions.filter(tx => {
    const matchesType = filterType ? tx.txnType === filterType : true;
    
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
    link.setAttribute('download', `حركات_المخزون_${new Date().toISOString().substring(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return <div className="h-full flex items-center justify-center"><Loader size="lg" label="جاري تحميل سجل التحويلات..." /></div>;
  }

  const txTypeNames: Record<string, string> = {
    transfer: 'تحويل داخلي',
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
          <h1 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <History size={18} className="text-blue-600" />
            تتبع الحركات والتحويلات المخزنية
          </h1>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={filteredTxs.length === 0}>
            <Download size={14} />
            تصدير تقرير الحركات
          </Button>
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
              <option value="">الكل</option>
              <option value="completed">مكتمل</option>
              <option value="pending">معلق</option>
              <option value="cancelled">ملغي</option>
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
                          <Badge variant={tx.status === 'completed' ? 'success' : tx.status === 'pending' ? 'warning' : 'danger'}>
                            {tx.status === 'completed' ? 'مكتمل' : tx.status === 'pending' ? 'معلق' : 'ملغي'}
                          </Badge>
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
                  onClick={() => handlePageChange(currentPage + 1)}
                >
                  التالي
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TRANSACTION DETAILS DRAWER */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={selectedTx ? `تفاصيل الحركة: #${selectedTx.txnId}` : ''}
        size="md"
      >
        {selectedTx && (
          <div className="flex flex-col gap-6 select-none">
            
            {/* Header overview */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex justify-between items-center">
              <div className="flex flex-col text-right">
                <span className="text-[10px] text-slate-400 font-bold">تاريخ وتوقيت العملية</span>
                <span className="text-xs font-bold text-slate-800 mt-1">{selectedTx.createdAt}</span>
              </div>
              <Badge variant={selectedTx.status === 'completed' ? 'success' : 'neutral'}>
                {selectedTx.status === 'completed' ? 'عملية مكتملة' : 'معلقة / ملغية'}
              </Badge>
            </div>

            {/* Core details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-slate-100 rounded-xl p-3 flex flex-col text-right">
                <span className="text-[10px] text-slate-400 font-bold">نوع العملية التشغيلية</span>
                <span className="text-xs font-bold text-slate-700 mt-1">
                  {txTypeNames[selectedTx.txnType] || selectedTx.txnType}
                </span>
              </div>
              <div className="border border-slate-100 rounded-xl p-3 flex flex-col text-right">
                <span className="text-[10px] text-slate-400 font-bold">المسؤول عن الحركة</span>
                <span className="text-xs font-bold text-slate-700 mt-1">{selectedTx.createdBy}</span>
              </div>
            </div>

            {/* Transfer flow units */}
            <div className="border border-slate-150 rounded-xl p-4 flex flex-col gap-3 bg-slate-50/50">
              <span className="text-[10px] font-bold text-slate-400 text-right">مسار الحركة التشغيلي</span>
              <div className="flex justify-between items-center px-4">
                <div className="flex flex-col text-right">
                  <span className="text-[9px] text-slate-400 font-semibold">وحدة المصدر</span>
                  <span className="text-xs font-bold text-slate-700 mt-0.5">{getNodeName(selectedTx.fromNodeId)}</span>
                </div>
                <ArrowLeftRight size={16} className="text-slate-300" />
                <div className="flex flex-col text-left">
                  <span className="text-[9px] text-slate-400 font-semibold">وحدة الاستلام</span>
                  <span className="text-xs font-bold text-slate-700 mt-0.5">{getNodeName(selectedTx.toNodeId)}</span>
                </div>
              </div>
            </div>

            {/* Reference info */}
            {selectedTx.referenceNo && (
              <div className="border border-slate-100 rounded-xl p-4 flex justify-between items-center bg-blue-50/30">
                <span className="text-xs font-bold text-slate-700">رقم المرجع النظامي</span>
                <span className="text-sm font-extrabold text-blue-600">
                  {selectedTx.referenceNo}
                </span>
              </div>
            )}

            {/* Audit Notes */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold text-slate-400 text-right font-sans">بيان وملاحظات الحركة</span>
              <div className="border border-slate-100 rounded-xl p-4 bg-slate-50 text-xs text-slate-600 leading-relaxed text-right">
                {selectedTx.notes || 'لا توجد ملاحظات أو مبررات مسجلة لهذه الحركة.'}
              </div>
            </div>

          </div>
        )}
      </Drawer>

    </div>
  );
}