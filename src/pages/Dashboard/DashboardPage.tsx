import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Package,
  Layers,
  ArrowLeftRight,
  FileClock,
  AlertTriangle,
  ArrowUpRight,
  PlusCircle,
  CheckCircle2,
  WashingMachine,
  Hotel,
  Boxes,
  PieChart as PieChartIcon,
  BarChart3,
  RefreshCw,
  Send
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Loader from '../../components/ui/Loader';
import { hierarchyApi } from '../../api/hierarchy.api';
import type { StockItem } from '../../types/inventory';
import { transferApi } from '../../features/transfer/api/transfer.api';
import TransferDetailsDialog from '../../features/transfer/dialogs/TransferDetailsDialog';
import { alertsApi } from '../../api/alerts.api';
import { warehousesApi } from '../../api/warehouses.api';
import type { OperationsRequest } from '../../types/request';
import type { OrganizationNode } from '../../types/hierarchy';
import type { TransferTransaction } from '../../types/transaction';
import type { Warehouse } from '../../types/warehouse';

import { useWarehouseScope } from '../../hooks/useWarehouseScope';
import { useAuth } from '../../context/AuthContext';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    currentNodeId,
    isGlobalAdmin,
    isFromNodeLocked
  } = useWarehouseScope();

  const currentUserName = user?.fullNameAr || user?.full_name_ar || user?.username || 'المستخدم الحالي';

  // ─── States ──────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [selectedHubFilter, setSelectedHubFilter] = useState<'all' | '6' | '11' | '29'>('all');
  
  // Data states
  const [flatNodes, setFlatNodes] = useState<OrganizationNode[]>([]);
  const [allStockList, setAllStockList] = useState<StockItem[]>([]);
  const [transactions, setTransactions] = useState<TransferTransaction[]>([]);
  const [requests, setRequests] = useState<OperationsRequest[]>([]);
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [warehousesList, setWarehousesList] = useState<Warehouse[]>([]);
  const [parentEntities, setParentEntities] = useState<Warehouse[]>([]);

  // Dialogs
  const [selectedTransferId, setSelectedTransferId] = useState<number | string | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  // Form states
  const [requestForm, setRequestForm] = useState<{
    unitId: string;
    type: 'transfer' | 'consumption' | 'return' | 'damage' | 'waste' | 'disposal';
    creator: string;
    itemName: string;
    requiredQty: number;
    unit: string;
    notes: string;
  }>({
    unitId: currentNodeId ? String(currentNodeId) : '',
    type: 'transfer',
    creator: currentUserName,
    itemName: '',
    requiredQty: 10,
    unit: 'حبة',
    notes: ''
  });

  const [transferForm, setTransferForm] = useState({
    sku: '',
    quantity: 10,
    fromUnitId: '',
    toUnitId: '',
    handler: currentUserName,
    notes: ''
  });

  const [sourceNodeItems, setSourceNodeItems] = useState<StockItem[]>([]);
  const [loadingSourceItems, setLoadingSourceItems] = useState(false);
  const [formSuccessMessage, setFormSuccessMessage] = useState('');

  // ─── Data Loading ────────────────────────────────────────────────────────────
  const loadData = async () => {
    try {
      setLoading(true);

      // 1. Fetch live hierarchy tree & canonical operational warehouses
      const [tree, { allWarehouses, parentEntities: parents }] = await Promise.all([
        hierarchyApi.getTree(),
        warehousesApi.getOperationalWarehouses(true)
      ]);

      // Flatten tree
      const flattened: OrganizationNode[] = [];
      const recurse = (list: OrganizationNode[]) => {
        for (const item of list) {
          flattened.push(item);
          if (item.children && item.children.length > 0) {
            recurse(item.children);
          }
        }
      };
      recurse(tree);
      setFlatNodes(flattened);
      setParentEntities(parents);

      // 2. Fetch stock items
      const stock = await hierarchyApi.getStock();
      setAllStockList(stock || []);

      // 3. Fetch live transfers & requests
      const transfers = await transferApi.getTransfers(currentNodeId || undefined);
      setTransactions(transfers.map(t => ({
        txnId: t.id,
        txnType: t.txnType as any,
        sku: '',
        quantity: t.itemCount,
        unit: 'صنف',
        fromNodeId: t.fromNodeId,
        toNodeId: t.toNodeId || 0,
        fromNodeName: t.fromNodeNameAr || '',
        toNodeName: t.toNodeNameAr || '',
        createdAt: t.createdAt,
        createdBy: String(t.createdByNameAr || t.createdBy || 'مستخدم'),
        status: t.status,
        notes: (t as any).reason || undefined
      })));

      setRequests(transfers.map(t => ({
        id: t.id,
        requestingNodeId: t.fromNodeId,
        requestingNodeName: t.fromNodeNameAr || 'مستودع',
        createdBy: String(t.createdByNameAr || t.createdBy || 'مستخدم'),
        createdAt: t.createdAt,
        status: t.status as any,
        type: t.txnType as any,
        items: []
      })));

      // 4. Fetch alerts
      const scopedNodeId = !isGlobalAdmin && currentNodeId ? String(currentNodeId) : undefined;
      const alerts = await alertsApi.getAlerts(scopedNodeId);
      setLowStockCount(alerts.length);

      // 5. Active operational child units
      const operationalList = allWarehouses.filter(w => w.status === 'active');
      setWarehousesList(operationalList);

      if (operationalList.length > 0) {
        const defaultFrom = !isGlobalAdmin && currentNodeId ? String(currentNodeId) : String(operationalList[0].id);
        setRequestForm(prev => prev.unitId ? prev : { ...prev, unitId: defaultFrom });
        setTransferForm(prev => ({
          ...prev,
          fromUnitId: prev.fromUnitId || defaultFrom,
          toUnitId: prev.toUnitId || String(operationalList.find(w => String(w.id) !== defaultFrom)?.id || defaultFrom)
        }));
      }

    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentNodeId, isGlobalAdmin]);

  // Load source unit items for transfer modal
  useEffect(() => {
    if (!transferForm.fromUnitId || !isTransferModalOpen) return;
    const fetchSourceStock = async () => {
      setLoadingSourceItems(true);
      try {
        const stock = await hierarchyApi.getNodeStock(transferForm.fromUnitId);
        const available = (stock || []).filter(item => (item.qty_operational || 0) > 0);
        setSourceNodeItems(available);
        if (available.length > 0) {
          setTransferForm(prev => ({
            ...prev,
            sku: available[0].item_code,
            quantity: Math.min(prev.quantity || 1, available[0].qty_operational || 1)
          }));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingSourceItems(false);
      }
    };
    fetchSourceStock();
  }, [transferForm.fromUnitId, isTransferModalOpen]);

  // ─── Filtered Data By Selected Hub ──────────────────────────────────────────
  const activeStock = useMemo(() => {
    if (selectedHubFilter === 'all') return allStockList;
    const hubId = Number(selectedHubFilter);
    // Find all node IDs in this hub's subtree
    const targetParent = parentEntities.find(p => p.nodeId === hubId);
    if (!targetParent) return allStockList.filter(s => s.nodeId === hubId);

    const relatedNodeIds = [
      hubId,
      ...warehousesList.filter(w => w.parentNodeId === hubId).map(w => w.nodeId)
    ];
    return allStockList.filter(s => s.nodeId !== undefined && relatedNodeIds.includes(s.nodeId));
  }, [allStockList, selectedHubFilter, parentEntities, warehousesList]);

  // ─── Specific 3 Hubs Metrics ────────────────────────────────────────────────
  const hubsData = useMemo(() => {
    const calcForHub = (nodeId: number, defaultName: string, code: string, iconType: 'palace' | 'garden' | 'laundry') => {
      const relatedIds = [
        nodeId,
        ...warehousesList.filter(w => w.parentNodeId === nodeId).map(w => w.nodeId)
      ];
      const hubStock = allStockList.filter(s => s.nodeId !== undefined && relatedIds.includes(s.nodeId));
      const totalQty = hubStock.reduce((acc, s) => acc + (s.qty_operational || 0), 0);
      const itemsCount = hubStock.length;
      const childUnitsCount = warehousesList.filter(w => w.parentNodeId === nodeId).length;

      return {
        id: nodeId,
        name: defaultName,
        code,
        iconType,
        totalQty,
        itemsCount,
        childUnitsCount,
        stockItems: hubStock
      };
    };

    const palace = calcForHub(11, 'فندق بالاس إسكان', '106', 'palace');
    const garden = calcForHub(6, 'فندق جاردن إسكان', '109', 'garden');
    const laundry = calcForHub(29, 'المغسلة المركزية', '136', 'laundry');

    const grandTotal = (palace.totalQty + garden.totalQty + laundry.totalQty) || 1;

    return {
      palace: { ...palace, sharePct: Math.round((palace.totalQty / grandTotal) * 100) },
      garden: { ...garden, sharePct: Math.round((garden.totalQty / grandTotal) * 100) },
      laundry: { ...laundry, sharePct: Math.round((laundry.totalQty / grandTotal) * 100) },
      grandTotal
    };
  }, [allStockList, warehousesList]);

  // Top 5 Stock Items in Active View
  const topStockItems = useMemo(() => {
    const aggregated: Record<string, { code: string; name: string; unit: string; qty: number }> = {};
    activeStock.forEach(item => {
      const key = item.item_code;
      if (!aggregated[key]) {
        aggregated[key] = {
          code: item.item_code,
          name: item.item_name_ar || item.item_name || 'صنف',
          unit: item.unit || 'وحدة',
          qty: 0
        };
      }
      aggregated[key].qty += (item.qty_operational || 0);
    });

    return Object.values(aggregated)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [activeStock]);

  const maxTopQty = topStockItems.length > 0 ? topStockItems[0].qty : 1;

  // KPIs
  const todayStr = new Date().toISOString().substring(0, 10);
  const todayTransfersCount = transactions.filter(tx => (tx.createdAt || '').startsWith(todayStr)).length;
  const pendingRequestsCount = requests.filter(req => req.status === 'pending').length;
  const totalOperationalQty = activeStock.reduce((acc, s) => acc + (s.qty_operational || 0), 0);

  // ─── Modal Submissions ──────────────────────────────────────────────────────
  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await transferApi.createTransferDraft({
        txnType: 'internal_transfer',
        fromNodeId: Number(requestForm.unitId),
        toNodeId: null,
        notes: `طلب تموين: ${requestForm.itemName} - ${requestForm.notes}`,
        lines: [{ itemCode: 'REQ-ITEM', quantity: requestForm.requiredQty }]
      });
      setFormSuccessMessage('تم تقديم طلبك بنجاح وجاري إرساله للمراجعة.');
      setTimeout(() => {
        setIsRequestModalOpen(false);
        setFormSuccessMessage('');
        loadData();
      }, 1200);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await transferApi.createTransferDraft({
        txnType: 'internal_transfer',
        fromNodeId: Number(transferForm.fromUnitId),
        toNodeId: Number(transferForm.toUnitId),
        notes: transferForm.notes,
        lines: [{ itemCode: transferForm.sku, quantity: transferForm.quantity }]
      });
      setFormSuccessMessage('تم تسجيل عملية التحويل بنجاح.');
      setTimeout(() => {
        setIsTransferModalOpen(false);
        setFormSuccessMessage('');
        loadData();
      }, 1200);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <Loader size="lg" label="جاري تحميل بيانات وإحصائيات لوحة التحكم..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fadeIn pb-12">
      
      {/* ─── 1. HERO & HUB FILTER HEADER ────────────────────────────────────── */}
      <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Boxes size={18} />
            </div>
            <div>
              <h1 className="text-lg lg:text-xl font-black text-slate-800 tracking-tight">
                لوحة التحكم والعمليات الموحدة
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                إدارة ومتابعة المخازن الرئيسية الثلاثة وحركات العهدة الداخلية المربوطة بنظام COMSYS ERP
              </p>
            </div>
          </div>
        </div>

        {/* Hub Selector Tabs / Filter */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-100/80 p-1.5 rounded-xl border border-slate-200/60 w-full lg:w-auto">
          <span className="text-[11px] font-bold text-slate-500 px-2">نطاق العرض:</span>
          {[
            { id: 'all', label: 'كافة المنشآت', count: 3 },
            { id: '11', label: 'فندق بالاس إسكان', code: '106' },
            { id: '6', label: 'فندق جاردن إسكان', code: '109' },
            { id: '29', label: 'المغسلة المركزية', code: '136' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedHubFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedHubFilter === tab.id
                  ? 'bg-white text-blue-600 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              {tab.label}
              {tab.code && (
                <span className="text-[10px] px-1 py-0.2 bg-slate-200 text-slate-600 rounded">
                  {tab.code}
                </span>
              )}
            </button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadData()}
            className="p-1.5 h-8 text-slate-500 hover:text-blue-600"
            title="تحديث البيانات"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {/* ─── 2. PRIMARY KPI METRICS ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {[
          {
            label: 'المخازن الرئيسية',
            value: '3 مخازن',
            sub: '+ ' + (warehousesList.length - 3) + ' وحدات وأدوار',
            icon: Building2,
            color: 'text-blue-600 bg-blue-50/70 border-blue-200/60',
            link: '/warehouses'
          },
          {
            label: 'الأصناف المتوفرة',
            value: activeStock.length.toLocaleString(),
            sub: 'صنف ذو رصيد فعلي',
            icon: Layers,
            color: 'text-indigo-600 bg-indigo-50/70 border-indigo-200/60',
            link: '/inventory'
          },
          {
            label: 'الرصيد التشغيلي',
            value: Math.round(totalOperationalQty).toLocaleString(),
            sub: 'إجمالي الكميات المتاحة',
            icon: Package,
            color: 'text-emerald-600 bg-emerald-50/70 border-emerald-200/60',
            link: '/inventory'
          },
          {
            label: 'حركات اليوم',
            value: todayTransfersCount,
            sub: 'تحويلات وصرف نفذ اليوم',
            icon: ArrowLeftRight,
            color: 'text-purple-600 bg-purple-50/70 border-purple-200/60',
            link: '/requests'
          },
          {
            label: 'الطلبات المعلقة',
            value: pendingRequestsCount,
            sub: 'بانتظار الاعتماد والموافقة',
            icon: FileClock,
            color: 'text-amber-600 bg-amber-50/70 border-amber-200/60',
            link: '/requests'
          },
          {
            label: 'تحت حد الأمان',
            value: lowStockCount,
            sub: 'أصناف بحاجة لإعادة طلب',
            icon: AlertTriangle,
            color: 'text-rose-600 bg-rose-50/70 border-rose-200/60',
            link: '/inventory'
          }
        ].map((kpi, idx) => (
          <Card
            key={idx}
            hoverable
            className="cursor-pointer border-slate-200/80 transition-transform duration-150 hover:-translate-y-0.5"
            onClick={() => navigate(kpi.link)}
          >
            <Card.Body className="p-3.5 flex flex-col justify-between h-full gap-2.5">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold text-slate-500">{kpi.label}</span>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${kpi.color}`}>
                  <kpi.icon size={15} />
                </div>
              </div>
              <div>
                <span className="text-xl font-black text-slate-800 leading-tight block">
                  {kpi.value}
                </span>
                <span className="text-[10px] text-slate-400 font-semibold leading-tight block mt-0.5">
                  {kpi.sub}
                </span>
              </div>
            </Card.Body>
          </Card>
        ))}
      </div>

      {/* ─── 3. THE 3 CORE HUBS EXECUTIVE CARDS ──────────────────────────────── */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <Building2 size={16} className="text-blue-600" />
            حالة المخازن الرئيسية الثلاثة (COMSYS Linked Hubs)
          </h2>
          <span className="text-xs text-slate-400 font-semibold">
            المخازن المعتمدة الوحيدة لاستقبال عهدة كومسيس وتوزيعها
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Hub 1: Palace Hotel */}
          <div 
            onClick={() => setSelectedHubFilter(selectedHubFilter === '11' ? 'all' : '11')}
            className={`bg-white border rounded-2xl p-4 transition-all duration-200 cursor-pointer relative overflow-hidden ${
              selectedHubFilter === '11'
                ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
                : 'border-slate-200/80 hover:border-indigo-300 hover:shadow-xs'
            }`}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center">
                  <Hotel size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 leading-tight">فندق بالاس إسكان</h3>
                  <span className="text-[11px] font-bold text-indigo-600">كود كومسيس: 106</span>
                </div>
              </div>
              <Badge variant="info">{hubsData.palace.sharePct}% من الإجمالي</Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 text-xs mb-3">
              <div>
                <span className="text-[10px] text-slate-400 block font-bold">الرصيد المتوفر:</span>
                <span className="text-sm font-black text-slate-800">
                  {Math.round(hubsData.palace.totalQty).toLocaleString()} وحدة
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold">الأصناف الموزعة:</span>
                <span className="text-sm font-black text-slate-800">
                  {hubsData.palace.itemsCount} صنف
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold pt-1 border-t border-slate-100">
              <span>{hubsData.palace.childUnitsCount} أدوار ووحدات تابعة</span>
              <span className="text-indigo-600 font-bold flex items-center gap-1 hover:underline">
                استعراض الأصناف ←
              </span>
            </div>
          </div>

          {/* Hub 2: Garden Hotel */}
          <div 
            onClick={() => setSelectedHubFilter(selectedHubFilter === '6' ? 'all' : '6')}
            className={`bg-white border rounded-2xl p-4 transition-all duration-200 cursor-pointer relative overflow-hidden ${
              selectedHubFilter === '6'
                ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                : 'border-slate-200/80 hover:border-emerald-300 hover:shadow-xs'
            }`}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 leading-tight">فندق جاردن إسكان</h3>
                  <span className="text-[11px] font-bold text-emerald-600">كود كومسيس: 109</span>
                </div>
              </div>
              <Badge variant="success">{hubsData.garden.sharePct}% من الإجمالي</Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 text-xs mb-3">
              <div>
                <span className="text-[10px] text-slate-400 block font-bold">الرصيد المتوفر:</span>
                <span className="text-sm font-black text-slate-800">
                  {Math.round(hubsData.garden.totalQty).toLocaleString()} وحدة
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold">الأصناف الموزعة:</span>
                <span className="text-sm font-black text-slate-800">
                  {hubsData.garden.itemsCount} صنف
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold pt-1 border-t border-slate-100">
              <span>{hubsData.garden.childUnitsCount} أدوار ووحدات تابعة</span>
              <span className="text-emerald-600 font-bold flex items-center gap-1 hover:underline">
                استعراض الأصناف ←
              </span>
            </div>
          </div>

          {/* Hub 3: Laundry */}
          <div 
            onClick={() => setSelectedHubFilter(selectedHubFilter === '29' ? 'all' : '29')}
            className={`bg-white border rounded-2xl p-4 transition-all duration-200 cursor-pointer relative overflow-hidden ${
              selectedHubFilter === '29'
                ? 'border-cyan-500 ring-2 ring-cyan-500/20 shadow-md'
                : 'border-slate-200/80 hover:border-cyan-300 hover:shadow-xs'
            }`}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-700 border border-cyan-200 flex items-center justify-center">
                  <WashingMachine size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 leading-tight">المغسلة المركزية</h3>
                  <span className="text-[11px] font-bold text-cyan-600">كود كومسيس: 136</span>
                </div>
              </div>
              <Badge variant="info">مستودع بياضات</Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 text-xs mb-3">
              <div>
                <span className="text-[10px] text-slate-400 block font-bold">رصيد المفروشات:</span>
                <span className="text-sm font-black text-slate-800">
                  {Math.round(hubsData.laundry.totalQty).toLocaleString()} قطعة
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold">أصناف الغسيل:</span>
                <span className="text-sm font-black text-slate-800">
                  {hubsData.laundry.itemsCount} صنف
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold pt-1 border-t border-slate-100">
              <span>دورات تشغيل البياضات</span>
              <span className="text-cyan-600 font-bold flex items-center gap-1 hover:underline" onClick={(e) => { e.stopPropagation(); navigate('/laundry'); }}>
                لوحة المغسلة ←
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* ─── 4. CHARTS & VISUAL ANALYTICS ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart 1: Stock Distribution Donut / Progress Visual */}
        <Card className="border-slate-200/80">
          <Card.Body className="p-5 flex flex-col justify-between h-full">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <PieChartIcon size={16} className="text-indigo-600" />
                  نسبة توزيع المخزون بين الكيانات
                </h3>
              </div>

              {/* Progress Stack Bar */}
              <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex shadow-inner mb-4">
                <div
                  style={{ width: `${hubsData.palace.sharePct}%` }}
                  className="bg-indigo-600 h-full transition-all duration-500"
                  title={`فندق بالاس: ${hubsData.palace.sharePct}%`}
                />
                <div
                  style={{ width: `${hubsData.garden.sharePct}%` }}
                  className="bg-emerald-500 h-full transition-all duration-500"
                  title={`فندق جاردن: ${hubsData.garden.sharePct}%`}
                />
                <div
                  style={{ width: `${Math.max(hubsData.laundry.sharePct, 2)}%` }}
                  className="bg-cyan-500 h-full transition-all duration-500"
                  title={`المغسلة: ${hubsData.laundry.sharePct}%`}
                />
              </div>

              {/* Legend List */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-indigo-50/50 border border-indigo-100/60">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-indigo-600 flex-shrink-0" />
                    <span className="font-bold text-slate-800">فندق بالاس إسكان</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-800">{Math.round(hubsData.palace.totalQty).toLocaleString()}</span>
                    <span className="text-[10px] text-slate-400 font-bold">({hubsData.palace.sharePct}%)</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-emerald-50/50 border border-emerald-100/60">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0" />
                    <span className="font-bold text-slate-800">فندق جاردن إسكان</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-800">{Math.round(hubsData.garden.totalQty).toLocaleString()}</span>
                    <span className="text-[10px] text-slate-400 font-bold">({hubsData.garden.sharePct}%)</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-cyan-50/50 border border-cyan-100/60">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-cyan-500 flex-shrink-0" />
                    <span className="font-bold text-slate-800">المغسلة المركزية</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-800">{Math.round(hubsData.laundry.totalQty).toLocaleString()}</span>
                    <span className="text-[10px] text-slate-400 font-bold">(&lt; 1%)</span>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 font-medium text-center mt-4">
              إجمالي العهدة الموزعة والمتاحة: <strong className="text-slate-700">{Math.round(hubsData.grandTotal).toLocaleString()}</strong> وحدة
            </p>
          </Card.Body>
        </Card>

        {/* Chart 2: Top Stock Items Visual Bars */}
        <Card className="border-slate-200/80 lg:col-span-2">
          <Card.Body className="p-5 flex flex-col justify-between h-full">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <BarChart3 size={16} className="text-blue-600" />
                  أعلى الأصناف كمية في نطاق العرض المختار
                </h3>
                <span className="text-[11px] font-bold text-blue-600 cursor-pointer hover:underline" onClick={() => navigate('/inventory')}>
                  عرض كامل المخزون ({activeStock.length})
                </span>
              </div>

              {topStockItems.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">لا توجد أصناف في هذا النطاق</div>
              ) : (
                <div className="flex flex-col gap-3">
                  {topStockItems.map((item, idx) => {
                    const pct = Math.min(Math.round((item.qty / maxTopQty) * 100), 100);
                    return (
                      <div key={idx} className="flex flex-col gap-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">
                              {item.code}
                            </span>
                            {item.name}
                          </span>
                          <span className="font-black text-slate-900">
                            {item.qty.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{item.unit}</span>
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            style={{ width: `${pct}%` }} 
                            className={`h-full rounded-full transition-all duration-500 ${
                              idx === 0 ? 'bg-blue-600' : idx === 1 ? 'bg-indigo-500' : 'bg-slate-400'
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-4 text-[11px] text-slate-400">
              <span>يتم التحديث آنياً من حركات الشحن والاستهلاك</span>
              <span className="text-emerald-600 font-bold">✓ مطابق لقيود كومسيس التشغيلية</span>
            </div>
          </Card.Body>
        </Card>

      </div>

      {/* ─── 5. RECENT ACTIVITY & QUICK ACTIONS ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Live Transfers Feed (Takes 2 Columns) */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <ArrowLeftRight size={16} className="text-blue-600" />
              آخر حركات التحويل والتوزيع الميداني
            </h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/requests')}>
              كامل سجل التحويلات
              <ArrowUpRight size={14} />
            </Button>
          </div>

          <Card className="border-slate-200/80 overflow-hidden">
            <Card.Body className="p-0">
              <div className="divide-y divide-slate-100">
                {transactions.length === 0 ? (
                  <div className="p-10 text-center text-xs text-slate-400">لا توجد حركات مسجلة حتى الآن</div>
                ) : (
                  transactions.slice(0, 5).map((tx, idx) => {
                    const fromName = flatNodes.find(n => Number(n.id) === tx.fromNodeId || n.id === String(tx.fromNodeId))?.name || tx.fromNodeName || 'المستودع الرئيسي';
                    const toName = flatNodes.find(n => Number(n.id) === tx.toNodeId || n.id === String(tx.toNodeId))?.name || tx.toNodeName || 'المستودع الهدف';

                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedTransferId(tx.txnId)}
                        className="flex items-center justify-between p-3.5 hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200/60 text-blue-600 flex items-center justify-center font-bold text-xs">
                            #{tx.txnId}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-800 block group-hover:text-blue-600 transition-colors">
                              {tx.notes || 'تحويل عهدة مخزنية بينية'}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 font-semibold">
                              <span>{new Date(tx.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                              <span>•</span>
                              <span>بواسطة: {tx.createdBy}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-left text-xs">
                            <span className="font-black text-slate-800 block">
                              {tx.quantity ? `${tx.quantity} أصناف` : 'تم النقل'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {fromName} ← {toName}
                            </span>
                          </div>
                          <Badge variant={tx.status === 'completed' ? 'success' : tx.status === 'pending' ? 'warning' : 'info'}>
                            {tx.status === 'completed' ? 'مكتمل' : tx.status === 'pending' ? 'قيد الموافقة' : 'شحنة جارية'}
                          </Badge>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card.Body>
          </Card>
        </div>

        {/* Quick Actions Shortcuts */}
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <PlusCircle size={16} className="text-emerald-600" />
            إجراءات تشغيلية سريعة
          </h3>

          <Card className="border-slate-200/80">
            <Card.Body className="p-4 flex flex-col gap-2.5">
              <Button
                variant="primary"
                className="w-full justify-center text-xs py-2.5 font-bold shadow-xs"
                onClick={() => setIsTransferModalOpen(true)}
              >
                <ArrowLeftRight size={15} />
                تحويل مخزني بين الفروع
              </Button>

              <Button
                variant="outline"
                className="w-full justify-center text-xs py-2.5 font-bold border-slate-200"
                onClick={() => setIsRequestModalOpen(true)}
              >
                <Send size={15} />
                طلب تموين عهدة داخلية
              </Button>

              <Button
                variant="outline"
                className="w-full justify-center text-xs py-2.5 font-bold border-slate-200 text-slate-700"
                onClick={() => navigate('/warehouses')}
              >
                <Building2 size={15} />
                إدارة مستودعات الهيكل
              </Button>

              <Button
                variant="outline"
                className="w-full justify-center text-xs py-2.5 font-bold border-cyan-200 bg-cyan-50/50 text-cyan-800 hover:bg-cyan-100/50"
                onClick={() => navigate('/laundry')}
              >
                <WashingMachine size={15} />
                لوحة تحكم المغسلة والبياضات
              </Button>
            </Card.Body>
          </Card>
        </div>

      </div>

      {/* ─── 6. CREATE REQUEST MODAL ────────────────────────────────────────── */}
      <Modal isOpen={isRequestModalOpen} onClose={() => setIsRequestModalOpen(false)} title="تقديم طلب مخزني داخلي">
        {formSuccessMessage ? (
          <div className="flex flex-col items-center justify-center py-6 text-center gap-3">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-100">
              <CheckCircle2 size={24} />
            </div>
            <p className="text-sm font-bold text-slate-800">{formSuccessMessage}</p>
          </div>
        ) : (
          <form onSubmit={handleRequestSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">نوع الطلب</label>
                <select
                  value={requestForm.type}
                  onChange={(e) => setRequestForm({ ...requestForm, type: e.target.value as any })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                >
                  <option value="transfer">تحويل داخلي</option>
                  <option value="consumption">استهلاك قسم</option>
                  <option value="return">مرتجع مستودع</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">الجهة الطالبة (القسم/المستودع)</label>
                <select
                  disabled={isFromNodeLocked}
                  value={requestForm.unitId}
                  onChange={(e) => setRequestForm({ ...requestForm, unitId: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500 disabled:bg-slate-100"
                >
                  {warehousesList.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <Input
              label="اسم الصنف المطلوب"
              placeholder="مثال: فوطة حمام قطن فاخر"
              required
              value={requestForm.itemName}
              onChange={(e) => setRequestForm({ ...requestForm, itemName: e.target.value })}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="الكمية المطلوبة"
                type="number"
                min={1}
                required
                value={requestForm.requiredQty}
                onChange={(e) => setRequestForm({ ...requestForm, requiredQty: Number(e.target.value) })}
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">وحدة القياس</label>
                <select
                  value={requestForm.unit}
                  onChange={(e) => setRequestForm({ ...requestForm, unit: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                >
                  <option value="حبة">حبة</option>
                  <option value="قطعة">قطعة</option>
                  <option value="كرتون">كرتون</option>
                  <option value="كجم">كجم</option>
                </select>
              </div>
            </div>

            <Input
              label="ملاحظات الطلب"
              placeholder="مثال: تموين عاجل للدور الأول"
              value={requestForm.notes}
              onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })}
            />

            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setIsRequestModalOpen(false)}>إلغاء</Button>
              <Button type="submit" variant="primary">تقديم الطلب</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ─── 7. CREATE TRANSFER MODAL ───────────────────────────────────────── */}
      <Modal isOpen={isTransferModalOpen} onClose={() => setIsTransferModalOpen(false)} title="تسجيل عملية تحويل بين المخازن">
        {formSuccessMessage ? (
          <div className="flex flex-col items-center justify-center py-6 text-center gap-3">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-100">
              <CheckCircle2 size={24} />
            </div>
            <p className="text-sm font-bold text-slate-800">{formSuccessMessage}</p>
          </div>
        ) : (
          <form onSubmit={handleTransferSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">من مستودع (المصدر)</label>
                <select
                  disabled={isFromNodeLocked}
                  value={transferForm.fromUnitId}
                  onChange={(e) => setTransferForm({ ...transferForm, fromUnitId: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500 disabled:bg-slate-100"
                >
                  {warehousesList.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">إلى مستودع (المستهدف)</label>
                <select
                  value={transferForm.toUnitId}
                  onChange={(e) => setTransferForm({ ...transferForm, toUnitId: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                >
                  {warehousesList.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">الصنف المراد تحويله</label>
              {loadingSourceItems ? (
                <div className="py-2 text-xs text-slate-400 flex items-center gap-1.5">
                  <Loader size="sm" />
                  جاري تحميل أصناف المستودع المصدر...
                </div>
              ) : sourceNodeItems.length === 0 ? (
                <div className="py-2.5 px-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-bold">
                  ⚠️ لا توجد أصناف ذات رصيد متاح في هذا المستودع حالياً لنقلها
                </div>
              ) : (
                <select
                  value={transferForm.sku}
                  onChange={(e) => {
                    const newSku = e.target.value;
                    const stockItem = sourceNodeItems.find(i => i.item_code === newSku);
                    const maxQty = stockItem?.qty_operational || 1;
                    setTransferForm({
                      ...transferForm,
                      sku: newSku,
                      quantity: Math.min(transferForm.quantity || 1, maxQty)
                    });
                  }}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500 font-semibold"
                >
                  {sourceNodeItems.map((item, idx) => (
                    <option key={`${item.item_code}-${idx}`} value={item.item_code}>
                      {item.item_name_ar} ({item.item_code}) — متاح: {item.qty_operational}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="الكمية المحولة"
                type="number"
                min={1}
                max={sourceNodeItems.find(i => i.item_code === transferForm.sku)?.qty_operational || 1}
                required
                disabled={sourceNodeItems.length === 0}
                value={transferForm.quantity}
                onChange={(e) => setTransferForm({ ...transferForm, quantity: Number(e.target.value) })}
              />
              <Input
                label="المسؤول المفوّض"
                required
                value={transferForm.handler}
                onChange={(e) => setTransferForm({ ...transferForm, handler: e.target.value })}
              />
            </div>

            <Input
              label="ملاحظات التحويل"
              placeholder="مثال: تموين عاجل لتغطية الاستهلاك اليومي"
              value={transferForm.notes}
              onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
            />

            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setIsTransferModalOpen(false)}>إلغاء</Button>
              <Button type="submit" variant="primary" disabled={sourceNodeItems.length === 0}>تسجيل التحويل</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ─── 8. TRANSFER DETAILS SLIDE-OVER ─────────────────────────────────── */}
      <TransferDetailsDialog
        transferId={selectedTransferId}
        isOpen={!!selectedTransferId}
        onClose={() => setSelectedTransferId(null)}
        onSuccess={() => loadData()}
      />

    </div>
  );
}