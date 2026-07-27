import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  RotateCw, 
  Search, 
  Calendar, 
  DollarSign, 
  ArrowLeftRight, 
  AlertTriangle,
  Briefcase,
  Flame,
  Droplets,
  Activity,
  Plus,
  Trash2,
  CheckCircle,
  FileText,
  AlertCircle,
  ShieldAlert,
  Send,
  ClipboardCheck,
  X
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Loader from '../../components/ui/Loader';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import { laundryApi } from '../../api/laundry.api';
import { warehousesApi } from '../../api/warehouses.api';
import { useAuth } from '../../context/AuthContext';
import type { 
  LaundryReconciliation, 
  ProfitabilityRecord, 
  LaundryTransfer, 
  LaundryReturn, 
  LaundryLoss
} from '../../types/laundry';
import type { Warehouse } from '../../types/warehouse';

// Preset standard linen items for quick input
const STANDARD_LINENS = [
  { itemCode: 'LIN-001', itemNameAr: 'شراشف سرير كينج' },
  { itemCode: 'LIN-002', itemNameAr: 'شراشف سرير فردي' },
  { itemCode: 'LIN-003', itemNameAr: 'أغطية وسائد بيضاء' },
  { itemCode: 'LIN-004', itemNameAr: 'مناشف استحمام كبيرة' },
  { itemCode: 'LIN-005', itemNameAr: 'مناشف يد متوسطة' },
  { itemCode: 'LIN-006', itemNameAr: 'أرواب حمام قطنية' },
  { itemCode: 'LIN-007', itemNameAr: 'مفارش طاولة طعام' },
  { itemCode: 'LIN-008', itemNameAr: 'مناديل سفرة مطعم' }
];

export default function ReportsReconciliation() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage_laundry_operations');
  const canReceive = hasPermission('receive_laundry_items');
  const canViewPOS = hasPermission('view_laundry_pos');
  const canViewFull = hasPermission('view_laundry');

  const availableTabs = [
    { id: 'reconciliation' as const, label: 'مطابقة حركة الأرصدة والتحليل', icon: BarChart3, show: canViewFull || canManage || canViewPOS || canReceive },
    { id: 'transfers' as const, label: 'تحويلات واستلام البياضات (Sent)', icon: ArrowLeftRight, show: canViewFull || canManage || canReceive },
    { id: 'returns' as const, label: 'مرتجعات المغسلة النظيفة (Returned)', icon: ClipboardCheck, show: canViewFull || canManage || canReceive },
    { id: 'losses' as const, label: 'سجل التالف والهالك (Scrap)', icon: ShieldAlert, show: canViewFull || canManage }
  ].filter(t => t.show);

  const [activeTab, setActiveTab] = useState<'reconciliation' | 'transfers' | 'returns' | 'losses'>(
    availableTabs.length > 0 ? availableTabs[0].id : 'reconciliation'
  );

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.some(t => t.id === activeTab)) {
      setActiveTab(availableTabs[0].id);
    }
  }, [canManage, canReceive, canViewPOS, canViewFull]);

  const [reconciliation, setReconciliation] = useState<LaundryReconciliation[]>([]);
  const [profitability, setProfitability] = useState<ProfitabilityRecord[]>([]);
  const [transfers, setTransfers] = useState<LaundryTransfer[]>([]);
  const [returns, setReturns] = useState<LaundryReturn[]>([]);
  const [losses, setLosses] = useState<LaundryLoss[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dateFilter, setDateFilter] = useState({
    fromDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    toDate: new Date().toISOString().split('T')[0]
  });

  // Modal control states
  const [isCreateTransferOpen, setIsCreateTransferOpen] = useState(false);
  const [isCreateReturnOpen, setIsCreateReturnOpen] = useState(false);
  const [selectedReceiveTransfer, setSelectedReceiveTransfer] = useState<LaundryTransfer | null>(null);
  const [selectedVerifyReturn, setSelectedVerifyReturn] = useState<LaundryReturn | null>(null);

  // Search state variables for lists and selectors
  const [warehouseSearch, setWarehouseSearch] = useState('');
  const [transferSearch, setTransferSearch] = useState('');
  const [reconciliationSearch, setReconciliationSearch] = useState('');
  const [transfersSearch, setTransfersSearch] = useState('');
  const [returnsSearch, setReturnsSearch] = useState('');
  const [lossesSearch, setLossesSearch] = useState('');
  const [transferItemSearch, setTransferItemSearch] = useState('');

  // --- FORM STATES ---
  // Create Transfer Form
  const [transferForm, setTransferForm] = useState({
    fromWarehouseId: '',
    notes: '',
    items: [] as { itemCode: string; itemNameAr: string; sentQty: number }[]
  });
  const [transferItemInput, setTransferItemInput] = useState({
    itemCode: 'LIN-001',
    sentQty: 10
  });

  // Receive Transfer Form
  const [receiveForm, setReceiveForm] = useState<{
    transferId: number;
    notes: string;
    items: { itemCode: string; actualQty: number; rejectReason: string; rejectNotes: string }[];
  }>({
    transferId: 0,
    notes: '',
    items: []
  });

  // Create Return Form
  const [returnForm, setReturnForm] = useState({
    transferId: '',
    notes: '',
    items: [] as { itemCode: string; itemNameAr: string; expectedQty: number; maxRemaining: number }[]
  });

  // Verify Return Form
  const [verifyForm, setVerifyForm] = useState<{
    returnId: number;
    status: 'partial_received' | 'completed' | 'rejected' | 'disputed';
    notes: string;
    items: { itemCode: string; actualQty: number; rejectReason: string; rejectNotes: string }[];
  }>({
    returnId: 0,
    status: 'completed',
    notes: '',
    items: []
  });

  // Record Loss Form
  const [lossForm, setLossForm] = useState({
    itemCode: 'LIN-001',
    quantity: 1,
    reason: 'Torn' as LaundryLoss['reason'],
    cost: 50
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [recList, profList, transList, retList, lossList, whList] = await Promise.all([
        laundryApi.getReconciliationReport(),
        laundryApi.getProfitabilityReport(dateFilter.fromDate, dateFilter.toDate),
        laundryApi.getTransfers(),
        laundryApi.getReturns(),
        laundryApi.getLosses(),
        warehousesApi.getWarehouses()
      ]);
      setReconciliation(recList || []);
      setProfitability(profList || []);
      setTransfers(transList || []);
      setReturns(retList || []);
      setLosses(lossList || []);
      setWarehouses(whList || []);
    } catch (err) {
      console.error('Error loading reports/transfers/returns details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dateFilter.fromDate, dateFilter.toDate]);

  // Reset search variables on modal open/close
  useEffect(() => {
    if (!isCreateTransferOpen) {
      setWarehouseSearch('');
      setTransferItemSearch('');
      setTransferItemInput({
        itemCode: 'LIN-001',
        sentQty: 10
      });
    }
  }, [isCreateTransferOpen]);

  useEffect(() => {
    if (!isCreateReturnOpen) {
      setTransferSearch('');
      setReturnForm({
        transferId: '',
        notes: '',
        items: []
      });
    }
  }, [isCreateReturnOpen]);

  // Sync selected options when filters change
  useEffect(() => {
    const filtered = STANDARD_LINENS.filter(l =>
      l.itemNameAr.toLowerCase().includes(transferItemSearch.toLowerCase()) ||
      l.itemCode.toLowerCase().includes(transferItemSearch.toLowerCase())
    );
    if (filtered.length > 0 && !filtered.some(l => l.itemCode === transferItemInput.itemCode)) {
      setTransferItemInput(prev => ({ ...prev, itemCode: filtered[0].itemCode }));
    }
  }, [transferItemSearch, transferItemInput.itemCode]);

  useEffect(() => {
    const filtered = warehouses.filter(w => 
      w.name.toLowerCase().includes(warehouseSearch.toLowerCase())
    );
    if (transferForm.fromWarehouseId && !filtered.some(w => String(w.id) === transferForm.fromWarehouseId)) {
      setTransferForm(prev => ({ ...prev, fromWarehouseId: '' }));
    }
  }, [warehouseSearch, warehouses, transferForm.fromWarehouseId]);

  useEffect(() => {
    const filtered = transfers
      .filter(t => t.status === 'received' && (t.items || []).some(i => i.remainingQty > 0))
      .filter(t => 
        String(t.id).includes(transferSearch) ||
        t.fromWarehouseName.toLowerCase().includes(transferSearch.toLowerCase())
      );
    if (returnForm.transferId && !filtered.some(t => String(t.id) === returnForm.transferId)) {
      setReturnForm(prev => ({ ...prev, transferId: '', items: [] }));
    }
  }, [transferSearch, transfers, returnForm.transferId]);

  // Aggregate profitability totals
  const totalRevenue = profitability.reduce((sum, r) => sum + r.revenue, 0);
  const totalChemical = profitability.reduce((sum, r) => sum + r.chemicalCost, 0);
  const totalUtilities = profitability.reduce((sum, r) => sum + r.utilitiesCost, 0);
  const totalLabor = profitability.reduce((sum, r) => sum + r.laborCost, 0);
  const totalLoss = profitability.reduce((sum, r) => sum + r.lossCost, 0);
  const totalNetProfit = totalRevenue - (totalChemical + totalUtilities + totalLabor + totalLoss);

  const grandTotalCost = totalChemical + totalUtilities + totalLabor + totalLoss;
  const chemPct = grandTotalCost ? Math.round((totalChemical / grandTotalCost) * 100) : 0;
  const utilPct = grandTotalCost ? Math.round((totalUtilities / grandTotalCost) * 100) : 0;
  const laborPct = grandTotalCost ? Math.round((totalLabor / grandTotalCost) * 100) : 0;
  const lossPct = grandTotalCost ? Math.round((totalLoss / grandTotalCost) * 100) : 0;

  // --- ACTIONS ---

  // 1. Create Transfer Draft
  const handleAddTransferItem = () => {
    const matched = STANDARD_LINENS.find(l => l.itemCode === transferItemInput.itemCode);
    if (!matched) return;
    if (transferItemInput.sentQty <= 0) {
      alert('يجب إدخال كمية أكبر من الصفر.');
      return;
    }
    const exists = transferForm.items.find(i => i.itemCode === transferItemInput.itemCode);
    if (exists) {
      setTransferForm(prev => ({
        ...prev,
        items: prev.items.map(i => i.itemCode === transferItemInput.itemCode ? { ...i, sentQty: i.sentQty + transferItemInput.sentQty } : i)
      }));
    } else {
      setTransferForm(prev => ({
        ...prev,
        items: [...prev.items, { itemCode: transferItemInput.itemCode, itemNameAr: matched.itemNameAr, sentQty: transferItemInput.sentQty }]
      }));
    }
    // Clear search and reset the picker selection
    setTransferItemSearch('');
    setTransferItemInput({
      itemCode: 'LIN-001',
      sentQty: 10
    });
  };

  const handleRemoveTransferItem = (code: string) => {
    setTransferForm(prev => ({
      ...prev,
      items: prev.items.filter(i => i.itemCode !== code)
    }));
  };

  const handleCreateTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferForm.fromWarehouseId) {
      alert('يجب اختيار المستودع المرسل.');
      return;
    }
    if (transferForm.items.length === 0) {
      alert('يجب إضافة صنف واحد على الأقل للتحويل.');
      return;
    }
    try {
      setSubmitting(true);
      await laundryApi.createTransfer({
        fromWarehouseId: Number(transferForm.fromWarehouseId),
        notes: transferForm.notes,
        items: transferForm.items.map(i => ({
          itemCode: i.itemCode,
          itemNameAr: i.itemNameAr,
          sentQty: i.sentQty,
          unitCode: 'PCS',
          unitCost: 150 // Standard estimated replacement value
        }))
      });
      setIsCreateTransferOpen(false);
      setTransferForm({ fromWarehouseId: '', notes: '', items: [] });
      loadData();
    } catch (err: any) {
      console.error(err);
      alert('خطأ أثناء حفظ مسودة التحويل: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Send Transfer (Dispatch to Laundry)
  const handleSendTransfer = async (transferId: number) => {
    if (!confirm('هل أنت متأكد من إرسال شحنة البياضات هذه إلى المغسلة؟')) return;
    try {
      setSubmitting(true);
      await laundryApi.sendTransfer(transferId);
      loadData();
    } catch (err: any) {
      console.error(err);
      alert('خطأ أثناء إرسال الشحنة للمغسلة: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Receive & Verify Transfer (Laundry Side)
  const handleOpenReceiveModal = (t: LaundryTransfer) => {
    setSelectedReceiveTransfer(t);
    setReceiveForm({
      transferId: t.id,
      notes: '',
      items: (t.items || []).map(item => ({
        itemCode: item.itemCode,
        actualQty: item.sentQty,
        rejectReason: '',
        rejectNotes: ''
      }))
    });
  };

  const handleReceiveTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceiveTransfer) return;
    try {
      setSubmitting(true);
      await laundryApi.receiveTransfer({
        transferId: receiveForm.transferId,
        notes: receiveForm.notes,
        items: receiveForm.items.map(i => ({
          itemCode: i.itemCode,
          actualQty: Number(i.actualQty),
          rejectReason: i.rejectReason || null,
          rejectNotes: i.rejectNotes || null
        }))
      });
      setSelectedReceiveTransfer(null);
      loadData();
    } catch (err: any) {
      console.error(err);
      alert('خطأ أثناء تأكيد استلام الشحنة: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Create Clean Return Draft (Laundry to Hotel)
  const handleTransferChangeInReturn = (tId: string) => {
    const selectedTrans = transfers.find(t => t.id === Number(tId));
    if (!selectedTrans) {
      setReturnForm(prev => ({ ...prev, transferId: tId, items: [] }));
      return;
    }
    // Render lines for items with remainingQty > 0
    const lines = (selectedTrans.items || [])
      .filter(i => i.remainingQty > 0)
      .map(i => ({
        itemCode: i.itemCode,
        itemNameAr: i.itemNameAr,
        expectedQty: i.remainingQty, // Default to returning all remaining outstanding
        maxRemaining: i.remainingQty
      }));
    setReturnForm({
      transferId: tId,
      notes: '',
      items: lines
    });
  };

  const handleCreateReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnForm.transferId) {
      alert('يجب اختيار شحنة التحويل الأصلية.');
      return;
    }
    const filteredItems = returnForm.items.filter(i => i.expectedQty > 0);
    if (filteredItems.length === 0) {
      alert('يجب تحديد كميات إرجاع أكبر من الصفر لصنف واحد على الأقل.');
      return;
    }
    // Check constraint
    for (const item of filteredItems) {
      if (item.expectedQty > item.maxRemaining) {
        alert(`الكمية المرتجعة للصنف ${item.itemNameAr} تتجاوز الرصيد المتبقي المعلق في المغسلة (${item.maxRemaining} حبة)`);
        return;
      }
    }
    try {
      setSubmitting(true);
      await laundryApi.createReturn({
        transferId: Number(returnForm.transferId),
        notes: returnForm.notes,
        items: filteredItems.map(i => ({
          itemCode: i.itemCode,
          itemNameAr: i.itemNameAr,
          expectedQty: Number(i.expectedQty)
        }))
      });
      setIsCreateReturnOpen(false);
      setReturnForm({ transferId: '', notes: '', items: [] });
      loadData();
    } catch (err: any) {
      console.error(err);
      alert('خطأ أثناء إنشاء مستند المرتجع: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  // 5. Verify Clean Return (Hotel Side)
  const handleOpenVerifyReturnModal = (r: LaundryReturn) => {
    setSelectedVerifyReturn(r);
    setVerifyForm({
      returnId: r.id,
      status: 'completed',
      notes: '',
      items: (r.items || []).map(item => ({
        itemCode: item.itemCode,
        actualQty: item.expectedQty,
        rejectReason: '',
        rejectNotes: ''
      }))
    });
  };

  const handleVerifyReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVerifyReturn) return;
    try {
      setSubmitting(true);
      await laundryApi.verifyReturn(verifyForm.returnId, {
        status: verifyForm.status,
        notes: verifyForm.notes,
        items: verifyForm.items.map(i => ({
          itemCode: i.itemCode,
          actualQty: Number(i.actualQty),
          rejectReason: i.rejectReason || null,
          rejectNotes: i.rejectNotes || null
        }))
      });
      setSelectedVerifyReturn(null);
      loadData();
    } catch (err: any) {
      console.error(err);
      alert('خطأ أثناء اعتماد استلام المرتجع: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  // 6. Record Loss/Scrap
  const handleCreateLossSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const matched = STANDARD_LINENS.find(l => l.itemCode === lossForm.itemCode);
    if (!matched) return;
    try {
      setSubmitting(true);
      await laundryApi.createLoss({
        itemCode: lossForm.itemCode,
        itemNameAr: matched.itemNameAr,
        quantity: Number(lossForm.quantity),
        reason: lossForm.reason,
        cost: Number(lossForm.cost),
        batchId: null
      });
      setLossForm({ itemCode: 'LIN-001', quantity: 1, reason: 'Torn', cost: 50 });
      loadData();
    } catch (err: any) {
      console.error(err);
      alert('خطأ أثناء تسجيل هالك بياضات: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 font-arabic dir-rtl select-none text-right">
      
      {/* Header section */}
      <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-extrabold text-slate-800 flex items-center gap-2">
            <BarChart3 size={24} className="text-blue-600" />
            التقارير والمطابقة الدورية للبياضات
          </h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-1">
            إدارة دورة حياة ومطابقة أرصدة المغسلة (Sent ➔ Processing ➔ Returned ➔ Scrap) ومراقبة فروقات العهدة والتكاليف المالية.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex gap-2 items-center bg-slate-50 border border-slate-200/80 p-1.5 rounded-xl">
            <Calendar size={16} className="text-slate-400 mr-2" />
            <input
              type="date"
              value={dateFilter.fromDate}
              onChange={(e) => setDateFilter({ ...dateFilter, fromDate: e.target.value })}
              className="bg-transparent text-xs font-bold text-slate-750 outline-none cursor-pointer"
            />
            <span className="text-xs text-slate-400 font-bold px-1">إلى</span>
            <input
              type="date"
              value={dateFilter.toDate}
              onChange={(e) => setDateFilter({ ...dateFilter, toDate: e.target.value })}
              className="bg-transparent text-xs font-bold text-slate-750 outline-none cursor-pointer"
            />
          </div>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RotateCw size={14} />
            تحديث البيانات
          </Button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-200/80 gap-1.5 bg-white p-1 rounded-xl shadow-2xs border">
        {availableTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-5 py-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-blue-50 text-blue-600 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/70'
            }`}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Loader size="lg" label="جاري تحميل أرصدة دورات المطابقة التشغيلية..." />
      ) : (
        <>
          {/* TAB 1: RECONCILIATION & ANALYSIS */}
          {activeTab === 'reconciliation' && (
            <div className="flex flex-col gap-6">
              {/* Financial aggregate KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'إجمالي إيرادات المغسلة (POS)', value: `${totalRevenue.toLocaleString()} ج.م`, trend: 'نشط من تذاكر النزلاء', isUp: true, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
                  { label: 'تكاليف الكيماويات والمواد', value: `${totalChemical.toLocaleString()} ج.م`, trend: 'ضمن معايير الجرعات الكيميائية', isUp: false, color: 'text-blue-600 bg-blue-50 border-blue-100' },
                  { label: 'تقديرات الكهرباء والمياه', value: `${totalUtilities.toLocaleString()} ج.م`, trend: 'تقديري بالاعتماد على التشغيل', isUp: false, color: 'text-purple-600 bg-purple-50 border-purple-100' },
                  { label: 'صافي أرباح التشغيل', value: `${totalNetProfit.toLocaleString()} ج.م`, trend: `هامش ربح صافي ${totalRevenue ? Math.round((totalNetProfit / totalRevenue) * 100) : 0}%`, isUp: true, color: 'text-rose-600 bg-rose-50 border-rose-100' }
                ].map((kpi, idx) => (
                  <Card key={idx} className="border-slate-200/60 shadow-2xs">
                    <Card.Body className="p-4 flex flex-col justify-between h-full gap-3">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-slate-500">{kpi.label}</span>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${kpi.color}`}>
                          <DollarSign size={16} />
                        </div>
                      </div>
                      <div>
                        <span className="text-lg md:text-xl font-extrabold text-slate-800 leading-none">{kpi.value}</span>
                        <p className="text-[10px] mt-1 font-bold text-slate-400">{kpi.trend}</p>
                      </div>
                    </Card.Body>
                  </Card>
                ))}
              </div>

              {/* Grid: Cost Factor progress + SVG joint pipeline */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Cost factors (1 Col) */}
                <div className="flex flex-col gap-4">
                  <h2 className="text-base font-bold text-slate-800">تحليل وتوزيع التكاليف التشغيلية</h2>
                  <Card className="border-slate-200/60 shadow-2xs bg-white">
                    <Card.Body className="p-4 flex flex-col gap-5">
                      <div className="flex flex-col gap-4">
                        {[
                          { name: 'الكيماويات والمطهرات', pct: chemPct, amt: totalChemical, icon: Flame, color: 'bg-orange-500' },
                          { name: 'المرافق العامة (كهرباء/مياه)', pct: utilPct, amt: totalUtilities, icon: Droplets, color: 'bg-blue-500' },
                          { name: 'أجور اليد العاملة والتشغيل', pct: laborPct, amt: totalLabor, icon: Briefcase, color: 'bg-indigo-500' },
                          { name: 'بياضات تالفة وهالك (Scrap)', pct: lossPct, amt: totalLoss, icon: AlertTriangle, color: 'bg-rose-500' }
                        ].map((factor, idx) => (
                          <div key={idx} className="flex flex-col gap-1 text-xs">
                            <div className="flex justify-between items-center font-bold text-slate-700">
                              <span className="flex items-center gap-1">
                                <factor.icon size={14} className="text-slate-400" />
                                {factor.name}
                              </span>
                              <span>{factor.pct}% ({factor.amt.toLocaleString()} ج.م)</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full ${factor.color} rounded-full`} style={{ width: `${factor.pct}%` }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-slate-100 pt-4 flex justify-between items-center text-xs text-slate-500 font-bold">
                        <span>إجمالي مصاريف التشغيل:</span>
                        <span className="text-slate-800 text-sm font-extrabold">{grandTotalCost.toLocaleString()} ج.م</span>
                      </div>
                    </Card.Body>
                  </Card>
                </div>

                {/* SVG Pipeline diagram (2 Cols) */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <ArrowLeftRight size={18} className="text-blue-600" />
                    مخطط الأنابيب ومسار مطابقة عهدة الغسيل التشغيلية
                  </h2>
                  <Card className="border-slate-200/60 shadow-2xs">
                    <Card.Body className="p-4">
                      
                      {/* Visual Joint Pipeline Diagram */}
                      <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl p-6 mb-6 text-white relative shadow-inner">
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none rounded-2xl" />
                        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6 text-center">
                          
                          {/* Node 1: Sent */}
                          <div className="flex-1 w-full md:w-auto">
                            <div className="bg-blue-600/90 border border-blue-400 text-white rounded-xl p-4 shadow-lg shadow-blue-500/10">
                              <span className="text-[9px] font-bold block uppercase tracking-wider opacity-80">العهدة المستلمة (المرسلة)</span>
                              <span className="text-lg lg:text-xl font-extrabold mt-1.5 block">
                                {reconciliation.reduce((sum, item) => sum + item.sentQty, 0).toLocaleString()} حبة
                              </span>
                            </div>
                          </div>

                          {/* Connecting Pipe 1 */}
                          <div className="hidden md:block w-12 h-2 relative flex-shrink-0">
                            <svg className="w-full h-full overflow-visible" viewBox="0 0 48 8">
                              <line x1="0" y1="4" x2="48" y2="4" stroke="#3b82f6" strokeWidth="6" strokeLinecap="round" opacity="0.3" />
                              <line x1="0" y1="4" x2="48" y2="4" stroke="#60a5fa" strokeWidth="6" strokeDasharray="6,8" className="animate-pipe-flow" strokeLinecap="round" />
                            </svg>
                          </div>

                          {/* Node 2: In Progress */}
                          <div className="flex-1 w-full md:w-auto">
                            <div className="bg-amber-500/90 border border-amber-400 text-white rounded-xl p-4 shadow-lg shadow-amber-500/10">
                              <span className="text-[9px] font-bold block uppercase tracking-wider opacity-80">معلق بالمعالجة والتحضير</span>
                              <span className="text-lg lg:text-xl font-extrabold mt-1.5 block">
                                {reconciliation.reduce((sum, item) => sum + item.inProgressQty, 0).toLocaleString()} حبة
                              </span>
                            </div>
                          </div>

                          {/* Connecting Pipe 2 */}
                          <div className="hidden md:block w-12 h-2 relative flex-shrink-0">
                            <svg className="w-full h-full overflow-visible" viewBox="0 0 48 8">
                              <line x1="0" y1="4" x2="48" y2="4" stroke="#f59e0b" strokeWidth="6" strokeLinecap="round" opacity="0.3" />
                              <line x1="0" y1="4" x2="48" y2="4" stroke="#fbbf24" strokeWidth="6" strokeDasharray="6,8" className="animate-pipe-flow" strokeLinecap="round" />
                            </svg>
                          </div>

                          {/* Node 3: Returned */}
                          <div className="flex-1 w-full md:w-auto">
                            <div className="bg-emerald-600/90 border border-emerald-400 text-white rounded-xl p-4 shadow-lg shadow-emerald-500/10">
                              <span className="text-[9px] font-bold block uppercase tracking-wider opacity-80">المرتجع النظيف السليم</span>
                              <span className="text-lg lg:text-xl font-extrabold mt-1.5 block">
                                {reconciliation.reduce((sum, item) => sum + item.returnedQty, 0).toLocaleString()} حبة
                              </span>
                            </div>
                          </div>

                          {/* Connecting Pipe 3 */}
                          <div className="hidden md:block w-12 h-2 relative flex-shrink-0">
                            <svg className="w-full h-full overflow-visible" viewBox="0 0 48 8">
                              <line x1="0" y1="4" x2="48" y2="4" stroke="#10b981" strokeWidth="6" strokeLinecap="round" opacity="0.3" />
                              <line x1="0" y1="4" x2="48" y2="4" stroke="#34d399" strokeWidth="6" strokeDasharray="6,8" className="animate-pipe-flow" strokeLinecap="round" />
                            </svg>
                          </div>

                          {/* Node 4: Scrap */}
                          <div className="flex-1 w-full md:w-auto">
                            <div className="bg-rose-600/90 border border-rose-400 text-white rounded-xl p-4 shadow-lg shadow-rose-500/10">
                              <span className="text-[9px] font-bold block uppercase tracking-wider opacity-80">التالف والهالك (Scrap)</span>
                              <span className="text-lg lg:text-xl font-extrabold mt-1.5 block">
                                {reconciliation.reduce((sum, item) => sum + item.scrapQty, 0).toLocaleString()} حبة
                              </span>
                            </div>
                          </div>

                        </div>
                      </div>

                      {/* Detailed Reconciliation Table */}
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                          <h3 className="text-sm font-bold text-slate-800">بيانات مطابقة حركة البياضات وتحديد الفروقات</h3>
                          <div className="relative w-full md:w-72">
                            <input
                              type="text"
                              placeholder="البحث بالاسم أو كود الصنف..."
                              value={reconciliationSearch}
                              onChange={(e) => setReconciliationSearch(e.target.value)}
                              className="w-full pr-8 pl-3.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                            />
                            <span className="absolute right-2.5 top-2.5 text-slate-400">
                              <Search size={14} />
                            </span>
                          </div>
                        </div>

                        <div className="border border-slate-200 rounded-xl overflow-hidden text-xs bg-white">
                          <table className="w-full text-right border-collapse">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="px-4 py-3 font-bold text-slate-500">الصنف الكيميائي والعهد</th>
                                <th className="px-4 py-3 text-center font-bold text-slate-500">المرسل (Sent)</th>
                                <th className="px-4 py-3 text-center font-bold text-slate-500">المعالج (In Progress)</th>
                                <th className="px-4 py-3 text-center font-bold text-slate-500">المرتجع السليم (Returned)</th>
                                <th className="px-4 py-3 text-center font-bold text-slate-500">الهالك (Scrap)</th>
                                <th className="px-4 py-3 text-center font-bold text-slate-500">فرق الفاقد (Variance)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {reconciliation.filter(item => 
                                item.itemNameAr.toLowerCase().includes(reconciliationSearch.toLowerCase()) ||
                                item.itemCode.toLowerCase().includes(reconciliationSearch.toLowerCase())
                              ).length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="p-8 text-center text-slate-400">لا توجد سجلات مطابقة حالياً تلائم البحث.</td>
                                </tr>
                              ) : (
                                reconciliation.filter(item => 
                                  item.itemNameAr.toLowerCase().includes(reconciliationSearch.toLowerCase()) ||
                                  item.itemCode.toLowerCase().includes(reconciliationSearch.toLowerCase())
                                ).map(item => (
                                  <tr key={item.id} className={`hover:bg-slate-50/50 transition-colors ${item.variance !== 0 ? 'bg-rose-50/30' : ''}`}>
                                    <td className="px-4 py-3.5 font-bold text-slate-700 flex items-center gap-1.5">
                                      {item.variance !== 0 && <AlertCircle size={14} className="text-rose-500 animate-pulse" />}
                                      {item.itemNameAr}
                                    </td>
                                    <td className="px-4 py-3.5 text-center text-slate-650 font-medium">{item.sentQty} حبة</td>
                                    <td className="px-4 py-3.5 text-center text-amber-600 font-bold">{item.inProgressQty} حبة</td>
                                    <td className="px-4 py-3.5 text-center text-emerald-600 font-bold">{item.returnedQty} حبة</td>
                                    <td className="px-4 py-3.5 text-center text-rose-600 font-bold">{item.scrapQty} حبة</td>
                                    <td className="px-4 py-3.5 text-center">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                        item.variance === 0
                                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                          : 'bg-rose-50 text-rose-600 border-rose-100'
                                      }`}>
                                        {item.variance === 0 ? 'مطابق' : `${item.variance} حبة`}
                                      </span>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                    </Card.Body>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TRANSFERS & RECEIVING */}
          {activeTab === 'transfers' && (
            <div className="flex flex-col gap-6">
              <div className="flex justify-between items-center">
                <h2 className="text-base font-bold text-slate-800">حركة تحويل البياضات المتسخة إلى المغسلة</h2>
                {canManage && (
                  <Button variant="primary" size="sm" onClick={() => setIsCreateTransferOpen(true)}>
                    <Plus size={15} />
                    تحويل بياضات متسخة جديدة
                  </Button>
                )}
              </div>

              {/* Split view: Drafts vs Dispatched */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Drafts List (1 Col) */}
                <div className="flex flex-col gap-4">
                  <h3 className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                    <FileText size={14} />
                    مسودات التحويل المعلقة (Draft)
                  </h3>
                  <div className="flex flex-col gap-3">
                    {transfers.filter(t => t.status === 'draft').length === 0 ? (
                      <div className="bg-white border border-slate-200/60 p-6 rounded-xl text-center text-slate-400 text-xs">
                        لا توجد مسودات تحويل حالية.
                      </div>
                    ) : (
                      transfers.filter(t => t.status === 'draft').map(t => (
                        <div key={t.id} className="bg-white border border-slate-200 p-4 rounded-xl shadow-2xs flex flex-col gap-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 block">شحنة #{t.id}</span>
                              <span className="text-xs font-bold text-slate-800 block mt-0.5">{t.fromWarehouseName}</span>
                            </div>
                            <Badge variant="neutral">مسودة</Badge>
                          </div>
                          
                          <div className="text-[10px] text-slate-505 bg-slate-50 p-2 rounded-lg border border-slate-100 max-h-24 overflow-y-auto">
                            {(t.items || []).map(i => (
                              <div key={i.itemId} className="flex justify-between py-0.5">
                                <span>{i.itemNameAr}</span>
                                <span className="font-bold text-slate-700">{i.sentQty} حبة</span>
                              </div>
                            ))}
                          </div>

                          {canManage && (
                            <div className="flex justify-end gap-1.5">
                              <Button 
                                variant="primary" 
                                size="sm" 
                                onClick={() => handleSendTransfer(t.id)}
                                isLoading={submitting}
                                className="w-full justify-center"
                              >
                                <Send size={12} className="ml-1" />
                                إرسال للمغسلة
                              </Button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Dispatched & Received List (2 Cols) */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                  <div className="flex justify-between items-center gap-3">
                    <h3 className="text-xs font-bold text-slate-505 flex items-center gap-1.5">
                      <Activity size={14} />
                      أرشيف الشحنات والتحويلات النشطة
                    </h3>
                    <div className="relative w-48">
                      <input
                        type="text"
                        placeholder="ابحث برقم الشحنة أو المصدر..."
                        value={transfersSearch}
                        onChange={(e) => setTransfersSearch(e.target.value)}
                        className="w-full pr-8 pl-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                      />
                      <span className="absolute right-2 top-1.5 text-slate-400">
                        <Search size={12} />
                      </span>
                    </div>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs bg-white">
                    <table className="w-full text-right border-collapse">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2.5 font-bold text-slate-505">رقم الشحنة</th>
                          <th className="px-4 py-2.5 font-bold text-slate-505">المستودع المصدر</th>
                          <th className="px-4 py-2.5 text-center font-bold text-slate-505">الكمية الإجمالية</th>
                          <th className="px-4 py-2.5 text-center font-bold text-slate-505">تاريخ الإرسال</th>
                          <th className="px-4 py-2.5 text-center font-bold text-slate-505">الحالة</th>
                          <th className="px-4 py-2.5 text-center font-bold text-slate-505">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {transfers.filter(t => t.status !== 'draft').filter(t => 
                          String(t.id).includes(transfersSearch) || 
                          t.fromWarehouseName.toLowerCase().includes(transfersSearch.toLowerCase())
                        ).length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-400">لا توجد تحويلات نشطة مسجلة مطابقة للبحث.</td>
                          </tr>
                        ) : (
                          transfers.filter(t => t.status !== 'draft').filter(t => 
                            String(t.id).includes(transfersSearch) || 
                            t.fromWarehouseName.toLowerCase().includes(transfersSearch.toLowerCase())
                          ).map(t => {
                            const totalQty = (t.items || []).reduce((sum, i) => sum + i.sentQty, 0);
                            return (
                              <tr key={t.id} className="hover:bg-slate-50/50">
                                <td className="px-4 py-3 font-mono font-bold text-slate-505">#{t.id}</td>
                                <td className="px-4 py-3 font-bold text-slate-700">{t.fromWarehouseName}</td>
                                <td className="px-4 py-3 text-center text-slate-650 font-bold">{totalQty} حبة</td>
                                <td className="px-4 py-3 text-center text-slate-450">{new Date(t.createdAt).toLocaleDateString('ar-EG')}</td>
                                <td className="px-4 py-3 text-center">
                                  <Badge variant={t.status === 'received' ? 'success' : t.status === 'dispatched' ? 'warning' : 'neutral'}>
                                    {t.status === 'received' ? 'مستلم بالمغسلة' : t.status === 'dispatched' ? 'تحت الشحن للمغسلة' : t.status}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {t.status === 'dispatched' && (
                                    canReceive ? (
                                      <button
                                        onClick={() => handleOpenReceiveModal(t)}
                                        className="px-2.5 py-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 border border-blue-200 rounded bg-blue-50 cursor-pointer"
                                      >
                                        تأكيد الاستلام بالمغسلة
                                      </button>
                                    ) : (
                                      <span className="text-[10px] text-slate-400 font-bold">بانتظار التأكيد</span>
                                    )
                                  )}
                                  {t.status === 'received' && (
                                    <span className="text-[10px] text-emerald-600 font-bold flex items-center justify-center gap-1">
                                      <CheckCircle size={12} />
                                      مسجل ومطابق
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 3: LAUNDRY RETURNS & VERIFICATION */}
          {activeTab === 'returns' && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <h2 className="text-base font-bold text-slate-800">إرجاع البياضات النظيفة إلى مستودعات الفندق</h2>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="relative w-full md:w-60">
                    <input
                      type="text"
                      placeholder="ابحث برقم المرتجع أو التحويل أو المسؤول..."
                      value={returnsSearch}
                      onChange={(e) => setReturnsSearch(e.target.value)}
                      className="w-full pr-8 pl-3.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                    <span className="absolute right-2.5 top-2.5 text-slate-400">
                      <Search size={14} />
                    </span>
                  </div>
                  {canManage && (
                    <Button variant="primary" size="sm" onClick={() => setIsCreateReturnOpen(true)} className="flex-shrink-0">
                      <Plus size={15} />
                      تسجيل دفعة مرتجعات جديدة
                    </Button>
                  )}
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs bg-white shadow-2xs">
                <table className="w-full text-right border-collapse">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-5 py-3 font-bold text-slate-500">رقم المرتجع</th>
                      <th className="px-5 py-3 font-bold text-slate-500">تابع لتحويل</th>
                      <th className="px-5 py-3 font-bold text-slate-500">المسؤول</th>
                      <th className="px-5 py-3 text-center font-bold text-slate-500">تاريخ الإرجاع</th>
                      <th className="px-5 py-3 text-center font-bold text-slate-500">الحالة</th>
                      <th className="px-5 py-3 text-center font-bold text-slate-500">إجراءات التحقق</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {returns.filter(r => 
                      String(r.id).includes(returnsSearch) ||
                      String(r.transferId).includes(returnsSearch) ||
                      r.creatorUsername.toLowerCase().includes(returnsSearch.toLowerCase())
                    ).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">لا توجد مستندات مرتجعات مطابقة للبحث.</td>
                      </tr>
                    ) : (
                      returns.filter(r => 
                        String(r.id).includes(returnsSearch) ||
                        String(r.transferId).includes(returnsSearch) ||
                        r.creatorUsername.toLowerCase().includes(returnsSearch.toLowerCase())
                      ).map(r => (
                        <tr key={r.id} className="hover:bg-slate-50/50">
                          <td className="px-5 py-3.5 font-mono font-bold text-slate-500">#{r.id}</td>
                          <td className="px-5 py-3.5 font-bold text-slate-650">تحويل #{r.transferId}</td>
                          <td className="px-5 py-3.5 text-slate-700 font-medium">{r.creatorUsername}</td>
                          <td className="px-5 py-3.5 text-center text-slate-450">{new Date(r.createdAt).toLocaleDateString('ar-EG')}</td>
                          <td className="px-5 py-3.5 text-center">
                            <Badge variant={
                              r.status === 'completed' ? 'success' :
                              r.status === 'draft' ? 'warning' :
                              r.status === 'partial_received' ? 'info' : 'danger'
                            }>
                              {
                                r.status === 'completed' ? 'مكتمل ومعتمد' :
                                r.status === 'draft' ? 'مسودة بانتظار التحقق' :
                                r.status === 'partial_received' ? 'استلام جزئي' : r.status
                              }
                            </Badge>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            {r.status === 'draft' && (
                              canReceive ? (
                                <button
                                  onClick={() => handleOpenVerifyReturnModal(r)}
                                  className="px-2.5 py-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 border border-blue-200 rounded bg-blue-50/45 cursor-pointer"
                                >
                                  مطابقة واعتماد في الفندق
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-bold">بانتظار التحقق</span>
                              )
                            )}
                            {r.status === 'completed' && (
                              <span className="text-[10px] text-emerald-600 font-bold flex items-center justify-center gap-1">
                                <CheckCircle size={12} />
                                تم الإغلاق والاعتماد
                              </span>
                            )}
                            {r.status === 'partial_received' && (
                              <span className="text-[10px] text-amber-600 font-bold flex items-center justify-center gap-1">
                                <AlertTriangle size={12} />
                                مغلق مع وجود فروقات
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: SCRAP & LOSS LEDGER */}
          {activeTab === 'losses' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Form to record new loss (1 Col) */}
              <div className="flex flex-col gap-4">
                <h2 className="text-base font-bold text-slate-800">تسجيل هالك وتالف جديد</h2>
                <Card className="border-slate-200/60 shadow-2xs bg-white">
                  <Card.Body className="p-4">
                    <form onSubmit={handleCreateLossSubmit} className="flex flex-col gap-4">
                      
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700">اختر الصنف التالف</label>
                        <select
                          value={lossForm.itemCode}
                          onChange={(e) => setLossForm({ ...lossForm, itemCode: e.target.value })}
                          className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        >
                          {STANDARD_LINENS.map(l => (
                            <option key={l.itemCode} value={l.itemCode}>{l.itemNameAr}</option>
                          ))}
                        </select>
                      </div>

                      <Input
                        label="الكمية التالفة (حبة)"
                        type="number"
                        min={1}
                        value={lossForm.quantity}
                        onChange={(e) => setLossForm({ ...lossForm, quantity: Math.max(1, Number(e.target.value)) })}
                        required
                      />

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700">سبب الاستبعاد والهلاك</label>
                        <select
                          value={lossForm.reason}
                          onChange={(e) => setLossForm({ ...lossForm, reason: e.target.value as any })}
                          className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                        >
                          <option value="Torn">تمزق نسيج (Torn)</option>
                          <option value="Burned">احتراق بالكي (Burned)</option>
                          <option value="Shrinkage">انكماش حراري (Shrinkage)</option>
                          <option value="Missing">مفقود/غير معروف (Missing)</option>
                          <option value="Stained">بقع مستعصية (Stained)</option>
                          <option value="Disposed">إتلاف متعمد (Disposed)</option>
                        </select>
                      </div>

                      <Input
                        label="تقدير التكلفة المالية للتعويض (ج.م)"
                        type="number"
                        min={0}
                        value={lossForm.cost}
                        onChange={(e) => setLossForm({ ...lossForm, cost: Math.max(0, Number(e.target.value)) })}
                        required
                      />

                      <Button type="submit" variant="primary" isLoading={submitting} className="w-full justify-center mt-2">
                        تسجيل الهالك بالمخزون
                      </Button>
                    </form>
                  </Card.Body>
                </Card>
              </div>

              {/* Losses History (2 Cols) */}
              <div className="lg:col-span-2 flex flex-col gap-4">
                <div className="flex justify-between items-center gap-3">
                  <h2 className="text-base font-bold text-slate-800">أرشيف استبعادات وهالك البياضات</h2>
                  <div className="relative w-48">
                    <input
                      type="text"
                      placeholder="ابحث بالاسم أو كود الصنف..."
                      value={lossesSearch}
                      onChange={(e) => setLossesSearch(e.target.value)}
                      className="w-full pr-8 pl-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                    <span className="absolute right-2 top-1.5 text-slate-400">
                      <Search size={12} />
                    </span>
                  </div>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs bg-white shadow-2xs">
                  <table className="w-full text-right border-collapse">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-2.5 font-bold text-slate-500">اسم الصنف</th>
                        <th className="px-4 py-2.5 text-center font-bold text-slate-500">الكمية التالفة</th>
                        <th className="px-4 py-2.5 text-center font-bold text-slate-500">السبب</th>
                        <th className="px-4 py-2.5 text-center font-bold text-slate-500">قيمة الخسارة</th>
                        <th className="px-4 py-2.5 text-center font-bold text-slate-500">المعتمِد</th>
                        <th className="px-4 py-2.5 text-center font-bold text-slate-500">تاريخ التسجيل</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {losses.filter(l => 
                        l.itemNameAr.toLowerCase().includes(lossesSearch.toLowerCase()) ||
                        l.itemCode.toLowerCase().includes(lossesSearch.toLowerCase())
                      ).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400">لا توجد عمليات إتلاف مسجلة مطابقة للبحث.</td>
                        </tr>
                      ) : (
                        losses.filter(l => 
                          l.itemNameAr.toLowerCase().includes(lossesSearch.toLowerCase()) ||
                          l.itemCode.toLowerCase().includes(lossesSearch.toLowerCase())
                        ).map(l => (
                          <tr key={l.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-bold text-slate-700">{l.itemNameAr}</td>
                            <td className="px-4 py-3 text-center text-rose-600 font-extrabold">{l.quantity} حبة</td>
                            <td className="px-4 py-3 text-center">
                              <Badge variant="danger">
                                {
                                  l.reason === 'Torn' ? 'تمزق أقمشة' :
                                  l.reason === 'Burned' ? 'حرق بالكي' :
                                  l.reason === 'Shrinkage' ? 'انكماش' :
                                  l.reason === 'Missing' ? 'مفقود' :
                                  l.reason === 'Stained' ? 'بقع مستعصية' : 'إتلاف'
                                }
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-center text-slate-750 font-bold">{l.cost} ج.م</td>
                            <td className="px-4 py-3 text-center text-slate-500">{l.approverUsername}</td>
                            <td className="px-4 py-3 text-center text-slate-400">{new Date(l.createdAt).toLocaleDateString('ar-EG')}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}
        </>
      )}

      {/* --- MODALS --- */}

      {/* 1. CREATE TRANSFER MODAL */}
      <Modal isOpen={isCreateTransferOpen} onClose={() => setIsCreateTransferOpen(false)} title="إنشاء شحنة تحويل بياضات متسخة" size="md">
        <form onSubmit={handleCreateTransferSubmit} className="flex flex-col gap-4 font-arabic text-right dir-rtl">
          
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">اختر المستودع المرسل (القسم/الجناح)</label>
            <div className="relative mb-1">
              <input
                type="text"
                placeholder="ابحث لفلترة المستودعات والأقسام..."
                value={warehouseSearch}
                onChange={(e) => setWarehouseSearch(e.target.value)}
                className="w-full pr-8 pl-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <Search size={14} />
              </span>
              {warehouseSearch && (
                <button
                  type="button"
                  onClick={() => setWarehouseSearch('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 focus:outline-none cursor-pointer flex items-center justify-center"
                  title="مسح البحث"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <select
              value={transferForm.fromWarehouseId}
              onChange={(e) => setTransferForm({ ...transferForm, fromWarehouseId: e.target.value })}
              className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500 font-bold"
              required
            >
              <option value="">-- اختر القسم المرسل --</option>
              {warehouses
                .filter(w => w.name.toLowerCase().includes(warehouseSearch.toLowerCase()))
                .map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
            </select>
          </div>

          <Input
            label="ملاحظات وتوجيهات الشحن"
            placeholder="مثال: بياضات الطابق الثالث متسخة جداً"
            value={transferForm.notes}
            onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
          />

          {/* Items Picker Section */}
          <div className="border-t border-slate-100 pt-3 flex flex-col gap-3">
            <span className="text-xs font-bold text-slate-750">إضافة البنود للشحنة:</span>
            
            <div className="flex gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 items-end">
              <div className="flex-1 flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-500">اختر الصنف</span>
                <div className="relative mb-1">
                  <input
                    type="text"
                    placeholder="ابحث لفلترة البنود..."
                    value={transferItemSearch}
                    onChange={(e) => setTransferItemSearch(e.target.value)}
                    className="w-full pr-7 pl-7 py-1 bg-white border border-slate-200 rounded text-[10px] focus:outline-none focus:border-blue-500"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Search size={11} />
                  </span>
                  {transferItemSearch && (
                    <button
                      type="button"
                      onClick={() => setTransferItemSearch('')}
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 focus:outline-none cursor-pointer flex items-center justify-center"
                      title="مسح البحث"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
                <select
                  value={transferItemInput.itemCode}
                  onChange={(e) => setTransferItemInput({ ...transferItemInput, itemCode: e.target.value })}
                  className="px-2 py-1.5 bg-white border border-slate-200 rounded text-xs"
                >
                  {STANDARD_LINENS
                    .filter(l =>
                      l.itemNameAr.toLowerCase().includes(transferItemSearch.toLowerCase()) ||
                      l.itemCode.toLowerCase().includes(transferItemSearch.toLowerCase())
                    )
                    .map(l => (
                      <option key={l.itemCode} value={l.itemCode}>{l.itemNameAr}</option>
                    ))}
                </select>
              </div>

              <div className="w-24 flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-500">الكمية</span>
                <input
                  type="number"
                  min={1}
                  value={transferItemInput.sentQty}
                  onChange={(e) => setTransferItemInput({ ...transferItemInput, sentQty: Math.max(1, Number(e.target.value)) })}
                  className="px-2 py-1.5 bg-white border border-slate-200 rounded text-xs text-center"
                />
              </div>

              <Button type="button" variant="outline" size="sm" onClick={handleAddTransferItem}>
                إضافة
              </Button>
            </div>

            {/* Added list */}
            <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 text-xs bg-white max-h-36 overflow-y-auto">
              {transferForm.items.length === 0 ? (
                <div className="p-3 text-center text-slate-400">لم يتم إدخال أصناف بعد.</div>
              ) : (
                transferForm.items.map(item => (
                  <div key={item.itemCode} className="flex justify-between items-center p-2">
                    <span className="font-bold text-slate-700">{item.itemNameAr}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-blue-600">{item.sentQty} حبة</span>
                      <button 
                        type="button" 
                        onClick={() => handleRemoveTransferItem(item.itemCode)}
                        className="text-rose-500 hover:text-rose-700"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsCreateTransferOpen(false)}>إلغاء</Button>
            <Button type="submit" variant="primary" isLoading={submitting}>حفظ كمسودة تحويل</Button>
          </div>
        </form>
      </Modal>

      {/* 2. RECEIVE TRANSFER MODAL */}
      <Modal isOpen={!!selectedReceiveTransfer} onClose={() => setSelectedReceiveTransfer(null)} title="تأكيد واستلام شحنة بياضات بالمغسلة" size="lg">
        {selectedReceiveTransfer && (
          <form onSubmit={handleReceiveTransferSubmit} className="flex flex-col gap-4 font-arabic text-right dir-rtl">
            <div className="bg-slate-50 border p-3 rounded-lg text-xs text-slate-650 flex flex-col gap-1">
              <span><strong>رقم الشحنة:</strong> #{selectedReceiveTransfer.id}</span>
              <span><strong>الجهة المرسلة:</strong> {selectedReceiveTransfer.fromWarehouseName}</span>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden text-xs bg-white max-h-56 overflow-y-auto">
              <table className="w-full text-right border-collapse">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 font-bold text-slate-500">الصنف</th>
                    <th className="px-3 py-2 text-center font-bold text-slate-500">الكمية المرسلة</th>
                    <th className="px-3 py-2 text-center font-bold text-slate-500">الكمية المستلمة</th>
                    <th className="px-3 py-2 text-center font-bold text-slate-500">سبب الاختلاف</th>
                    <th className="px-3 py-2 text-center font-bold text-slate-500">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {receiveForm.items.map((item, idx) => {
                    const original = (selectedReceiveTransfer.items || []).find(i => i.itemCode === item.itemCode);
                    const sentQty = original ? original.sentQty : 0;
                    const hasDiff = Number(item.actualQty) < sentQty;

                    return (
                      <tr key={item.itemCode} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2 font-bold text-slate-700">
                          {original ? original.itemNameAr : item.itemCode}
                        </td>
                        <td className="px-3 py-2 text-center font-semibold text-slate-500">{sentQty}</td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min={0}
                            max={sentQty}
                            value={item.actualQty}
                            onChange={(e) => {
                              const newQty = Math.min(sentQty, Math.max(0, Number(e.target.value)));
                              setReceiveForm(prev => ({
                                ...prev,
                                items: prev.items.map((itm, iIdx) => iIdx === idx ? { ...itm, actualQty: newQty } : itm)
                              }));
                            }}
                            className="w-16 px-1.5 py-1 border rounded text-center font-bold bg-white text-slate-800"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <select
                            disabled={!hasDiff}
                            value={item.rejectReason}
                            onChange={(e) => {
                              setReceiveForm(prev => ({
                                ...prev,
                                items: prev.items.map((itm, iIdx) => iIdx === idx ? { ...itm, rejectReason: e.target.value } : itm)
                              }));
                            }}
                            className="px-1 py-1 border rounded text-xs bg-slate-50 disabled:bg-slate-100 text-slate-800 font-bold"
                          >
                            <option value="">-- لا يوجد --</option>
                            <option value="Damaged">تالف (Damaged)</option>
                            <option value="Wrong Quantity">خطأ بالعد (Wrong Quantity)</option>
                            <option value="Wet">مبتل ورطب (Wet)</option>
                            <option value="Wrong Item">صنف خطأ (Wrong Item)</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="text"
                            disabled={!hasDiff}
                            placeholder="ملاحظات العجز"
                            value={item.rejectNotes}
                            onChange={(e) => {
                              setReceiveForm(prev => ({
                                ...prev,
                                items: prev.items.map((itm, iIdx) => iIdx === idx ? { ...itm, rejectNotes: e.target.value } : itm)
                              }));
                            }}
                            className="px-1.5 py-1 border rounded text-[10px] w-24 bg-white"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Input
              label="ملاحظات عامة حول الاستلام"
              placeholder="مثال: استلام متأخر مع عجز طفيف"
              value={receiveForm.notes}
              onChange={(e) => setReceiveForm({ ...receiveForm, notes: e.target.value })}
            />

            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setSelectedReceiveTransfer(null)}>إلغاء</Button>
              <Button type="submit" variant="primary" isLoading={submitting}>اعتماد الاستلام ودخول خط الغسيل</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* 3. CREATE RETURN MODAL */}
      <Modal isOpen={isCreateReturnOpen} onClose={() => setIsCreateReturnOpen(false)} title="إرجاع بياضات نظيفة إلى الفندق" size="lg">
        <form onSubmit={handleCreateReturnSubmit} className="flex flex-col gap-4 font-arabic text-right dir-rtl">
          
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">اختر شحنة التحويل النشطة</label>
            <div className="relative mb-1">
              <input
                type="text"
                placeholder="ابحث لفلترة شحنات التحويل المعلقة..."
                value={transferSearch}
                onChange={(e) => setTransferSearch(e.target.value)}
                className="w-full pr-8 pl-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <Search size={14} />
              </span>
              {transferSearch && (
                <button
                  type="button"
                  onClick={() => setTransferSearch('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 focus:outline-none cursor-pointer flex items-center justify-center"
                  title="مسح البحث"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <select
              value={returnForm.transferId}
              onChange={(e) => handleTransferChangeInReturn(e.target.value)}
              className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500 font-bold"
              required
            >
              <option value="">-- اختر الشحنة المعلقة بالمغسلة --</option>
              {transfers
                .filter(t => t.status === 'received' && (t.items || []).some(i => i.remainingQty > 0))
                .filter(t => 
                  String(t.id).includes(transferSearch) ||
                  t.fromWarehouseName.toLowerCase().includes(transferSearch.toLowerCase())
                )
                .map(t => (
                  <option key={t.id} value={t.id}>
                    شحنة #{t.id} - من {t.fromWarehouseName} ({new Date(t.createdAt).toLocaleDateString('ar-EG')})
                  </option>
                ))}
            </select>
          </div>

          <Input
            label="ملاحظات المرتجع النظيف"
            placeholder="مثال: تسليم الوجبة الأولى من الشراشف النظيفة"
            value={returnForm.notes}
            onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
          />

          {returnForm.items.length > 0 && (
            <div className="border-t border-slate-100 pt-3 flex flex-col gap-2">
              <span className="text-xs font-bold text-slate-750">تحديد كميات البياضات النظيفة المغسولة:</span>
              <div className="border border-slate-200 rounded-lg overflow-hidden text-xs bg-white">
                <table className="w-full text-right border-collapse">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2.5 font-bold text-slate-500">الصنف</th>
                      <th className="px-3 py-2.5 text-center font-bold text-slate-500">الرصيد المعلق في المغسلة</th>
                      <th className="px-3 py-2.5 text-center font-bold text-slate-500">الكمية النظيفة المرجعة الآن</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {returnForm.items.map((item, idx) => (
                      <tr key={item.itemCode}>
                        <td className="px-3 py-2.5 font-bold text-slate-700">{item.itemNameAr}</td>
                        <td className="px-3 py-2.5 text-center font-bold text-amber-600">{item.maxRemaining} حبة</td>
                        <td className="px-3 py-2.5 text-center">
                          <input
                            type="number"
                            min={0}
                            max={item.maxRemaining}
                            value={item.expectedQty}
                            onChange={(e) => {
                              const newQty = Math.min(item.maxRemaining, Math.max(0, Number(e.target.value)));
                              setReturnForm(prev => ({
                                ...prev,
                                items: prev.items.map((itm, iIdx) => iIdx === idx ? { ...itm, expectedQty: newQty } : itm)
                              }));
                            }}
                            className="w-20 px-1.5 py-1 border rounded text-center font-bold bg-white text-slate-800 focus:outline-none"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsCreateReturnOpen(false)}>إلغاء</Button>
            <Button type="submit" variant="primary" isLoading={submitting}>إنشاء مستند المرتجع النظيف</Button>
          </div>
        </form>
      </Modal>

      {/* 4. VERIFY RETURN MODAL */}
      <Modal isOpen={!!selectedVerifyReturn} onClose={() => setSelectedVerifyReturn(null)} title="مطابقة واعتماد مرتجعات البياضات النظيفة في الفندق" size="lg">
        {selectedVerifyReturn && (
          <form onSubmit={handleVerifyReturnSubmit} className="flex flex-col gap-4 font-arabic text-right dir-rtl">
            <div className="bg-slate-50 border p-3 rounded-lg text-xs text-slate-650 flex flex-col gap-1">
              <span><strong>رقم المرتجع:</strong> #{selectedVerifyReturn.id}</span>
              <span><strong>تابع للتحويل الأصلي:</strong> #{selectedVerifyReturn.transferId}</span>
              <span><strong>مرسل بواسطة:</strong> {selectedVerifyReturn.creatorUsername}</span>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden text-xs bg-white max-h-56 overflow-y-auto">
              <table className="w-full text-right border-collapse">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 font-bold text-slate-500">الصنف</th>
                    <th className="px-3 py-2 text-center font-bold text-slate-500">المصرح به بالمغسلة</th>
                    <th className="px-3 py-2 text-center font-bold text-slate-500">المستلم الفعلي بالفندق</th>
                    <th className="px-3 py-2 text-center font-bold text-slate-500">سبب الاستبعاد/العجز</th>
                    <th className="px-3 py-2 text-center font-bold text-slate-500">تفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {verifyForm.items.map((item, idx) => {
                    const original = (selectedVerifyReturn.items || []).find(i => i.itemCode === item.itemCode);
                    const expectedQty = original ? original.expectedQty : 0;
                    const hasDiff = Number(item.actualQty) < expectedQty;

                    return (
                      <tr key={item.itemCode} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2 font-bold text-slate-700">
                          {original ? original.itemNameAr : item.itemCode}
                        </td>
                        <td className="px-3 py-2 text-center font-semibold text-slate-500">{expectedQty}</td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min={0}
                            max={expectedQty}
                            value={item.actualQty}
                            onChange={(e) => {
                              const newQty = Math.min(expectedQty, Math.max(0, Number(e.target.value)));
                              setVerifyForm(prev => ({
                                ...prev,
                                items: prev.items.map((itm, iIdx) => iIdx === idx ? { ...itm, actualQty: newQty } : itm)
                              }));
                            }}
                            className="w-16 px-1.5 py-1 border rounded text-center font-bold bg-white text-slate-800"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <select
                            disabled={!hasDiff}
                            value={item.rejectReason}
                            onChange={(e) => {
                              setVerifyForm(prev => ({
                                ...prev,
                                items: prev.items.map((itm, iIdx) => iIdx === idx ? { ...itm, rejectReason: e.target.value } : itm)
                              }));
                            }}
                            className="px-1 py-1 border rounded text-xs bg-slate-50 disabled:bg-slate-100 text-slate-800 font-bold"
                          >
                            <option value="">-- لا يوجد --</option>
                            <option value="Damaged">تالف ممزق (Damaged)</option>
                            <option value="Wet">رطب بحاجة للتجفيف (Wet)</option>
                            <option value="Count Mismatch">عجز بالعد (Count Mismatch)</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="text"
                            disabled={!hasDiff}
                            placeholder="تفاصيل العجز"
                            value={item.rejectNotes}
                            onChange={(e) => {
                              setVerifyForm(prev => ({
                                ...prev,
                                items: prev.items.map((itm, iIdx) => iIdx === idx ? { ...itm, rejectNotes: e.target.value } : itm)
                              }));
                            }}
                            className="px-1.5 py-1 border rounded text-[10px] w-24 bg-white"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">حالة تسوية الاستلام</label>
                <select
                  value={verifyForm.status}
                  onChange={(e) => setVerifyForm({ ...verifyForm, status: e.target.value as any })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none"
                  required
                >
                  <option value="completed">اعتماد مطابق بالكامل (Completed)</option>
                  <option value="partial_received">استلام جزئي مع هالك وفروقات (Partial)</option>
                  <option value="disputed">خلاف بالكميات بانتظار الإدارة (Disputed)</option>
                  <option value="rejected">مرفوض بالكامل (Rejected)</option>
                </select>
              </div>

              <Input
                label="ملاحظات الاعتماد والتحقق"
                placeholder="مثال: تم قبول 97 حبة واعتماد 3 حبات كتالف مفقود"
                value={verifyForm.notes}
                onChange={(e) => setVerifyForm({ ...verifyForm, notes: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setSelectedVerifyReturn(null)}>إلغاء</Button>
              <Button type="submit" variant="primary" isLoading={submitting}>مطابقة واعتماد عهدة الفندق</Button>
            </div>
          </form>
        )}
      </Modal>

    </div>
  );
}
