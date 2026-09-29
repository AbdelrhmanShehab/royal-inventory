import React, { useState, useEffect } from 'react';
import { 
  ArrowUpDown, 
  Download, 
  Info, 
  Package, 
  History,
  Edit3,
  Sliders,
  CheckCircle2
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Drawer from '../../components/ui/Drawer';
import Modal from '../../components/ui/Modal';
import Loader from '../../components/ui/Loader';
import EmptyState from '../../components/ui/EmptyState';
import { hierarchyApi, filterHierarchyForUserScope } from '../../api/hierarchy.api';
import type { StockItem } from '../../types/inventory';
import { transactionsApi } from '../../api/transactions.api';
import type { OrganizationNode } from '../../types/hierarchy';
import type { TransferTransaction } from '../../types/transaction';
import { CATEGORIES } from '../../utils/constants';
import { useWarehouseScope } from '../../hooks/useWarehouseScope';
import { getItemReorderLevel, setItemReorderLevel } from '../../utils/reorderLevels';

export default function InventoryPage() {
  const [nodes, setNodes] = useState<OrganizationNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [items, setItems] = useState<StockItem[]>([]);
  const [loadingNodes, setLoadingNodes] = useState(true);
  const [loadingStock, setLoadingStock] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [itemTransactions, setItemTransactions] = useState<TransferTransaction[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Threshold Edit Modal State
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);
  const [itemForThreshold, setItemForThreshold] = useState<StockItem | null>(null);
  const [thresholdValue, setThresholdValue] = useState<number>(10);
  const [thresholdSuccessMsg, setThresholdSuccessMsg] = useState('');

  // Filter States
  const [searchName, setSearchName] = useState('');
  const [searchSku, setSearchSku] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'warning' | 'depleted'>('all');

  // Sorting State
  const [sortField, setSortField] = useState<keyof StockItem>('item_code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Flatten tree nodes helper (excluding organizational group containers)
  const flattenNodes = (list: OrganizationNode[]): OrganizationNode[] => {
    const result: OrganizationNode[] = [];
    const recurse = (nodesList: OrganizationNode[]) => {
      for (const node of nodesList) {
        if (!node.id.startsWith('group-') && node.type !== 'group') {
          result.push(node);
        }
        if (node.children && node.children.length > 0) {
          recurse(node.children);
        }
      }
    };
    recurse(list);
    return result;
  };

  const { currentNodeId, isGlobalAdmin, currentNodeName } = useWarehouseScope();

  // Load Tree Nodes
  useEffect(() => {
    const loadNodes = async () => {
      try {
        const tree = await hierarchyApi.getTree();
        const displayTree = currentNodeId
          ? filterHierarchyForUserScope(tree, currentNodeId)
          : tree;
        const flat = flattenNodes(displayTree);
        setNodes(flat);
        if (currentNodeId) {
          setSelectedNodeId(String(currentNodeId));
        } else if (flat.length > 0) {
          setSelectedNodeId(flat[0].id);
        }
      } catch (err) {
        console.error('Error fetching tree nodes:', err);
      } finally {
        setLoadingNodes(false);
      }
    };
    loadNodes();
  }, [currentNodeId, isGlobalAdmin]);

  // Fetch stock helper
  const fetchStockData = async (nodeId: string) => {
    if (!nodeId) return;
    setLoadingStock(true);
    try {
      const stock = await hierarchyApi.getNodeStock(nodeId);
      setItems(stock || []);
      setCurrentPage(1);
    } catch (err) {
      console.error('Error fetching node stock:', err);
      setItems([]);
    } finally {
      setLoadingStock(false);
    }
  };

  // Fetch stock when selectedNodeId changes
  useEffect(() => {
    fetchStockData(selectedNodeId);
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

  // Open Edit Threshold Modal
  const handleOpenEditThreshold = (e: React.MouseEvent, item: StockItem) => {
    e.stopPropagation();
    setItemForThreshold(item);
    setThresholdValue(getItemReorderLevel(item.item_code, item.reorder_level ?? 10));
    setThresholdSuccessMsg('');
    setIsThresholdModalOpen(true);
  };

  // Save Custom Threshold
  const handleSaveThreshold = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForThreshold) return;
    setItemReorderLevel(itemForThreshold.item_code, Number(thresholdValue));
    setThresholdSuccessMsg(`تم تحديث حد التنبيه للصنف (${itemForThreshold.item_name_ar}) إلى ${thresholdValue} وحدة!`);
    setTimeout(() => {
      setIsThresholdModalOpen(false);
      setThresholdSuccessMsg('');
      fetchStockData(selectedNodeId);
      if (selectedItem && selectedItem.item_code === itemForThreshold.item_code) {
        setSelectedItem({
          ...selectedItem,
          reorder_level: Number(thresholdValue)
        });
      }
    }, 1200);
  };

  // Handle Sort
  const handleSort = (field: keyof StockItem) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Status counts for filter chips
  const countAvailable = items.filter(i => i.qty_operational > getItemReorderLevel(i.item_code, i.reorder_level ?? 10)).length;
  const countWarning  = items.filter(i => i.qty_operational > 0 && i.qty_operational <= getItemReorderLevel(i.item_code, i.reorder_level ?? 10)).length;
  const countDepleted = items.filter(i => i.qty_operational === 0).length;

  // Filter Logic
  const filteredItems = items.filter(item => {
    const matchesName = (item.item_name_ar || '').includes(searchName);
    const matchesSku = (item.item_code || '').toLowerCase().includes(searchSku.toLowerCase());
    const matchesCategory = selectedCategory ? item.category === selectedCategory : true;
    const reorder = getItemReorderLevel(item.item_code, item.reorder_level ?? 10);
    const matchesStatus =
      statusFilter === 'all'       ? true
      : statusFilter === 'depleted'  ? item.qty_operational === 0
      : statusFilter === 'warning'   ? item.qty_operational > 0 && item.qty_operational <= reorder
      : /* available */               item.qty_operational > reorder;
    return matchesName && matchesSku && matchesCategory && matchesStatus;
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
    const headers = ['كود الصنف,اسم الصنف,الرصيد الفعلي,حد التنبيه,الكمية المستلمة,تحويلات,مغسلة,استهلاك تشغيلي,مرتجع,تالف وهدر واستبعاد\n'];
    const rows = filteredItems.map(i => 
      `${i.item_code},"${(i.item_name_ar || '').replace(/"/g, '""')}",${i.qty_operational},${getItemReorderLevel(i.item_code, i.reorder_level ?? 10)},${i.qty_received || 0},${i.qty_transfers || 0},${i.qty_laundry || 0},${i.qty_consumed || 0},${i.qty_returned || 0},${i.qty_wasted || 0}`
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
            استكشاف مستويات المخزون وحدود التنبيه بالوحدات
          </h1>
          <div className="flex items-center gap-3">
            {/* Unit SelectorDropdown */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">الوحدة التشغيلية:</label>
              {nodes.length > 1 ? (
                <select
                  value={selectedNodeId}
                  onChange={(e) => setSelectedNodeId(e.target.value)}
                  className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 text-xs rounded-lg text-slate-700 font-bold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  {nodes.map(n => {
                    const isParent = n.children && n.children.length > 0;
                    return (
                      <option key={n.id} value={n.id}>
                        {isParent ? `${n.name} (المستودع الرئيسي - الكل)` : `${n.name}`}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <span className="px-3.5 py-1.5 bg-blue-50 border border-blue-200 text-xs rounded-lg text-blue-700 font-bold shadow-2xs">
                  {currentNodeName}
                </span>
              )}
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

        {/* Status Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-100 mt-4">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wide">حالة الرصيد:</span>
          <button
            onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:bg-slate-50'
            }`}
          >
            الكل
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
              statusFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
            }`}>{items.length}</span>
          </button>
          <button
            onClick={() => { setStatusFilter('available'); setCurrentPage(1); }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              statusFilter === 'available'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-white text-emerald-700 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50'
            }`}
          >
            متوفر
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
              statusFilter === 'available' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'
            }`}>{countAvailable}</span>
          </button>
          <button
            onClick={() => { setStatusFilter('warning'); setCurrentPage(1); }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              statusFilter === 'warning'
                ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                : 'bg-white text-amber-700 border-amber-200 hover:border-amber-400 hover:bg-amber-50'
            }`}
          >
            تحذير — وشيك على النفاد
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
              statusFilter === 'warning' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
            }`}>{countWarning}</span>
          </button>
          <button
            onClick={() => { setStatusFilter('depleted'); setCurrentPage(1); }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              statusFilter === 'depleted'
                ? 'bg-red-600 text-white border-red-600 shadow-sm'
                : 'bg-white text-red-700 border-red-200 hover:border-red-400 hover:bg-red-50'
            }`}
          >
            نافذ من المخزون
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
              statusFilter === 'depleted' ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'
            }`}>{countDepleted}</span>
          </button>
        </div>
      </div>

      {/* Modern Stock Table */}
      {loadingStock ? (
        <div className="h-48 flex items-center justify-center"><Loader size="md" label="جاري تحميل رصيد المخزون للوحدة..." /></div>
      ) : currentItems.length === 0 ? (
        <EmptyState title="لا توجد أصناف مسجلة لهذه الوحدة" description="لم نجد أي أرصدة مخزنية حالياً." />
      ) : (
        <div className="flex flex-col gap-4">
          <Card className="border border-slate-200/80 overflow-hidden shadow-xs rounded-xl">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-right border-collapse select-none">
                <thead className="bg-slate-100/90 border-b border-slate-200 sticky top-0">
                  <tr className="divide-x divide-x-reverse divide-slate-200">
                    <th className="px-4 py-3.5 text-xs font-black text-slate-700 cursor-pointer hover:text-slate-900" onClick={() => handleSort('item_code')}>
                      <div className="flex items-center gap-1">
                        كود الصنف
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th className="px-4 py-3.5 text-xs font-black text-slate-700 cursor-pointer hover:text-slate-900" onClick={() => handleSort('item_name_ar')}>
                      <div className="flex items-center gap-1">
                        اسم الصنف التشغيلي
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th className="px-3 py-3.5 text-xs font-black text-blue-800 text-center cursor-pointer hover:text-blue-950 bg-blue-50/50" onClick={() => handleSort('qty_operational')}>
                      <div className="flex items-center gap-1 justify-center">
                        الرصيد الفعلي المتاح
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th className="px-3 py-3.5 text-xs font-black text-indigo-700 text-center">حد التنبيه</th>
                    <th className="px-3 py-3.5 text-xs font-black text-slate-500 text-center">التفاصيل والحركة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {currentItems.map((item, idx) => {
                    const customReorder = getItemReorderLevel(item.item_code, item.reorder_level ?? 10);
                    const isLow = item.qty_operational <= customReorder;
                    const statusVariant = item.qty_operational === 0 ? 'danger' : isLow ? 'warning' : 'success';
                    const statusLabel = item.qty_operational === 0 ? 'نافذ' : isLow ? 'وشيك على النفاد' : 'متوفر';

                    return (
                      <tr 
                        key={`${item.item_code}-${idx}`} 
                        className="odd:bg-white even:bg-slate-50/50 hover:bg-blue-50/40 transition-colors duration-150 divide-x divide-x-reverse divide-slate-200/80"
                      >
                        <td className="px-4 py-3.5 text-xs font-mono font-bold text-slate-700 bg-slate-50/30">{item.item_code}</td>
                        <td className="px-4 py-3.5 text-xs font-bold text-slate-800">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{item.item_name_ar}</span>
                            {item.unit && (
                              <span className="text-[10px] text-slate-400 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">{item.unit}</span>
                            )}
                            <Badge variant={statusVariant as any}>{statusLabel}</Badge>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          <span className="text-sm font-black text-blue-700">{item.qty_operational.toLocaleString()}</span>
                        </td>
                        {/* Reorder Threshold Column */}
                        <td className="px-3 py-3.5 text-center">
                          <button
                            onClick={(e) => handleOpenEditThreshold(e, item)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-indigo-700 font-bold text-xs transition-colors cursor-pointer"
                            title="انقر لتعديل حد التنبيه"
                          >
                            <Sliders size={11} />
                            {customReorder}
                          </button>
                        </td>
                        {/* Details Drawer Button — prominent */}
                        <td className="px-3 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleOpenEditThreshold(e, item); }}
                              className="p-1.5 rounded-lg text-indigo-400 hover:text-indigo-700 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition-all cursor-pointer"
                              title="تعديل حد التنبيه"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleRowClick(item); }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition-all cursor-pointer"
                              title="عرض بطاقة الصنف والتفاصيل الكاملة"
                            >
                              <Info size={13} />
                              التفاصيل
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Clean Pagination Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-center bg-white border border-slate-200/80 px-6 py-3.5 rounded-xl shadow-xs select-none gap-3">
            <div className="flex items-center gap-4 text-xs">
              <span className="text-slate-500 font-bold">
                عرض {filteredItems.length === 0 ? 0 : indexOfFirstItem + 1} - {Math.min(indexOfLastItem, filteredItems.length)} من أصل {filteredItems.length} صنف تشغيلي
              </span>
              <div className="flex items-center gap-1.5 text-slate-500 font-semibold">
                <span>عرض بالصفحة:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value={25}>25 صنف</option>
                  <option value={50}>50 صنف</option>
                  <option value={100}>100 صنف</option>
                  <option value={200}>200 صنف</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
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
                    className={`min-w-8 h-8 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      currentPage === page 
                        ? 'bg-blue-600 text-white shadow-xs' 
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              <Button 
                variant="outline" 
                size="sm" 
                disabled={currentPage >= totalPages || totalPages === 0}
                onClick={() => handlePageChange(currentPage + 1)}
              >
                التالي
              </Button>
            </div>
          </div>
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
              <Badge variant={selectedItem.qty_operational === 0 ? 'danger' : selectedItem.qty_operational <= getItemReorderLevel(selectedItem.item_code, selectedItem.reorder_level ?? 10) ? 'warning' : 'success'}>
                {selectedItem.qty_operational === 0 ? 'غير متوفر' : selectedItem.qty_operational <= getItemReorderLevel(selectedItem.item_code, selectedItem.reorder_level ?? 10) ? 'وشيك على النفاد' : 'متوفر'}
              </Badge>
            </div>

            {/* Reorder Threshold Banner */}
            <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-4 flex justify-between items-center">
              <div className="flex flex-col text-right">
                <span className="text-xs font-bold text-indigo-900">حد التنبيه الأدنـى المعتمد</span>
                <span className="text-[10px] text-indigo-600 mt-0.5">يعتبر الصنف في حالة تنبيه إذا قل رصيده عن هذا الرقم</span>
              </div>
              <button
                onClick={(e) => handleOpenEditThreshold(e, selectedItem)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Sliders size={14} />
                تعديل الحد ({getItemReorderLevel(selectedItem.item_code, selectedItem.reorder_level ?? 10)} {selectedItem.unit || 'وحدة'})
              </button>
            </div>

            {/* 2. Lifecycle Breakdown Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="border border-slate-200/80 rounded-xl p-3 flex flex-col text-right bg-slate-50/50">
                <span className="text-[10px] text-slate-500 font-bold">الكمية المستلمة</span>
                <span className="text-xs font-bold text-slate-800 mt-1">{(selectedItem.qty_received || 0).toLocaleString()} {selectedItem.unit || 'وحدة'}</span>
              </div>
              <div className="border border-amber-200/80 rounded-xl p-3 flex flex-col text-right bg-amber-50/30">
                <span className="text-[10px] text-amber-700 font-bold">تحويلات لمستودعات</span>
                <span className="text-xs font-bold text-amber-800 mt-1">{(selectedItem.qty_transfers || 0).toLocaleString()} {selectedItem.unit || 'وحدة'}</span>
              </div>
              <div className="border border-purple-200/80 rounded-xl p-3 flex flex-col text-right bg-purple-50/30">
                <span className="text-[10px] text-purple-700 font-bold">بالمغسلة (قيد المعالجة)</span>
                <span className="text-xs font-bold text-purple-800 mt-1">{(selectedItem.qty_laundry || 0).toLocaleString()} {selectedItem.unit || 'وحدة'}</span>
              </div>
              <div className="border border-blue-200/80 rounded-xl p-3 flex flex-col text-right bg-blue-50/30">
                <span className="text-[10px] text-blue-700 font-bold">استهلاك تشغيلي</span>
                <span className="text-xs font-bold text-blue-800 mt-1">{(selectedItem.qty_consumed || 0).toLocaleString()} {selectedItem.unit || 'وحدة'}</span>
              </div>
              <div className="border border-cyan-200/80 rounded-xl p-3 flex flex-col text-right bg-cyan-50/30">
                <span className="text-[10px] text-cyan-700 font-bold">مرتجع للمخزن الرئيسي</span>
                <span className="text-xs font-bold text-cyan-800 mt-1">{(selectedItem.qty_returned || 0).toLocaleString()} {selectedItem.unit || 'وحدة'}</span>
              </div>
              <div className="border border-rose-200/80 rounded-xl p-3 flex flex-col text-right bg-rose-50/30">
                <span className="text-[10px] text-rose-700 font-bold">تالف / هدر / استبعاد</span>
                <span className="text-xs font-bold text-rose-800 mt-1">{(selectedItem.qty_wasted || 0).toLocaleString()} {selectedItem.unit || 'وحدة'}</span>
              </div>
            </div>

            {/* 3. Operational Quantity Highlight & Conservation Identity */}
            <div className="bg-blue-50/70 border border-blue-200/70 rounded-xl p-4 flex justify-between items-center select-none">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Package size={20} />
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-xs font-bold text-slate-700">الرصيد الفعلي الحالي (المتاح للتشغيل)</span>
                  <span className="text-[10px] text-blue-600 mt-0.5">
                    المستلم ({selectedItem.qty_received}) - الخارجين ({((selectedItem.qty_transfers || 0) + (selectedItem.qty_laundry || 0) + (selectedItem.qty_consumed || 0) + (selectedItem.qty_returned || 0) + (selectedItem.qty_wasted || 0))})
                  </span>
                </div>
              </div>
              <div>
                <span className="text-2xl font-black text-blue-800">{selectedItem.qty_operational} <span className="text-xs font-bold text-blue-600">{selectedItem.unit || 'وحدة'}</span></span>
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

      {/* THRESHOLD EDIT MODAL IN INVENTORY */}
      <Modal
        isOpen={isThresholdModalOpen}
        onClose={() => setIsThresholdModalOpen(false)}
        title={itemForThreshold ? `تعديل حد التنبيه للصنف: ${itemForThreshold.item_name_ar}` : 'تعديل حد التنبيه'}
      >
        {thresholdSuccessMsg ? (
          <div className="flex flex-col items-center justify-center py-6 text-center gap-3 select-none">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-100">
              <CheckCircle2 size={28} />
            </div>
            <p className="text-sm font-bold text-slate-800">{thresholdSuccessMsg}</p>
          </div>
        ) : itemForThreshold ? (
          <form onSubmit={handleSaveThreshold} className="flex flex-col gap-4 select-none">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex justify-between items-center text-right">
              <div>
                <span className="text-xs font-bold text-slate-800">{itemForThreshold.item_name_ar}</span>
                <p className="text-[11px] font-mono text-slate-500 mt-0.5">{itemForThreshold.item_code}</p>
              </div>
              <div className="text-left">
                <span className="text-xs font-bold text-slate-600">الرصيد المتاح:</span>
                <p className="text-sm font-extrabold text-blue-700">{itemForThreshold.qty_operational} {itemForThreshold.unit || 'وحدة'}</p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">
                حد التنبيه الجديد (عدد الوحدات / القطع)
              </label>
              <input
                type="number"
                min={0}
                required
                value={thresholdValue}
                onChange={(e) => setThresholdValue(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1 bg-amber-50 border border-amber-100 p-2.5 rounded-lg text-amber-900">
                يعتبر الصنف ضمن الأصناف الوشيكة على النفاد في التنبيهات عندما يصبح رصيده المتوفر أقل من أو يساوي هذا الحد.
              </p>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setIsThresholdModalOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" variant="primary" className="bg-indigo-600 hover:bg-indigo-700">
                حفظ الحد الجديد
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>

    </div>
  );
}