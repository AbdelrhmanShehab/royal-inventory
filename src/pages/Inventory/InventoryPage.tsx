import { useState, useEffect } from 'react';
import { 
  ArrowUpDown, 
  Download, 
  Info, 
  Package, 
  History
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Drawer from '../../components/ui/Drawer';
import Loader from '../../components/ui/Loader';
import EmptyState from '../../components/ui/EmptyState';
import { hierarchyApi } from '../../api/hierarchy.api';
import type { StockItem } from '../../types/inventory';
import { transactionsApi } from '../../api/transactions.api';
import type { OrganizationNode } from '../../types/hierarchy';
import type { TransferTransaction } from '../../types/transaction';
import { CATEGORIES } from '../../utils/constants';

export default function InventoryPage() {
  const [nodes, setNodes] = useState<OrganizationNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [items, setItems] = useState<StockItem[]>([]);
  const [loadingNodes, setLoadingNodes] = useState(true);
  const [loadingStock, setLoadingStock] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [itemTransactions, setItemTransactions] = useState<TransferTransaction[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Filter States
  const [searchName, setSearchName] = useState('');
  const [searchSku, setSearchSku] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Sorting State
  const [sortField, setSortField] = useState<keyof StockItem>('item_code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Pagination State
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

  // Load Tree Nodes
  useEffect(() => {
    const loadNodes = async () => {
      try {
        const tree = await hierarchyApi.getTree();
        const flat = flattenNodes(tree);
        setNodes(flat);
        if (flat.length > 0) {
          setSelectedNodeId(flat[0].id);
        }
      } catch (err) {
        console.error('Error fetching tree nodes:', err);
      } finally {
        setLoadingNodes(false);
      }
    };
    loadNodes();
  }, []);

  // Fetch stock when selectedNodeId changes
  useEffect(() => {
    if (!selectedNodeId) return;
    const fetchStock = async () => {
      setLoadingStock(true);
      try {
        const stock = await hierarchyApi.getNodeStock(selectedNodeId);
        setItems(stock || []);
        setCurrentPage(1);
      } catch (err) {
        console.error('Error fetching node stock:', err);
        setItems([]);
      } finally {
        setLoadingStock(false);
      }
    };
    fetchStock();
  }, [selectedNodeId]);

  // Fetch transaction history when drawer opens for an item
  useEffect(() => {
    if (!selectedItem) return;
    const fetchHistory = async () => {
      try {
        const allTx = await transactionsApi.getTransfers();
        const itemTx = allTx.filter(tx => tx.sku === selectedItem.item_code);
        setItemTransactions(itemTx);
      } catch (err) {
        console.error('Error fetching item transfers history:', err);
      }
    };
    fetchHistory();
  }, [selectedItem]);

  // Handle Sort
  const handleSort = (field: keyof StockItem) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Filter Logic
  const filteredItems = items.filter(item => {
    const matchesName = (item.item_name_ar || '').includes(searchName);
    const matchesSku = (item.item_code || '').toLowerCase().includes(searchSku.toLowerCase());
    const matchesCategory = selectedCategory ? item.category === selectedCategory : true;
    return matchesName && matchesSku && matchesCategory;
  });

  // Sort Logic
  const sortedItems = [...filteredItems].sort((a, b) => {
    let aVal = a[sortField] ?? '';
    let bVal = b[sortField] ?? '';

    if (typeof aVal === 'string') {
      return sortOrder === 'asc' 
        ? (aVal as string).localeCompare(bVal as string) 
        : (bVal as string).localeCompare(aVal as string);
    } else {
      return sortOrder === 'asc' 
        ? (aVal as number) - (bVal as number) 
        : (bVal as number) - (aVal as number);
    }
  });

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = sortedItems.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedItems.length / itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const delta = 2;
    pages.push(1);
    const rangeStart = Math.max(2, currentPage - delta);
    const rangeEnd = Math.min(totalPages - 1, currentPage + delta);
    if (rangeStart > 2) {
      pages.push('...');
    }
    for (let i = rangeStart; i <= rangeEnd; i++) {
      pages.push(i);
    }
    if (rangeEnd < totalPages - 1) {
      pages.push('...');
    }
    if (totalPages > 1) {
      pages.push(totalPages);
    }
    return pages;
  };

  const handleRowClick = (item: StockItem) => {
    setSelectedItem(item);
    setIsDrawerOpen(true);
  };

  // Export CSV
  const handleExport = () => {
    const nodeName = nodes.find(n => n.id === selectedNodeId)?.name || 'وحدة_تشغيلية';
    const headers = ['كود الصنف,اسم الصنف,الكمية التشغيلية,الكمية المستلمة,الكمية المستهلكة,الكمية التالفة\n'];
    const rows = filteredItems.map(i => 
      `${i.item_code},${i.item_name_ar},${i.qty_operational},${i.qty_received || 0},${i.qty_consumed || 0},${i.qty_wasted || 0}`
    );
    const blob = new Blob(['\uFEFF' + headers.concat(rows.join('\n'))], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `مخزون_${nodeName}_${new Date().toISOString().substring(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loadingNodes) {
    return <div className="h-full flex items-center justify-center"><Loader size="lg" label="جاري تحميل الهيكل الإداري..." /></div>;
  }

  return (
    <div className="flex flex-col gap-6">
      
      {/* Search and Advanced Filters Panel */}
      <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs select-none">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h1 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Package size={18} className="text-blue-600" />
            استكشاف مستويات المخزون بالوحدات
          </h1>
          <div className="flex items-center gap-3">
            {/* Unit SelectorDropdown */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">الوحدة التشغيلية:</label>
              <select
                value={selectedNodeId}
                onChange={(e) => setSelectedNodeId(e.target.value)}
                className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 text-xs rounded-lg text-slate-700 font-bold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                {nodes.map(n => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            </div>
            
            <Button variant="outline" size="sm" onClick={handleExport} disabled={filteredItems.length === 0}>
              <Download size={14} />
              تصدير البيانات (CSV)
            </Button>
          </div>
        </div>

        {/* Input Filters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500">اسم الصنف</label>
            <input 
              type="text"
              value={searchName}
              onChange={(e) => { setSearchName(e.target.value); setCurrentPage(1); }}
              placeholder="ابحث بالاسم..."
              className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 text-xs rounded-lg placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500">كود الصنف (Item Code)</label>
            <input 
              type="text"
              value={searchSku}
              onChange={(e) => { setSearchSku(e.target.value); setCurrentPage(1); }}
              placeholder="ابحث بالكود..."
              className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 text-xs rounded-lg placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500">الفئة</label>
            <select
              value={selectedCategory}
              onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
              className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 text-xs rounded-lg text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">الكل</option>
              {CATEGORIES.map((cat, idx) => (
                <option key={idx} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Modern Stock Table */}
      {loadingStock ? (
        <div className="h-48 flex items-center justify-center"><Loader size="md" label="جاري تحميل رصيد المخزون للوحدة..." /></div>
      ) : currentItems.length === 0 ? (
        <EmptyState title="لا توجد أصناف مسجلة لهذه الوحدة" description="لم نجد أي أرصدة مخزنية حالياً." />
      ) : (
        <div className="flex flex-col gap-4">
          <Card className="border-slate-200/60 overflow-hidden shadow-xs">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-right border-collapse select-none">
                <thead className="bg-slate-50/75 border-b border-slate-100 sticky top-0">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 cursor-pointer hover:text-slate-800" onClick={() => handleSort('item_code')}>
                      <div className="flex items-center gap-1.5">
                        كود الصنف
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 cursor-pointer hover:text-slate-800" onClick={() => handleSort('item_name_ar')}>
                      <div className="flex items-center gap-1.5">
                        اسم الصنف التشغيلي
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 text-left" onClick={() => handleSort('qty_operational')}>
                      <div className="flex items-center gap-1.5 justify-end">
                        الرصيد التشغيلي
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 text-left">الكمية المستلمة</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 text-left">الكمية المستهلكة</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 text-left">الكمية التالفة</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 text-center">تفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentItems.map((item) => {
                    const isLow = item.qty_operational <= (item.reorder_level ?? 10);
                    const statusVariant = item.qty_operational === 0 ? 'danger' : isLow ? 'warning' : 'success';
                    const statusLabel = item.qty_operational === 0 ? 'نافذ' : isLow ? 'منخفض' : 'متوفر';

                    return (
                      <tr 
                        key={item.item_code} 
                        onClick={() => handleRowClick(item)}
                        className="hover:bg-slate-50/50 cursor-pointer transition-colors duration-150"
                      >
                        <td className="px-6 py-4 text-xs font-bold text-slate-700">{item.item_code}</td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-800">
                          <div className="flex items-center gap-2">
                            <span>{item.item_name_ar}</span>
                            <Badge variant={statusVariant as any}>{statusLabel}</Badge>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs font-extrabold text-slate-850 text-left">
                          {item.qty_operational.toLocaleString()} {item.unit || 'وحدة'}
                        </td>
                        <td className="px-6 py-4 text-xs font-semibold text-slate-600 text-left">
                          {(item.qty_received || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-xs font-semibold text-slate-600 text-left">
                          {(item.qty_consumed || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-xs font-semibold text-slate-600 text-left">
                          {(item.qty_wasted || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all cursor-pointer">
                            <Info size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Clean Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center bg-white border border-slate-200/80 px-6 py-3.5 rounded-xl shadow-xs select-none">
              <span className="text-xs text-slate-400 font-bold">
                عرض {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, filteredItems.length)} من أصل {filteredItems.length} صنف تشغيلي
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
                {getPageNumbers().map((page, idx) => {
                  if (page === '...') {
                    return (
                      <span key={`ellipsis-${idx}`} className="w-8 h-8 flex items-center justify-center text-xs text-slate-400 select-none">
                        ...
                      </span>
                    );
                  }
                  
                  return (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page as number)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        currentPage === page 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-transparent text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
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

      {/* ITEM DETAILS DRAWER */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={selectedItem ? `بطاقة تعريف الصنف: ${selectedItem.item_name_ar}` : ''}
        size="lg"
      >
        {selectedItem && (
          <div className="flex flex-col gap-6">
            
            {/* 1. Item Header Overview */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex justify-between items-center">
              <div className="flex flex-col text-right">
                <span className="text-[10px] text-slate-400 font-bold">رقم الباركود التعريفي (Code)</span>
                <span className="text-sm font-bold text-slate-800 mt-1">{selectedItem.item_code}</span>
              </div>
              <Badge variant={selectedItem.qty_operational === 0 ? 'danger' : selectedItem.qty_operational <= (selectedItem.reorder_level ?? 10) ? 'warning' : 'success'}>
                {selectedItem.qty_operational === 0 ? 'غير متوفر' : selectedItem.qty_operational <= (selectedItem.reorder_level ?? 10) ? 'مستوى منخفض' : 'متوفر'}
              </Badge>
            </div>

            {/* 2. Core Metadata Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-slate-100 rounded-xl p-3 flex flex-col text-right">
                <span className="text-[10px] text-slate-400 font-bold">الكمية المستلمة</span>
                <span className="text-xs font-bold text-slate-700 mt-1">{(selectedItem.qty_received || 0).toLocaleString()} {selectedItem.unit || 'وحدة'}</span>
              </div>
              <div className="border border-slate-100 rounded-xl p-3 flex flex-col text-right">
                <span className="text-[10px] text-slate-400 font-bold">الكمية المستهلكة</span>
                <span className="text-xs font-bold text-slate-700 mt-1">{(selectedItem.qty_consumed || 0).toLocaleString()} {selectedItem.unit || 'وحدة'}</span>
              </div>
              <div className="border border-slate-100 rounded-xl p-3 flex flex-col text-right">
                <span className="text-[10px] text-slate-400 font-bold">الكمية التالفة</span>
                <span className="text-xs font-bold text-slate-700 mt-1">{(selectedItem.qty_wasted || 0).toLocaleString()} {selectedItem.unit || 'وحدة'}</span>
              </div>
              <div className="border border-slate-100 rounded-xl p-3 flex flex-col text-right">
                <span className="text-[10px] text-slate-400 font-bold">الفئة</span>
                <span className="text-xs font-bold text-slate-700 mt-1">{selectedItem.category || 'غير مصنف'}</span>
              </div>
            </div>

            {/* 3. Operational Quantity Highlight */}
            <div className="bg-blue-50/50 border border-blue-100/50 rounded-xl p-5 flex justify-between items-center select-none">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Package size={20} />
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-xs font-bold text-slate-600">الرصيد التشغيلي الحالي</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">مسجل في بوابة العمليات</span>
                </div>
              </div>
              <div>
                <span className="text-2xl font-extrabold text-blue-700">{selectedItem.qty_operational} <span className="text-sm font-semibold">{selectedItem.unit || 'وحدة'}</span></span>
              </div>
            </div>

            {/* 4. Movement Logs */}
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <History size={14} className="text-blue-500" />
                سجل الحركة المباشرة للصنف ({itemTransactions.length})
              </h3>
              
              {itemTransactions.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                  لا توجد حركات سابقة مسجلة على هذا الصنف.
                </div>
              ) : (
                <div className="border border-slate-100 rounded-xl divide-y divide-slate-100 overflow-hidden">
                  {itemTransactions.map((tx) => (
                    <div key={tx.txnId} className="flex justify-between items-center p-3 hover:bg-slate-50/30">
                      <div className="flex flex-col text-right">
                        <span className="text-xs font-bold text-slate-800">{tx.notes || 'تحويل مخزني'}</span>
                        <span className="text-[9px] text-slate-400 mt-0.5">
                          {new Date(tx.createdAt).toLocaleDateString('ar-EG')} • بواسطة {tx.createdBy}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-extrabold text-slate-800">
                          {tx.quantity ? `${tx.quantity} ${tx.unit || ''}` : tx.referenceNo || `#${tx.txnId}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </Drawer>

    </div>
  );
}