import React, { useState, useEffect } from 'react';
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
  Eye,
  CheckCircle2
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Loader from '../../components/ui/Loader';
import { hierarchyApi } from '../../api/hierarchy.api';
import type { StockItem } from '../../types/inventory';
import { transactionsApi } from '../../api/transactions.api';
import { requestsApi } from '../../api/requests.api';
import { alertsApi } from '../../api/alerts.api';
import { warehousesApi } from '../../api/warehouses.api';
import type { OperationsRequest } from '../../types/request';
import type { OrganizationNode } from '../../types/hierarchy';
import type { TransferTransaction } from '../../types/transaction';
import type { Warehouse } from '../../types/warehouse';

export default function DashboardPage() {
  const navigate = useNavigate();

  // States
  const [flatNodes, setFlatNodes] = useState<OrganizationNode[]>([]);
  const [totalStockItems, setTotalStockItems] = useState<number>(0);
  const [totalOperationalQty, setTotalOperationalQty] = useState<number>(0);
  const [transactions, setTransactions] = useState<TransferTransaction[]>([]);
  const [requests, setRequests] = useState<OperationsRequest[]>([]);
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [activeWarehousesCount, setActiveWarehousesCount] = useState<number>(0);
  const [warehousesList, setWarehousesList] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
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
    unitId: '',
    type: 'transfer',
    creator: 'عبدالرحمن محمد',
    itemName: '',
    requiredQty: 10,
    unit: 'كجم',
    notes: ''
  });

  const [transferForm, setTransferForm] = useState({
    sku: '',
    quantity: 10,
    fromUnitId: '',
    toUnitId: '',
    handler: 'أحمد محمود',
    notes: ''
  });

  const [sourceNodeItems, setSourceNodeItems] = useState<StockItem[]>([]);
  const [loadingSourceItems, setLoadingSourceItems] = useState(false);
  const [formSuccessMessage, setFormSuccessMessage] = useState('');

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

  // Load Main Dashboard Data
  const loadData = async () => {
    try {
      // 1. Get hierarchy tree and flatten it
      const tree = await hierarchyApi.getTree();
      const flat = flattenNodes(tree);
      setFlatNodes(flat);

      // Initialize default selectors if not set
      if (flat.length > 0) {
        setRequestForm(prev => prev.unitId ? prev : { ...prev, unitId: flat[0].id });
      }

      // 2. Fetch all stock items to sum operational qty
      const stock = await hierarchyApi.getStock();
      setTotalStockItems(stock.length);
      const sumQty = stock.reduce((sum, i) => sum + (i.qty_operational || 0), 0);
      setTotalOperationalQty(sumQty);

      // 3. Fetch requests
      const reqs = await requestsApi.getRequests();
      setRequests(reqs || []);

      // 4. Fetch transfers
      const txs = await transactionsApi.getTransfers();
      setTransactions(txs || []);

      // 5. Fetch low stock count
      const alerts = await alertsApi.getAlerts();
      setLowStockCount(alerts.length);

      // 6. Fetch active warehouses count
      const warehouses = await warehousesApi.getWarehouses();
      setActiveWarehousesCount(warehouses.filter(w => w.status === 'active').length);
      setWarehousesList(warehouses);

      // Default for transfer units using real warehouses
      if (warehouses.length > 0) {
        setRequestForm(prev => prev.unitId ? prev : { ...prev, unitId: warehouses[0].id });
        setTransferForm(prev => {
          const fromId = prev.fromUnitId || warehouses[0].id;
          const toId = prev.toUnitId || (warehouses[1] ? warehouses[1].id : warehouses[0].id);
          return { ...prev, fromUnitId: fromId, toUnitId: toId };
        });
      }

    } catch (error) {
      console.error('Error loading dashboard data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch available items of source unit in transfer modal
  useEffect(() => {
    if (!transferForm.fromUnitId || !isTransferModalOpen) return;
    const loadSourceStock = async () => {
      setLoadingSourceItems(true);
      try {
        const stock = await hierarchyApi.getNodeStock(transferForm.fromUnitId);
        setSourceNodeItems(stock || []);
        if (stock && stock.length > 0) {
          setTransferForm(prev => ({ ...prev, sku: stock[0].item_code }));
        } else {
          setTransferForm(prev => ({ ...prev, sku: '' }));
        }
      } catch (err) {
        console.error('Error loading source node items:', err);
        setSourceNodeItems([]);
      } finally {
        setLoadingSourceItems(false);
      }
    };
    loadSourceStock();
  }, [transferForm.fromUnitId, isTransferModalOpen]);

  // Handlers
  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const selectedUnit = warehousesList.find(un => un.id === requestForm.unitId);

      await requestsApi.createRequest({
        requestingNodeId: Number(requestForm.unitId.replace(/\D/g, '')) || 11,
        requestingNodeName: selectedUnit ? selectedUnit.name : 'مطبخ جاردن الشرقي',
        createdBy: requestForm.creator,
        type: requestForm.type,
        items: [
          {
            itemCode: 'ITEM-' + Date.now(),
            itemName: requestForm.itemName,
            unit: requestForm.unit,
            requestedQty: Number(requestForm.requiredQty)
          }
        ]
      });

      setFormSuccessMessage('تم تقديم طلب الصرف بنجاح!');
      setTimeout(() => {
        setIsRequestModalOpen(false);
        setFormSuccessMessage('');
        setRequestForm(prev => ({
          ...prev,
          itemName: '',
          requiredQty: 10,
          notes: ''
        }));
        loadData();
      }, 1500);
    } catch (error) {
      console.error(error);
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferForm.sku) return;
    try {
      await transactionsApi.createTransfer({
        sku: transferForm.sku,
        quantity: Number(transferForm.quantity),
        fromUnitId: transferForm.fromUnitId,
        toUnitId: transferForm.toUnitId,
        handler: transferForm.handler,
        notes: transferForm.notes
      });

      setFormSuccessMessage('تم تسجيل عملية التحويل بنجاح!');
      setTimeout(() => {
        setIsTransferModalOpen(false);
        setFormSuccessMessage('');
        setTransferForm(prev => ({
          ...prev,
          quantity: 10,
          notes: ''
        }));
        loadData();
      }, 1500);
    } catch (error) {
      console.error(error);
    }
  };

  // KPIs calculations
  const todayStr = new Date().toISOString().substring(0, 10);
  const todayTransfers = transactions.filter(tx => (tx.createdAt || '').startsWith(todayStr)).length;
  const pendingRequests = requests.filter(req => req.status === 'pending').length;

  // Render Loader
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader size="lg" label="جاري تحميل إحصائيات لوحة التحكم..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Hero Welcome Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs gap-4 select-none">
        <div>
          <h1 className="text-xl lg:text-2xl font-extrabold text-slate-800">نظرة عامة على العمليات والمخزون</h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-1">
            متابعة فورية لكميات المخزون، التحويلات البينية بين الوحدات، وطلبات التموين التشغيلية المربوطة بـ COMSYS ERP.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/organization')}>
            <Building2 size={16} />
            الهيكل التنظيمي
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/inventory')}>
            <Package size={16} />
            استعراض المخزون
          </Button>
        </div>
      </div>

      {/* Interactive KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: 'المستودعات النشطة', value: activeWarehousesCount, icon: Building2, color: 'text-blue-600 bg-blue-50 border-blue-100', link: '/organization' },
          { label: 'إجمالي الأصناف', value: totalStockItems, icon: Layers, color: 'text-indigo-600 bg-indigo-50 border-indigo-100', link: '/inventory' },
          { label: 'إجمالي الكميات', value: totalOperationalQty.toLocaleString(), icon: Package, color: 'text-emerald-600 bg-emerald-50 border-emerald-100', link: '/inventory' },
          { label: 'حركات اليوم', value: todayTransfers, icon: ArrowLeftRight, color: 'text-purple-600 bg-purple-50 border-purple-100', link: '/transactions' },
          { label: 'الطلبات المعلقة', value: pendingRequests, icon: FileClock, color: 'text-amber-600 bg-amber-50 border-amber-100', link: '/requests' },
          { label: 'منخفض المخزون', value: lowStockCount, icon: AlertTriangle, color: `text-red-600 bg-red-50 border-red-100`, link: '/inventory' }
        ].map((kpi, idx) => (
          <Card
            key={idx}
            hoverable
            className="cursor-pointer border-slate-200/60"
            onClick={() => navigate(kpi.link)}
          >
            <Card.Body className="p-4 flex flex-col justify-between h-full gap-4">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold text-slate-500">{kpi.label}</span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${kpi.color}`}>
                  <kpi.icon size={16} />
                </div>
              </div>
              <div>
                <span className="text-xl font-extrabold text-slate-800 leading-none">{kpi.value}</span>
              </div>
            </Card.Body>
          </Card>
        ))}
      </div>

      {/* Main Sections Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent Activity Timeline (Takes 2 Cols) */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <ArrowLeftRight size={18} className="text-blue-600" />
              آخر الحركات والنشاطات
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/transactions')}>
              عرض السجل بالكامل
              <ArrowUpRight size={14} />
            </Button>
          </div>

          <Card className="border-slate-200/60">
            <Card.Body className="p-0">
              <div className="divide-y divide-slate-100">
                {transactions.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">لا توجد حركات مسجلة اليوم</div>
                ) : (
                  transactions.slice(0, 5).map((tx, idx) => {
                    const fromName = flatNodes.find(n => Number(n.id) === tx.fromNodeId || n.id === String(tx.fromNodeId))?.name || 'مستودع مصدر';
                    const toName = flatNodes.find(n => Number(n.id) === tx.toNodeId || n.id === String(tx.toNodeId))?.name || 'مستودع هدف';

                    return (
                      <div key={idx} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center font-bold text-[10px] text-slate-700">
                            {tx.sku || `#${tx.txnId}`}
                          </div>
                          <div className="flex flex-col text-right">
                            <span className="text-sm font-bold text-slate-800">{tx.sku ? `تحويل الصنف ${tx.sku}` : tx.notes || 'تحويل مخزني داخلي'}</span>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-slate-400 font-semibold">
                                {new Date(tx.createdAt).toLocaleDateString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="text-[10px] text-slate-300">•</span>
                              <span className="text-[10px] text-slate-500 font-medium">بواسطة {tx.createdBy}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col items-end">
                            <span className="text-sm font-extrabold text-slate-800">
                              {tx.quantity ? `${tx.quantity} ${tx.unit || ''}` : 'تم النقل'}
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5 leading-none">
                              {fromName} ← {toName}
                            </span>
                          </div>
                          <Badge variant="info">تحويل داخلي</Badge>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card.Body>
          </Card>
        </div>

        {/* Quick Access Actions & Live Requests Summary (1 Col) */}
        <div className="flex flex-col gap-6">
          {/* Quick Access */}
          <div className="flex flex-col gap-4">
            <h2 className="text-base font-bold text-slate-800">إجراءات سريعة</h2>
            <div className="grid grid-cols-1 gap-3">
              {[
                { title: 'عرض المخزون', desc: 'استعراض مستويات وكميات السلع وتصديرها', onClick: () => navigate('/inventory'), icon: Eye, color: 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100' },
                { title: 'إنشاء طلب مخزني', desc: 'تقديم طلب صرف، هدر، أو إرجاع للمستودعات', onClick: () => setIsRequestModalOpen(true), icon: PlusCircle, color: 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100' },
                { title: 'نقل بين المخازن', desc: 'نقل كميات بين الأقسام والبارات والمطابخ', onClick: () => setIsTransferModalOpen(true), icon: ArrowLeftRight, color: 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100' },
                { title: 'استعراض الوحدات', desc: 'تتبع الهيكل الإداري والعهدة التشغيلية', onClick: () => navigate('/organization'), icon: Building2, color: 'bg-purple-50 text-purple-600 border-purple-100 hover:bg-purple-100' }
              ].map((act, idx) => (
                <div
                  key={idx}
                  onClick={act.onClick}
                  className="flex items-center gap-3 p-3 bg-white border border-slate-200/80 rounded-xl hover:border-slate-300 transition-all cursor-pointer group"
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-all ${act.color}`}>
                    <act.icon size={16} className="group-hover:scale-105" />
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-xs font-bold text-slate-800">{act.title}</span>
                    <span className="text-[10px] text-slate-400 font-medium mt-0.5">{act.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Requests Summary */}
          <div className="flex flex-col gap-4">
            <h2 className="text-base font-bold text-slate-800">طلبات الصرف الأخيرة</h2>
            <Card className="border-slate-200/60">
              <Card.Body className="p-4 flex flex-col gap-3">
                {requests.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-400">لا توجد طلبات صرف حالية</div>
                ) : (
                  requests.slice(0, 3).map((req, idx) => {
                    const statusMap = {
                      pending: { text: 'انتظار الاعتماد', variant: 'warning' },
                      approved: { text: 'معتمد للصرف', variant: 'info' },
                      issued: { text: 'تم الصرف', variant: 'success' },
                      rejected: { text: 'مرفوض', variant: 'danger' }
                    };
                    const statusInfo = statusMap[req.status] || { text: 'غير معروف', variant: 'neutral' };

                    return (
                      <div key={idx} className="flex justify-between items-center p-2.5 bg-slate-50 border border-slate-100 rounded-lg hover:border-slate-200/80 transition-colors">
                        <div className="flex flex-col text-right">
                          <span className="text-xs font-bold text-slate-800">{req.requestingNodeName}</span>
                          <span className="text-[10px] text-slate-400 mt-1 font-semibold">{req.id} • {req.createdAt}</span>
                        </div>
                        <Badge variant={statusInfo.variant as any}>{statusInfo.text}</Badge>
                      </div>
                    );
                  })
                )}
              </Card.Body>
            </Card>
          </div>
        </div>

      </div>

      {/* CREATE REQUEST MODAL */}
      <Modal isOpen={isRequestModalOpen} onClose={() => setIsRequestModalOpen(false)} title="تقديم طلب مخزني جديد">
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
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="transfer">تحويل داخلي</option>
                  <option value="consumption">استهلاك قسم</option>
                  <option value="return">مرتجع مستودع</option>
                  <option value="damage">تلفيات</option>
                  <option value="waste">هالك هدر</option>
                  <option value="disposal">إعدام مواد</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">الجهة الطالبة (القسم/المستودع)</label>
                <select
                  value={requestForm.unitId}
                  onChange={(e) => setRequestForm({ ...requestForm, unitId: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  {warehousesList.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <Input
              label="اسم الصنف المطلوب"
              placeholder="مثال: بن هرري محمص فاخر"
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
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="كجم">كجم</option>
                  <option value="لتر">لتر</option>
                  <option value="حبة">حبة</option>
                  <option value="كرتون">كرتون</option>
                  <option value="جالون">جالون</option>
                </select>
              </div>
            </div>

            <Input
              label="اسم مقدم الطلب"
              required
              value={requestForm.creator}
              onChange={(e) => setRequestForm({ ...requestForm, creator: e.target.value })}
            />

            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setIsRequestModalOpen(false)}>إلغاء</Button>
              <Button type="submit" variant="primary">تقديم الطلب</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* CREATE TRANSFER MODAL */}
      <Modal isOpen={isTransferModalOpen} onClose={() => setIsTransferModalOpen(false)} title="تسجيل عملية تحويل بيني للمخزون">
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
                <label className="text-xs font-bold text-slate-700">من وحدة (المصدر)</label>
                <select
                  value={transferForm.fromUnitId}
                  onChange={(e) => setTransferForm({ ...transferForm, fromUnitId: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  {warehousesList.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">إلى وحدة (المستهدف)</label>
                <select
                  value={transferForm.toUnitId}
                  onChange={(e) => setTransferForm({ ...transferForm, toUnitId: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
                  جاري تحميل أصناف الوحدة المصدر...
                </div>
              ) : sourceNodeItems.length === 0 ? (
                <div className="py-2 px-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">
                  لا توجد أصناف متوفرة في الوحدة المصدر المختارة!
                </div>
              ) : (
                <select
                  value={transferForm.sku}
                  onChange={(e) => setTransferForm({ ...transferForm, sku: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  {sourceNodeItems.map(item => (
                    <option key={item.item_code} value={item.item_code}>
                      {item.item_name_ar} ({item.item_code}) - متاح: {item.qty_operational} {item.unit || 'وحدة'}
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
              placeholder="مثال: تحويل عاجل لسد عجز المخزون بالفندق الرئيسي"
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

    </div>
  );
}