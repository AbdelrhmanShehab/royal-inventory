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

  // Sorting State
  const [sortField, setSortField] = useState<keyof StockItem>('item_code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

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
                        {isParent ? `🏢 ${n.name} (المستودع الرئيسي - الكل)` : `📦 ${n.name}`}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <span className="px-3.5 py-1.5 bg-blue-50 border border-blue-200 text-xs rounded-lg text-blue-700 font-bold shadow-2xs">
                  🔒 {currentNodeName}
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
                    <th className="px-4 py-4 text-xs font-bold text-slate-500 cursor-pointer hover:text-slate-800" onClick={() => handleSort('item_code')}>
                      <div className="flex items-center gap-1">
                        كود الصنف
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th className="px-4 py-4 text-xs font-bold text-slate-500 cursor-pointer hover:text-slate-800" onClick={() => handleSort('item_name_ar')}>
                      <div className="flex items-center gap-1">
                        اسم الصنف التشغيلي
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th className="px-3 py-4 text-xs font-bold text-blue-700 text-left cursor-pointer hover:text-blue-900 bg-blue-50/30" onClick={() => handleSort('qty_operational')}>
                      <div className="flex items-center gap-1 justify-end">
                        الرصيد الفعلي
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th className="px-3 py-4 text-xs font-bold text-slate-500 text-center">حد التنبيه</th>
                    <th className="px-3 py-4 text-xs font-bold text-slate-600 text-left cursor-pointer hover:text-slate-900 bg-slate-100/40" onClick={() => handleSort('qty_received')}>
                      <div className="flex items-center gap-1 justify-end">
                        المستلم
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th className="px-3 py-4 text-xs font-bold text-amber-700 text-left cursor-pointer hover:text-amber-900" onClick={() => handleSort('qty_transfers')}>
                      <div className="flex items-center gap-1 justify-end">
                        تحويلات
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th className="px-3 py-4 text-xs font-bold text-purple-700 text-left cursor-pointer hover:text-purple-900" onClick={() => handleSort('qty_laundry')}>
                      <div className="flex items-center gap-1 justify-end">
                        مغسلة
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th className="px-3 py-4 text-xs font-bold text-blue-600 text-left cursor-pointer hover:text-blue-800" onClick={() => handleSort('qty_consumed')}>
                      <div className="flex items-center gap-1 justify-end">
                        استهلاك
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th className="px-3 py-4 text-xs font-bold text-cyan-700 text-left cursor-pointer hover:text-cyan-900" onClick={() => handleSort('qty_returned')}>
                      <div className="flex items-center gap-1 justify-end">
                        مرتجع
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th className="px-3 py-4 text-xs font-bold text-rose-700 text-left cursor-pointer hover:text-rose-900" onClick={() => handleSort('qty_wasted')}>
                      <div className="flex items-center gap-1 justify-end">
                        تالف / هدر / استبعاد
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th className="px-3 py-4 text-xs font-bold text-slate-500 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentItems.map((item, idx) => {
                    const customReorder = getItemReorderLevel(item.item_code, item.reorder_level ?? 10);
                    const isLow = item.qty_operational <= customReorder;
                    const statusVariant = item.qty_operational === 0 ? 'danger' : isLow ? 'warning' : 'success';
                    const statusLabel = item.qty_operational === 0 ? 'نافذ' : isLow ? 'وشيك على النفاد' : 'متوفر';

                    return (
                      <tr 
                        key={`${item.item_code}-${idx}`} 
                        onClick={() => handleRowClick(item)}
                        className="hover:bg-slate-50/50 cursor-pointer transition-colors duration-150"
                      >
                        <td className="px-4 py-3.5 text-xs font-bold text-slate-700">{item.item_code}</td>
                        <td className="px-4 py-3.5 text-xs font-bold text-slate-800">
                          <div className="flex items-center gap-2">
                            <span>{item.item_name_ar}</span>
                            <Badge variant={statusVariant as any}>{statusLabel}</Badge>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-xs font-extrabold text-blue-700 text-left bg-blue-50/30">
                          {item.qty_operational.toLocaleString()} {item.unit || 'وحدة'}
                        </td>
                        {/* Custom Reorder Level Column */}
                        <td className="px-3 py-3.5 text-center">
                          <button
                            onClick={(e) => handleOpenEditThreshold(e, item)}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-indigo-700 font-bold text-xs transition-colors cursor-pointer"
                            title="انقر لتعديل حد التنبيه"
                          >
                            <Sliders size={11} />
                            {customReorder}
                          </button>
                        </td>
                        {/* 1. الكمية المستلمة */}
                        <td className="px-3 py-3.5 text-xs font-bold text-slate-700 text-left bg-slate-50/40">
                          {(item.qty_received || 0).toLocaleString()}
                        </td>
                        {/* 2. تحويلات */}
                        <td className="px-3 py-3.5 text-xs font-semibold text-amber-700 text-left">
                          {(item.qty_transfers || 0).toLocaleString()}
                        </td>
                        {/* 3. مغسلة */}
                        <td className="px-3 py-3.5 text-xs font-semibold text-purple-700 text-left">
                          {(item.qty_laundry || 0).toLocaleString()}
                        </td>
                        {/* 4. استهلاك تشغيلي */}
                        <td className="px-3 py-3.5 text-xs font-semibold text-blue-600 text-left">
                          {(item.qty_consumed || 0).toLocaleString()}
                        </td>
                        {/* 5. مرتجع */}
                        <td className="px-3 py-3.5 text-xs font-semibold text-cyan-700 text-left">
                          {(item.qty_returned || 0).toLocaleString()}
                        </td>
                        {/* 6. تالف / هدر / استبعاد */}
                        <td className="px-3 py-3.5 text-xs font-semibold text-rose-700 text-left">
                          {(item.qty_wasted || 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button 
                              onClick={(e) => handleOpenEditThreshold(e, item)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer"
                              title="تعديل حد التنبيه"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button 
                              onClick={() => handleRowClick(item)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all cursor-pointer"
                              title="عرض تفاصيل الصنف وحركة المخزون"
                            >
                              <Info size={13} />
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
                💡 يعتبر الصنف ضمن الأصناف الوشيكة على النفاد في التنبيهات عندما يصبح رصيده المتوفر أقل من أو يساوي هذا الحد.
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