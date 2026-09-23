import React, { useState, useEffect, useMemo } from 'react';
import { 
  AlertTriangle, 
  AlertCircle, 
  PackageX, 
  RefreshCw, 
  Download, 
  Printer, 
  Search, 
  ArrowLeftRight, 
  Building2, 
  TrendingDown, 
  CheckCircle2, 
  List, 
  LayoutGrid,
  Info,
  SlidersHorizontal,
  Edit3,
  Sliders
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Loader from '../../components/ui/Loader';
import EmptyState from '../../components/ui/EmptyState';
import AsyncItemSelector from '../../components/ui/AsyncItemSelector';
import { alertsApi } from '../../api/alerts.api';
import { hierarchyApi } from '../../api/hierarchy.api';
import { transferApi } from '../../features/transfer/api/transfer.api';
import type { StockAlertItem } from '../../types/alert';
import type { OrganizationNode } from '../../types/hierarchy';
import { useWarehouseScope } from '../../hooks/useWarehouseScope';
import { getItemReorderLevel, setItemReorderLevel } from '../../utils/reorderLevels';

export default function AlertsPage() {
  const { currentNodeId, isGlobalAdmin, currentNodeName } = useWarehouseScope();

  // States
  const [alerts, setAlerts] = useState<StockAlertItem[]>([]);
  const [nodes, setNodes] = useState<OrganizationNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Views
  const [activeTab, setActiveTab] = useState<'all' | 'out_of_stock' | 'about_to_finish'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [thresholdMultiplier, setThresholdMultiplier] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Reorder Modal State
  const [selectedAlertForReorder, setSelectedAlertForReorder] = useState<StockAlertItem | null>(null);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [sourceNodeId, setSourceNodeId] = useState<string>('');
  const [reorderQuantity, setReorderQuantity] = useState<number>(10);
  const [reorderNotes, setReorderNotes] = useState<string>('');
  const [submittingReorder, setSubmittingReorder] = useState(false);
  const [reorderSuccessMsg, setReorderSuccessMsg] = useState<string>('');

  // Threshold Edit Modal State
  const [selectedAlertForThreshold, setSelectedAlertForThreshold] = useState<StockAlertItem | null>(null);
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);
  const [customItemCode, setCustomItemCode] = useState<string>('');
  const [customItemName, setCustomItemName] = useState<string>('');
  const [newThresholdValue, setNewThresholdValue] = useState<number>(10);
  const [thresholdSuccessMsg, setThresholdSuccessMsg] = useState<string>('');

  // Item Details Drawer / Modal
  const [detailedAlert, setDetailedAlert] = useState<StockAlertItem | null>(null);

  // Helper to flatten organization tree
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

  // Load Tree Nodes and enforce warehouse owner permission locking
  useEffect(() => {
    const loadNodes = async () => {
      try {
        const tree = await hierarchyApi.getTree();
        const flat = flattenNodes(tree);
        setNodes(flat);
        
        // Strict RBAC: Non-admin warehouse owners are strictly locked to their assigned warehouse node
        if (!isGlobalAdmin && currentNodeId) {
          setSelectedNodeId(String(currentNodeId));
        } else if (flat.length > 0) {
          setSelectedNodeId('');
        }
      } catch (err) {
        console.error('Error fetching tree nodes for alerts:', err);
      }
    };
    loadNodes();
  }, [currentNodeId, isGlobalAdmin]);

  // Fetch Alerts (enforcing strict warehouse scope permission for warehouse owner)
  const fetchAlertsData = async (nodeId?: string) => {
    setLoading(true);
    try {
      // Non-admin warehouse owner scope is strictly enforced here
      const scopedNodeId = !isGlobalAdmin && currentNodeId ? String(currentNodeId) : (nodeId || undefined);
      const data = await alertsApi.getStockAlerts(scopedNodeId);
      setAlerts(data);
    } catch (err) {
      console.error('Error fetching stock alerts:', err);
      setAlerts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const targetNodeId = !isGlobalAdmin && currentNodeId ? String(currentNodeId) : selectedNodeId;
    fetchAlertsData(targetNodeId);
  }, [selectedNodeId, currentNodeId, isGlobalAdmin]);

  const handleRefresh = () => {
    setRefreshing(true);
    const targetNodeId = !isGlobalAdmin && currentNodeId ? String(currentNodeId) : selectedNodeId;
    fetchAlertsData(targetNodeId);
  };

  // Categories extraction
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    alerts.forEach(a => {
      if (a.category) cats.add(a.category);
    });
    return Array.from(cats);
  }, [alerts]);

  // Filtered Alerts Logic with Item Name & Code Search
  const filteredAlerts = useMemo(() => {
    return alerts.filter(item => {
      // Tab filter
      if (activeTab === 'out_of_stock' && item.status !== 'out_of_stock') return false;
      if (activeTab === 'about_to_finish' && item.status !== 'about_to_finish') return false;

      // Threshold multiplier check
      const effectiveReorderLevel = item.reorderLevel * thresholdMultiplier;
      if (item.qtyOperational > effectiveReorderLevel) return false;

      // Search query (Item Name Arabic, English, Code, Warehouse Node)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesNameAr = item.itemNameAr && item.itemNameAr.toLowerCase().includes(query);
        const matchesNameEn = item.itemNameEn && item.itemNameEn.toLowerCase().includes(query);
        const matchesCode = item.itemCode && item.itemCode.toLowerCase().includes(query);
        const matchesNode = item.nodeName && item.nodeName.toLowerCase().includes(query);
        const matchesCategory = item.category && item.category.toLowerCase().includes(query);
        if (!matchesNameAr && !matchesNameEn && !matchesCode && !matchesNode && !matchesCategory) return false;
      }

      // Category filter
      if (selectedCategory && item.category !== selectedCategory) return false;

      return true;
    });
  }, [alerts, activeTab, searchQuery, selectedCategory, thresholdMultiplier]);

  // KPI Calculations
  const totalAlertsCount = alerts.length;
  const outOfStockCount = alerts.filter(a => a.status === 'out_of_stock').length;
  const aboutToFinishCount = alerts.filter(a => a.status === 'about_to_finish').length;
  const totalDeficitQtySum = alerts.reduce((sum, a) => sum + a.deficitQty, 0);

  // Open Edit Threshold Modal for an existing alert item
  const handleOpenEditThreshold = (alertItem: StockAlertItem) => {
    setSelectedAlertForThreshold(alertItem);
    setCustomItemCode(alertItem.itemCode);
    setCustomItemName(alertItem.itemNameAr);
    setNewThresholdValue(getItemReorderLevel(alertItem.itemCode, alertItem.reorderLevel));
    setThresholdSuccessMsg('');
    setIsThresholdModalOpen(true);
  };

  // Open Threshold Modal to set threshold for ANY item by name or code
  const handleOpenCustomItemThreshold = () => {
    setSelectedAlertForThreshold(null);
    setCustomItemCode('');
    setCustomItemName('');
    setNewThresholdValue(10);
    setThresholdSuccessMsg('');
    setIsThresholdModalOpen(true);
  };

  // Save New Threshold
  const handleSaveThreshold = (e: React.FormEvent) => {
    e.preventDefault();
    const targetCode = selectedAlertForThreshold ? selectedAlertForThreshold.itemCode : customItemCode.trim();
    if (!targetCode) return;

    setItemReorderLevel(targetCode, Number(newThresholdValue));
    const targetName = selectedAlertForThreshold ? selectedAlertForThreshold.itemNameAr : (customItemName || targetCode);
    setThresholdSuccessMsg(`تم تحديث حد التنبيه للصنف (${targetName}) إلى ${newThresholdValue} وحدة بنجاح!`);

    setTimeout(() => {
      setIsThresholdModalOpen(false);
      setThresholdSuccessMsg('');
      const targetNodeId = !isGlobalAdmin && currentNodeId ? String(currentNodeId) : selectedNodeId;
      fetchAlertsData(targetNodeId);
    }, 1300);
  };

  // Open Quick Reorder Modal
  const handleOpenReorder = (alertItem: StockAlertItem) => {
    setSelectedAlertForReorder(alertItem);
    setReorderQuantity(alertItem.suggestedReorderQty || 15);
    setReorderNotes(`طلب تزويد عاجل لسد العجز للصنف ${alertItem.itemNameAr} (${alertItem.itemCode})`);
    const availableSources = nodes.filter(n => !n.id.startsWith('group-') && String(n.id) !== alertItem.nodeId);
    if (availableSources.length > 0) {
      setSourceNodeId(availableSources[0].id);
    } else {
      setSourceNodeId('14');
    }
    setReorderSuccessMsg('');
    setIsReorderModalOpen(true);
  };

  // Submit Quick Reorder Draft
  const handleReorderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlertForReorder) return;
    setSubmittingReorder(true);
    try {
      await transferApi.createTransferDraft({
        txnType: 'internal_transfer',
        fromNodeId: Number(sourceNodeId) || 14,
        toNodeId: Number(selectedAlertForReorder.nodeId) || undefined,
        reason: reorderNotes || `طلب تزويد عاجل للصنف ${selectedAlertForReorder.itemNameAr}`,
        lines: [
          {
            itemCode: selectedAlertForReorder.itemCode,
            quantity: Number(reorderQuantity),
            unitCode: selectedAlertForReorder.unit
          }
        ]
      });

      setReorderSuccessMsg('تم تقديم طلب التزويد وإدراج المسودة بنجاح!');
      setTimeout(() => {
        setIsReorderModalOpen(false);
        setReorderSuccessMsg('');
        const targetNodeId = !isGlobalAdmin && currentNodeId ? String(currentNodeId) : selectedNodeId;
        fetchAlertsData(targetNodeId);
      }, 1500);
    } catch (err) {
      console.error('Error submitting reorder draft:', err);
    } finally {
      setSubmittingReorder(false);
    }
  };

  // Export CSV Report
  const handleExportCSV = () => {
    const headers = ['كود الصنف,اسم الصنف,الوحدة التشغيلية,الفئة,الرصيد المتاح,حد إعادة الطلب,كمية العجز,الكمية المقترحة للتزويد,الوحدة,الحالة\n'];
    const rows = filteredAlerts.map(a => 
      `${a.itemCode},"${a.itemNameAr}","${a.nodeName}","${a.category}",${a.qtyOperational},${a.reorderLevel},${a.deficitQty},${a.suggestedReorderQty},"${a.unit}","${a.status === 'out_of_stock' ? 'نافذ بالكامل' : 'وشيك على النفاد'}"`
    );
    const blob = new Blob(['\uFEFF' + headers.concat(rows.join('\n'))], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `تقرير_نواقص_المخزون_${new Date().toISOString().substring(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Report
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-6">

      {/* Hero Header with Warehouse Owner Scope Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs gap-4 select-none">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl lg:text-2xl font-extrabold text-slate-800">
              تقارير ونواقص المستودع والأصناف الوشيكة على النفاد
            </h1>
            <Badge variant="warning" className="animate-pulse">
              مباشر
            </Badge>
          </div>
          <p className="text-xs lg:text-sm text-slate-500 mt-1">
            متابعة فورية للأصناف الناقصة والوشيكة على النفاد والبحث باسم الصنف وتعديل حد التنبيه.
          </p>
        </div>

        {/* Top Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Node Scope Badge / Switcher */}
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
            <Building2 size={16} className="text-slate-500 mr-1" />
            <span className="text-xs font-bold text-slate-600">نطاق المستودع:</span>
            {isGlobalAdmin ? (
              <select
                value={selectedNodeId}
                onChange={(e) => setSelectedNodeId(e.target.value)}
                className="px-3 py-1 bg-white border border-slate-200 text-xs rounded-lg font-bold text-slate-700 focus:outline-none focus:border-blue-500"
              >
                <option value="">جميع الوحدات والمستودعات</option>
                {nodes.filter(n => !n.id.startsWith('group-')).map(n => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            ) : (
              <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-xs rounded-lg font-bold">
                🔒 {currentNodeName} (مالك المستودع)
              </span>
            )}
          </div>

          {/* Edit Custom Threshold Button */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleOpenCustomItemThreshold}
            className="border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
          >
            <Sliders size={14} />
            تعديل حد التنبيه لصنف
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            تحديث
          </Button>

          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={filteredAlerts.length === 0}>
            <Download size={14} />
            تصدير (CSV)
          </Button>

          <Button variant="ghost" size="sm" onClick={handlePrint}>
            <Printer size={14} />
            طباعة
          </Button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 select-none">
        
        {/* KPI 1: Total Alerts */}
        <Card hoverable className="border-slate-200/60">
          <Card.Body className="p-4 flex items-center justify-between">
            <div className="flex flex-col text-right">
              <span className="text-xs font-bold text-slate-500">إجمالي تنبيهات النواقص</span>
              <span className="text-2xl font-extrabold text-slate-800 mt-1">{totalAlertsCount}</span>
              <span className="text-[10px] text-slate-400 mt-0.5">أصناف تقع تحت حد الأمان</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center">
              <AlertTriangle size={24} />
            </div>
          </Card.Body>
        </Card>

        {/* KPI 2: Out of Stock (Critical) */}
        <Card hoverable className="border-slate-200/60">
          <Card.Body className="p-4 flex items-center justify-between">
            <div className="flex flex-col text-right">
              <span className="text-xs font-bold text-red-600">نافذة بالكامل (حرج)</span>
              <span className="text-2xl font-extrabold text-red-700 mt-1">{outOfStockCount}</span>
              <span className="text-[10px] text-red-500 mt-0.5">رصيد متوفر = 0 وحدة</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 text-red-600 flex items-center justify-center">
              <PackageX size={24} />
            </div>
          </Card.Body>
        </Card>

        {/* KPI 3: About to Finish (Warning) */}
        <Card hoverable className="border-slate-200/60">
          <Card.Body className="p-4 flex items-center justify-between">
            <div className="flex flex-col text-right">
              <span className="text-xs font-bold text-amber-600">وشيكة على النفاد (تحذير)</span>
              <span className="text-2xl font-extrabold text-amber-700 mt-1">{aboutToFinishCount}</span>
              <span className="text-[10px] text-amber-500 mt-0.5">أصناف قاربت على الانتهاء</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center">
              <AlertCircle size={24} />
            </div>
          </Card.Body>
        </Card>

        {/* KPI 4: Total Deficit Quantity */}
        <Card hoverable className="border-slate-200/60">
          <Card.Body className="p-4 flex items-center justify-between">
            <div className="flex flex-col text-right">
              <span className="text-xs font-bold text-slate-500">إجمالي العجز المطلوب</span>
              <span className="text-2xl font-extrabold text-blue-700 mt-1">{totalDeficitQtySum.toLocaleString()}</span>
              <span className="text-[10px] text-slate-400 mt-0.5">وحدات لتغطية حد الطلب</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center">
              <TrendingDown size={24} />
            </div>
          </Card.Body>
        </Card>
      </div>

      {/* Main Filter & Control Panel */}
      <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs select-none flex flex-col gap-4">
        
        {/* Top Row: Tabs & Search */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          
          {/* Status Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'all' 
                  ? 'bg-white text-slate-800 shadow-xs' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              جميع التنبيهات ({alerts.length})
            </button>
            <button
              onClick={() => setActiveTab('out_of_stock')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'out_of_stock' 
                  ? 'bg-red-600 text-white shadow-xs' 
                  : 'text-red-600 hover:bg-red-50'
              }`}
            >
              <PackageX size={14} />
              نافذة بالكامل ({outOfStockCount})
            </button>
            <button
              onClick={() => setActiveTab('about_to_finish')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'about_to_finish' 
                  ? 'bg-amber-500 text-white shadow-xs' 
                  : 'text-amber-600 hover:bg-amber-50'
              }`}
            >
              <AlertTriangle size={14} />
              وشيكة على النفاد ({aboutToFinishCount})
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-400 hover:text-slate-600'
              }`}
              title="عرض جدول"
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'cards' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-400 hover:text-slate-600'
              }`}
              title="عرض بطاقات"
            >
              <LayoutGrid size={16} />
            </button>
          </div>

        </div>

        {/* Second Row: Filters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          
          {/* Search Box - Item Name or Code */}
          <div className="relative">
            <Search size={16} className="absolute right-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم الصنف (مثل: سلامي، أرز...)، الكود..."
              className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 text-xs rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 text-xs rounded-xl font-medium text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="">جميع الفئات</option>
              {availableCategories.map((cat, idx) => (
                <option key={idx} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Threshold Adjuster */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 lg:col-span-2">
            <SlidersHorizontal size={14} className="text-slate-500" />
            <label className="text-[11px] font-bold text-slate-600 whitespace-nowrap">
              مضاعف المعاينة: <span className="text-blue-700 font-extrabold">{thresholdMultiplier}x</span>
            </label>
            <input
              type="range"
              min="1"
              max="3"
              step="0.5"
              value={thresholdMultiplier}
              onChange={(e) => setThresholdMultiplier(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

        </div>

      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="h-64 flex items-center justify-center bg-white rounded-2xl border border-slate-200/80">
          <Loader size="lg" label="جاري فحص أرصدة المخزون وتحليل التنبيهات..." />
        </div>
      ) : filteredAlerts.length === 0 ? (
        <Card className="border-slate-200/80">
          <Card.Body className="py-12">
            <EmptyState
              title="لا توجد تنبيهات نواقص مطابقة"
              description="جميع الأصناف في النطاق المحدد تتمتع بمستويات مخزون آمنة أعلى من حدود الطلب."
            />
          </Card.Body>
        </Card>
      ) : viewMode === 'table' ? (

        /* TABLE VIEW */
        <Card className="border-slate-200/80 overflow-hidden shadow-xs">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-right border-collapse select-none">
              <thead className="bg-slate-50/75 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500">كود الصنف</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500">اسم الصنف والفئة</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500">الموقع / المستودع</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 text-center">الرصيد المتاح / حد التنبيه</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 text-center">نسبة التوفر</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 text-center">حالة التنبيه</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 text-left">العجز والكمية المقترحة</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 text-center">إجراء سريع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAlerts.map((alertItem) => {
                  const isCritical = alertItem.status === 'out_of_stock';
                  const ratio = alertItem.reorderLevel > 0 
                    ? Math.min(100, Math.round((alertItem.qtyOperational / alertItem.reorderLevel) * 100))
                    : 0;

                  return (
                    <tr key={alertItem.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* SKU */}
                      <td className="px-6 py-4 text-xs font-bold text-slate-700">
                        <span className="px-2.5 py-1 bg-slate-100 rounded-md font-mono text-[11px]">
                          {alertItem.itemCode}
                        </span>
                      </td>

                      {/* Name & Category */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col text-right">
                          <span className="text-xs font-bold text-slate-800">{alertItem.itemNameAr}</span>
                          {alertItem.itemNameEn && (
                            <span className="text-[10px] text-slate-400 font-medium">{alertItem.itemNameEn}</span>
                          )}
                          <span className="inline-block mt-1 text-[9px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full w-fit">
                            {alertItem.category}
                          </span>
                        </div>
                      </td>

                      {/* Warehouse Node */}
                      <td className="px-6 py-4 text-xs font-bold text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <Building2 size={14} className="text-slate-400" />
                          <span>{alertItem.nodeName}</span>
                        </div>
                      </td>

                      {/* Operational Qty vs Reorder Level with Edit Trigger */}
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className={`text-sm font-extrabold ${isCritical ? 'text-red-700' : 'text-amber-700'}`}>
                            {alertItem.qtyOperational} <span className="text-xs font-normal text-slate-500">{alertItem.unit}</span>
                          </span>
                          <button
                            onClick={() => handleOpenEditThreshold(alertItem)}
                            className="flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800 font-bold mt-1 bg-indigo-50 px-2 py-0.5 rounded-md hover:bg-indigo-100 transition-colors cursor-pointer"
                            title="انقر لتعديل حد التنبيه لهذا الصنف"
                          >
                            <Edit3 size={10} />
                            حد التنبيه: {alertItem.reorderLevel} {alertItem.unit}
                          </button>
                        </div>
                      </td>

                      {/* Progress bar */}
                      <td className="px-6 py-4 text-center w-32">
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
                            <div 
                              className={`h-full rounded-full transition-all ${
                                isCritical ? 'bg-red-600' : ratio <= 30 ? 'bg-red-500' : 'bg-amber-500'
                              }`}
                              style={{ width: `${ratio}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-slate-500">{ratio}% متوفر</span>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="px-6 py-4 text-center">
                        {isCritical ? (
                          <Badge variant="danger" className="gap-1 px-3 py-1 text-xs">
                            <PackageX size={12} />
                            نفاد كامل
                          </Badge>
                        ) : (
                          <Badge variant="warning" className="gap-1 px-3 py-1 text-xs">
                            <AlertTriangle size={12} />
                            وشيك على النفاد
                          </Badge>
                        )}
                      </td>

                      {/* Deficit & Suggested */}
                      <td className="px-6 py-4 text-left">
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-bold text-red-600">
                            عجز: -{alertItem.deficitQty} {alertItem.unit}
                          </span>
                          <span className="text-[10px] font-bold text-blue-700 mt-0.5">
                            تزويد موصى به: +{alertItem.suggestedReorderQty} {alertItem.unit}
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleOpenReorder(alertItem)}
                            className="bg-blue-600 hover:bg-blue-700 text-xs px-3 py-1.5 shadow-2xs gap-1"
                          >
                            <ArrowLeftRight size={14} />
                            طلب تزويد
                          </Button>
                          <button
                            onClick={() => handleOpenEditThreshold(alertItem)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="تعديل حد التنبيه"
                          >
                            <Sliders size={16} />
                          </button>
                          <button
                            onClick={() => setDetailedAlert(alertItem)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="عرض تفاصيل"
                          >
                            <Info size={16} />
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
      ) : (

        /* CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAlerts.map((alertItem) => {
            const isCritical = alertItem.status === 'out_of_stock';
            const ratio = alertItem.reorderLevel > 0 
              ? Math.min(100, Math.round((alertItem.qtyOperational / alertItem.reorderLevel) * 100))
              : 0;

            return (
              <Card 
                key={alertItem.id} 
                hoverable 
                className={`border-l-4 ${isCritical ? 'border-l-red-600' : 'border-l-amber-500'} border-slate-200/80 shadow-xs`}
              >
                <Card.Body className="p-5 flex flex-col gap-4">
                  
                  {/* Header */}
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col text-right">
                      <span className="text-[10px] font-mono font-bold text-slate-400">{alertItem.itemCode}</span>
                      <h3 className="text-sm font-bold text-slate-800 mt-0.5">{alertItem.itemNameAr}</h3>
                      <span className="text-[10px] font-medium text-slate-500">{alertItem.category}</span>
                    </div>
                    {isCritical ? (
                      <Badge variant="danger" className="gap-1">
                        <PackageX size={12} />
                        نفاد كامل
                      </Badge>
                    ) : (
                      <Badge variant="warning" className="gap-1">
                        <AlertTriangle size={12} />
                        وشيك على النفاد
                      </Badge>
                    )}
                  </div>

                  {/* Node Info */}
                  <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100 text-xs font-bold text-slate-700">
                    <div className="flex items-center gap-1.5">
                      <Building2 size={14} className="text-blue-600" />
                      <span>الموقع: {alertItem.nodeName}</span>
                    </div>
                    <button
                      onClick={() => handleOpenEditThreshold(alertItem)}
                      className="text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer transition-colors"
                      title="تعديل حد التنبيه"
                    >
                      <Edit3 size={10} />
                      حد التنبيه: {alertItem.reorderLevel}
                    </button>
                  </div>

                  {/* Stock Bar */}
                  <div className="flex flex-col gap-1.5 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-600">الرصيد المتاح:</span>
                      <span className={`font-extrabold ${isCritical ? 'text-red-700' : 'text-amber-700'}`}>
                        {alertItem.qtyOperational} / {alertItem.reorderLevel} {alertItem.unit}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          isCritical ? 'bg-red-600' : 'bg-amber-500'
                        }`}
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500 mt-1">
                      <span>العجز: <strong className="text-red-600">-{alertItem.deficitQty} {alertItem.unit}</strong></span>
                      <span>تزويد موصى به: <strong className="text-blue-700">+{alertItem.suggestedReorderQty} {alertItem.unit}</strong></span>
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="flex items-center gap-2 mt-1">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleOpenReorder(alertItem)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-xs py-2 shadow-2xs gap-1.5"
                    >
                      <ArrowLeftRight size={14} />
                      طلب تزويد عاجل
                    </Button>
                    <button
                      onClick={() => handleOpenEditThreshold(alertItem)}
                      className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                      title="تعديل حد التنبيه"
                    >
                      <Sliders size={16} />
                    </button>
                    <button
                      onClick={() => setDetailedAlert(alertItem)}
                      className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                      title="تفاصيل الصنف"
                    >
                      <Info size={16} />
                    </button>
                  </div>

                </Card.Body>
              </Card>
            );
          })}
        </div>
      )}

      {/* EDIT / CONFIGURE ITEM ALERT THRESHOLD MODAL WITH ITEM NAME SEARCH */}
      <Modal
        isOpen={isThresholdModalOpen}
        onClose={() => setIsThresholdModalOpen(false)}
        title={selectedAlertForThreshold ? `تعديل حد التنبيه للصنف: ${selectedAlertForThreshold.itemNameAr}` : 'ضبط وتحديث حد التنبيه لأي صنف بالاسم'}
      >
        {thresholdSuccessMsg ? (
          <div className="flex flex-col items-center justify-center py-6 text-center gap-3 select-none">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-100">
              <CheckCircle2 size={28} />
            </div>
            <p className="text-sm font-bold text-slate-800">{thresholdSuccessMsg}</p>
          </div>
        ) : (
          <form onSubmit={handleSaveThreshold} className="flex flex-col gap-4 select-none">
            
            {/* Search by Item Name using AsyncItemSelector */}
            {!selectedAlertForThreshold ? (
              <div className="flex flex-col gap-2 text-right">
                <label className="text-xs font-bold text-slate-700">
                  البحث باسم الصنف (مثل: سلامي، أرز، بن...) أو كود الصنف
                </label>
                <AsyncItemSelector
                  value={customItemCode}
                  placeholder="انقر هنا واكتب اسم الصنف (مثل: سلامي...)"
                  onSelect={(item) => {
                    setCustomItemCode(item.itemCode);
                    setCustomItemName(item.itemNameAr);
                    setNewThresholdValue(getItemReorderLevel(item.itemCode, 10));
                  }}
                />
                
                {/* Fallback Manual Text Input if required */}
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <Input
                    label="كود الصنف المحدد"
                    readOnly
                    value={customItemCode}
                    placeholder="كود الصنف ينزل تلقائياً"
                    onChange={(e) => setCustomItemCode(e.target.value)}
                  />
                  <Input
                    label="اسم الصنف"
                    value={customItemName}
                    placeholder="اسم الصنف ينزل تلقائياً"
                    onChange={(e) => setCustomItemName(e.target.value)}
                  />
                </div>

                {customItemCode && (
                  <div className="bg-indigo-50/80 border border-indigo-100 rounded-xl p-3 flex justify-between items-center text-xs mt-1">
                    <div className="flex flex-col">
                      <span className="font-bold text-indigo-950">{customItemName || 'صنف محدد'}</span>
                      <span className="text-[10px] font-mono text-indigo-600">الكود: {customItemCode}</span>
                    </div>
                    <span className="px-2.5 py-1 bg-white text-indigo-700 font-extrabold text-[11px] rounded-lg border border-indigo-200">
                      حد التنبيه الحالي: {getItemReorderLevel(customItemCode, 10)} قطعة
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-2 text-right">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-800">{selectedAlertForThreshold.itemNameAr}</span>
                  <span className="text-xs font-mono font-bold text-slate-500">{selectedAlertForThreshold.itemCode}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-600">
                  <span>الرصيد المتاح حالياً: <strong className="text-blue-700">{selectedAlertForThreshold.qtyOperational} {selectedAlertForThreshold.unit}</strong></span>
                  <span>الموقع: <strong>{selectedAlertForThreshold.nodeName}</strong></span>
                </div>
              </div>
            )}

            {/* Threshold Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">
                حد التنبيه الأدنـى الجديد (عدد الوحدات / القطع)
              </label>
              <input
                type="number"
                min={0}
                required
                value={newThresholdValue}
                onChange={(e) => setNewThresholdValue(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1 bg-amber-50/70 border border-amber-100 p-2.5 rounded-lg text-amber-950">
                💡 <strong>ملاحظة:</strong> إذا ينخفض رصيد هذا الصنف إلى <strong>{newThresholdValue}</strong> وحدة أو أقل، سيتم اعتباره فورا ضمن الأصناف الوشيكة على النفاد ويظهر في التنبيهات.
              </p>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setIsThresholdModalOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" variant="primary" disabled={!customItemCode.trim()} className="bg-indigo-600 hover:bg-indigo-700">
                حفظ حد التنبيه
              </Button>
            </div>

          </form>
        )}
      </Modal>

      {/* QUICK REORDER MODAL */}
      <Modal 
        isOpen={isReorderModalOpen} 
        onClose={() => setIsReorderModalOpen(false)} 
        title="إنشاء مسودة طلب تزويد / تحويل عاجل"
      >
        {reorderSuccessMsg ? (
          <div className="flex flex-col items-center justify-center py-6 text-center gap-3">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-100">
              <CheckCircle2 size={28} />
            </div>
            <p className="text-sm font-bold text-slate-800">{reorderSuccessMsg}</p>
          </div>
        ) : selectedAlertForReorder ? (
          <form onSubmit={handleReorderSubmit} className="flex flex-col gap-4">
            
            {/* Item Card Summary */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-800">{selectedAlertForReorder.itemNameAr}</span>
                <span className="text-xs font-mono font-bold text-slate-500">{selectedAlertForReorder.itemCode}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-600">
                <span>المستودع المستهدف: <strong>{selectedAlertForReorder.nodeName}</strong></span>
                <span>الرصيد الحالي: <strong className="text-red-600">{selectedAlertForReorder.qtyOperational} {selectedAlertForReorder.unit}</strong></span>
              </div>
            </div>

            {/* Source Node Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">اختيار المستودع/الوحدة المصدر للتزويد</label>
              <select
                value={sourceNodeId}
                onChange={(e) => setSourceNodeId(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500"
              >
                {nodes.filter(n => !n.id.startsWith('group-') && String(n.id) !== selectedAlertForReorder.nodeId).map(n => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            </div>

            {/* Quantity Input */}
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={`الكمية المطلوبة (${selectedAlertForReorder.unit})`}
                type="number"
                min={1}
                required
                value={reorderQuantity}
                onChange={(e) => setReorderQuantity(Number(e.target.value))}
              />
              <div className="flex flex-col justify-end text-xs text-slate-500 font-medium pb-2">
                <span>مقترحة للوصول للأمان: <strong className="text-blue-700">+{selectedAlertForReorder.suggestedReorderQty} {selectedAlertForReorder.unit}</strong></span>
              </div>
            </div>

            {/* Notes */}
            <Input
              label="سبب الطلب وملاحظات"
              value={reorderNotes}
              onChange={(e) => setReorderNotes(e.target.value)}
            />

            {/* Footer Buttons */}
            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setIsReorderModalOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" variant="primary" disabled={submittingReorder}>
                {submittingReorder ? 'جاري إرسال الطلب...' : 'إرسال طلب التزويد'}
              </Button>
            </div>

          </form>
        ) : null}
      </Modal>

      {/* DETAILED ALERT MODAL */}
      <Modal
        isOpen={!!detailedAlert}
        onClose={() => setDetailedAlert(null)}
        title={detailedAlert ? `بطاقة حالة التنبيه للصنف: ${detailedAlert.itemNameAr}` : ''}
      >
        {detailedAlert && (
          <div className="flex flex-col gap-4 text-right select-none">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center">
              <div>
                <span className="text-[10px] text-slate-400 font-bold">كود الصنف</span>
                <p className="text-sm font-bold text-slate-800">{detailedAlert.itemCode}</p>
              </div>
              <Badge variant={detailedAlert.status === 'out_of_stock' ? 'danger' : 'warning'}>
                {detailedAlert.status === 'out_of_stock' ? 'نافذ بالكامل' : 'وشيك على النفاد'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 border rounded-lg bg-white">
                <span className="text-slate-400 block text-[10px]">الموقع التشغيلي</span>
                <strong className="text-slate-800">{detailedAlert.nodeName}</strong>
              </div>
              <div className="p-3 border rounded-lg bg-white">
                <span className="text-slate-400 block text-[10px]">الفئة</span>
                <strong className="text-slate-800">{detailedAlert.category}</strong>
              </div>
              <div className="p-3 border rounded-lg bg-white">
                <span className="text-slate-400 block text-[10px]">الرصيد التشغيلي الحالي</span>
                <strong className="text-red-700">{detailedAlert.qtyOperational} {detailedAlert.unit}</strong>
              </div>
              <div className="p-3 border rounded-lg bg-white">
                <span className="text-slate-400 block text-[10px]">حد الطلب للأمان</span>
                <strong className="text-slate-800">{detailedAlert.reorderLevel} {detailedAlert.unit}</strong>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex justify-between items-center text-xs">
              <span className="font-bold text-blue-900">الكمية التقديرية المقترحة لإعادة المخزون لحالة المستقر:</span>
              <span className="text-lg font-extrabold text-blue-700">+{detailedAlert.suggestedReorderQty} {detailedAlert.unit}</span>
            </div>

            <div className="flex justify-between items-center mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const alertItem = detailedAlert;
                  setDetailedAlert(null);
                  handleOpenEditThreshold(alertItem);
                }}
                className="text-indigo-700 border-indigo-200 bg-indigo-50"
              >
                تعديل حد التنبيه لهذا الصنف
              </Button>
              <Button 
                variant="primary" 
                size="sm" 
                onClick={() => {
                  const alertItem = detailedAlert;
                  setDetailedAlert(null);
                  handleOpenReorder(alertItem);
                }}
              >
                تقديم طلب تزويد لهذا الصنف
              </Button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}