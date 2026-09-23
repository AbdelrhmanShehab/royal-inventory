import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Play, 
  Pause, 
  CheckCircle, 
  XCircle, 
  Plus, 
  Search, 
  ChevronRight,
  Clock,
  Layers,
  Thermometer,
  Sliders,
  WashingMachine,
  Activity,
  Layers2,
  AlertCircle
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Drawer from '../../components/ui/Drawer';
import Loader from '../../components/ui/Loader';
import { laundryApi } from '../../api/laundry.api';
import type { 
  LaundryBatch, 
  LaundryMachine, 
  LaundryProgram, 
  LaundryRecipe
} from '../../types/laundry';

// Preset standard linen items for quick input
const STANDARD_LINENS = [
  { itemCode: 'LIN-001', itemNameAr: 'شراشف سرير كينج' },
  { itemCode: 'LIN-002', itemNameAr: 'شراشف سرير فردي' },
  { itemCode: 'LIN-003', itemNameAr: 'أغطية وسائد بيضاء' },
  { itemCode: 'LIN-004', itemNameAr: 'مناشف استحمام كبيرة' },
  { itemCode: 'LIN-005', itemNameAr: 'مناشف يد متوسطة' },
  { itemCode: 'LIN-006', itemNameAr: 'أرواب حمام قطنية' },
  { itemCode: 'LIN-007', itemNameAr: 'مفارش طاولة طعام' },
  { itemCode: 'LIN-008', itemNameAr: 'مناديل سفرة مطعم' },
  { itemCode: 'LIN-009', itemNameAr: 'زي موظفين استقبال' },
  { itemCode: 'LIN-010', itemNameAr: 'زي موظفين مطبخ' }
];

export default function ActiveBatches() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Search parameters for drawer/wizard
  const selectedBatchId = searchParams.get('batchId');
  const selectedMachineIdForWizard = searchParams.get('machineId');
  const isCreateRequested = searchParams.get('create') === 'true';

  // Component states
  const [batches, setBatches] = useState<LaundryBatch[]>([]);
  const [machines, setMachines] = useState<LaundryMachine[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Selected batch details
  const [detailedBatch, setDetailedBatch] = useState<LaundryBatch | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Wizard state
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardData, setWizardData] = useState<{
    machineId: number;
    programId: number;
    recipeId: number;
    weight: number;
    pieces: number;
    guestWeight: number;
    staffWeight: number;
    specialWeight: number;
    spotWeight: number;
    runType: 'PROGRAM' | 'MANUAL' | 'HYBRID';
    items: { itemCode: string; itemNameAr: string; quantity: number; role: 'INPUT' | 'OUTPUT' | 'SCRAP' }[];
    consumptions: { chemicalItemCode: string; chemicalName: string; expectedQty: number; actualQty: number; mode: 'AUTO' | 'MANUAL' }[];
  }>({
    machineId: 0,
    programId: 0,
    recipeId: 0,
    weight: 0,
    pieces: 0,
    guestWeight: 0,
    staffWeight: 0,
    specialWeight: 0,
    spotWeight: 0,
    runType: 'PROGRAM',
    items: [],
    consumptions: []
  });

  const [wizardPrograms, setWizardPrograms] = useState<LaundryProgram[]>([]);
  const [wizardRecipe, setWizardRecipe] = useState<LaundryRecipe | null>(null);

  // Fetch batches & lookups
  const loadData = async () => {
    try {
      setLoading(true);
      const [bList, mList] = await Promise.all([
        laundryApi.getBatches(),
        laundryApi.getMachines()
      ]);
      setBatches(bList || []);
      setMachines(mList || []);
    } catch (err) {
      console.error('Error loading batches and metadata:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Sync wizard to query param machineId if requested
  useEffect(() => {
    if (selectedMachineIdForWizard) {
      const mId = Number(selectedMachineIdForWizard);
      setWizardData(prev => ({ ...prev, machineId: mId }));
      setWizardStep(2); // Jump directly to program selection step
      // Load programs for selected machine
      laundryApi.getPrograms(mId).then(progs => {
        setWizardPrograms(progs || []);
      });
    }
  }, [selectedMachineIdForWizard]);

  // Load selected batch details drawer
  useEffect(() => {
    if (selectedBatchId) {
      setDetailsLoading(true);
      laundryApi.getBatch(Number(selectedBatchId))
        .then(data => {
          setDetailedBatch(data || null);
        })
        .catch(err => {
          console.error('Error getting batch details:', err);
        })
        .finally(() => {
          setDetailsLoading(false);
        });
    } else {
      setDetailedBatch(null);
    }
  }, [selectedBatchId]);

  // Wizard Handlers
  const handleSelectMachine = (mId: number) => {
    setWizardData(prev => ({ ...prev, machineId: mId, programId: 0, recipeId: 0 }));
    setWizardStep(2);
    laundryApi.getPrograms(mId).then(progs => {
      setWizardPrograms(progs || []);
    });
  };

  const handleSelectProgram = (prog: LaundryProgram) => {
    const rId = prog.recipeId || 0;
    setWizardData(prev => ({ 
      ...prev, 
      programId: prog.id, 
      recipeId: rId,
      weight: prog.recommendedCapacity || 0
    }));
    
    if (rId) {
      laundryApi.getRecipe(rId).then(rec => {
        setWizardRecipe(rec || null);
        // Pre-fill consumptions based on recipe
        if (rec && rec.items) {
          const preCons = rec.items.map(item => ({
            chemicalItemCode: item.chemicalItemCode,
            chemicalName: item.chemicalName,
            expectedQty: item.expectedQty,
            actualQty: item.expectedQty, // default to match
            mode: 'AUTO' as const
          }));
          setWizardData(prev => ({ ...prev, consumptions: preCons }));
        }
      });
    } else {
      setWizardRecipe(null);
      setWizardData(prev => ({ ...prev, consumptions: [] }));
    }
    setWizardStep(3);
  };

  const handleRecipeNext = () => {
    setWizardStep(4);
  };

  const handleWeightsNext = () => {
    if (wizardData.items.length === 0) {
      alert('يجب إضافة صنف بياضات واحد على الأقل للغسيل!');
      return;
    }
    setWizardStep(5);
  };

  const handleStartBatch = async () => {
    try {
      if (wizardData.items.length === 0) {
        alert('يجب إضافة صنف بياضات واحد على الأقل للغسيل!');
        return;
      }
      setSubmitting(true);
      // Map linen items to batch items (using guest weight, staff, special, etc.)
      // Also build input pieces list
      const batchItems = wizardData.items.map(item => ({
        itemCode: item.itemCode,
        quantity: item.quantity,
        role: item.role
      }));

      // Generate a batch number
      const batchNum = `B-${Date.now().toString().slice(-6)}`;

      const postBody = {
        batchNumber: batchNum,
        runType: wizardData.runType,
        machineId: wizardData.machineId || null,
        programId: wizardData.programId || null,
        recipeId: wizardData.recipeId || null,
        weight: wizardData.weight,
        pieces: wizardData.pieces || wizardData.items.reduce((sum, item) => sum + item.quantity, 0),
        guestWeight: wizardData.guestWeight,
        staffWeight: wizardData.staffWeight,
        specialWeight: wizardData.specialWeight,
        spotWeight: wizardData.spotWeight,
        items: batchItems,
        consumptions: wizardData.consumptions.map(c => ({
          chemicalItemCode: c.chemicalItemCode,
          chemicalName: c.chemicalName,
          actualQty: c.actualQty,
          mode: c.mode
        }))
      };

      await laundryApi.createBatch(postBody);
      // Clean query params and reload
      navigate('/laundry/batches');
      loadData();
      // Reset Wizard state
      setWizardStep(1);
      setWizardData({
        machineId: 0,
        programId: 0,
        recipeId: 0,
        weight: 0,
        pieces: 0,
        guestWeight: 0,
        staffWeight: 0,
        specialWeight: 0,
        spotWeight: 0,
        runType: 'PROGRAM',
        items: [],
        consumptions: []
      });
    } catch (err) {
      console.error('Error starting batch:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Status Action Handlers
  const handleUpdateStatus = async (bId: number, status: LaundryBatch['status']) => {
    try {
      setSubmitting(true);
      await laundryApi.updateBatchStatus(bId, status);
      loadData();
      if (detailedBatch && detailedBatch.id === bId) {
        // Refresh details
        const updated = await laundryApi.getBatch(bId);
        setDetailedBatch(updated);
      }
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Add Item to Wizard list
  const handleAddWizardLinen = (code: string, qty: number) => {
    if (qty <= 0) return;
    const item = STANDARD_LINENS.find(i => i.itemCode === code);
    if (!item) return;

    setWizardData(prev => {
      // Check if already in list
      const existing = prev.items.find(i => i.itemCode === code);
      if (existing) {
        return {
          ...prev,
          items: prev.items.map(i => i.itemCode === code ? { ...i, quantity: qty } : i)
        };
      }
      return {
        ...prev,
        items: [...prev.items, { itemCode: code, itemNameAr: item.itemNameAr, quantity: qty, role: 'INPUT' }]
      };
    });
  };

  const handleRemoveWizardLinen = (code: string) => {
    setWizardData(prev => ({
      ...prev,
      items: prev.items.filter(i => i.itemCode !== code)
    }));
  };

  // Filters
  const filteredBatches = batches.filter(b => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      b.batchNumber.toLowerCase().includes(q) ||
      (b.machineName || '').toLowerCase().includes(q) ||
      (b.programName || '').toLowerCase().includes(q);

    const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex flex-col gap-6 font-arabic dir-rtl select-none">
      
      {/* Header operations bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-extrabold text-slate-800 flex items-center gap-2">
            <Activity size={24} className="text-blue-600" />
            إدارة دورات تشغيل المغسلة
          </h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-1">
            تسجيل وإدارة عمليات المعالجة الكيميائية للمنسوجات، استلام بياضات الفندق، وإجراء مطابقة الأرصدة التلقائية.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => navigate('/laundry/batches?create=true')} className="gap-1">
          <Plus size={16} />
          بدء دورة جديدة (Wizard)
        </Button>
      </div>

      {/* Grid of active / running batches list */}
      <div className="flex flex-col gap-4">
        {/* Search and status filters */}
        <div className="flex flex-col md:flex-row gap-3 bg-white p-3 border border-slate-200/80 rounded-xl justify-between">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="البحث عن رقم الدورة، اسم الغسالة، أو البرنامج..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-10 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs md:text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all placeholder-slate-400"
            />
          </div>
          <div className="flex gap-2">
            {[
              { key: 'ALL', label: 'الكل' },
              { key: 'Running', label: 'تعمل حالياً' },
              { key: 'Paused', label: 'متوقفة مؤقتاً' },
              { key: 'Completed', label: 'مكتملة' },
              { key: 'Cancelled', label: 'ملغاة' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === tab.key 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Batches Table */}
        <Card className="border-slate-200/60 shadow-2xs overflow-hidden">
          <Card.Body className="p-0">
            {loading ? (
              <div className="py-20 flex justify-center items-center">
                <Loader size="md" label="جاري تحميل سجل دورات التشغيل..." />
              </div>
            ) : filteredBatches.length === 0 ? (
              <div className="py-12 text-center text-slate-450 text-sm">
                لا توجد دورات تشغيل مطابقة لمعايير البحث الحالية.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500">رقم الدورة</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500">الغسالة</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500">البرنامج</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500">الوزن</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500">قطع الملابس</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500">الحالة</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500">تاريخ البدء</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredBatches.map(b => (
                      <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3">
                          <span className="text-xs font-bold text-slate-800">#{b.batchNumber}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-xs font-semibold text-slate-700">{b.machineName || 'يدوي'}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-xs font-medium text-slate-600">{b.programName || 'برنامج مباشر'}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-xs font-bold text-slate-800">{b.weight} كجم</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-xs font-semibold text-slate-600">{b.pieces} قطعة</span>
                        </td>
                        <td className="px-5 py-3">
                          <Badge variant={
                            b.status === 'Completed' ? 'success' :
                            b.status === 'Running' ? 'info' :
                            b.status === 'Paused' ? 'warning' : 'danger'
                          }>
                            {b.status === 'Completed' ? 'مكتملة' :
                             b.status === 'Running' ? 'جاري التشغيل' :
                             b.status === 'Paused' ? 'متوقفة مؤقتاً' : 'ملغاة'}
                          </Badge>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-[10px] text-slate-400 font-medium">
                            {new Date(b.createdAt).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                          </span>
                        </td>
                        <td className="px-5 py-3 flex gap-1.5 items-center">
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={() => navigate(`/laundry/batches?batchId=${b.id}`)}
                            className="px-2.5 py-1 text-[11px]"
                          >
                            مراقبة وتفاصيل
                          </Button>
                          {b.status === 'Running' && (
                            <button 
                              onClick={() => handleUpdateStatus(b.id, 'Paused')}
                              className="w-7 h-7 rounded bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center hover:bg-amber-100 transition-colors cursor-pointer"
                              title="إيقاف مؤقت"
                            >
                              <Pause size={12} />
                            </button>
                          )}
                          {b.status === 'Paused' && (
                            <button 
                              onClick={() => handleUpdateStatus(b.id, 'Running')}
                              className="w-7 h-7 rounded bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors cursor-pointer"
                              title="استئناف"
                            >
                              <Play size={12} />
                            </button>
                          )}
                          {(b.status === 'Running' || b.status === 'Paused') && (
                            <button 
                              onClick={() => handleUpdateStatus(b.id, 'Completed')}
                              className="w-7 h-7 rounded bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 transition-colors cursor-pointer"
                              title="إكمال الدورة"
                            >
                              <CheckCircle size={12} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card.Body>
        </Card>
      </div>

      {/* DETAILED DRAWER */}
      <Drawer isOpen={!!selectedBatchId && !isCreateRequested} onClose={() => navigate('/laundry/batches')} title={`تفاصيل الدورة #${detailedBatch?.batchNumber || ''}`}>
        {detailsLoading ? (
          <div className="py-20 flex justify-center items-center">
            <Loader size="md" label="جاري تحميل التفاصيل الحية..." />
          </div>
        ) : detailedBatch ? (
          <div className="flex flex-col gap-6 font-arabic text-right">
            
            {/* Overview Widget */}
            <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500">حالة الدورة الحالية</span>
                <Badge variant={
                  detailedBatch.status === 'Completed' ? 'success' :
                  detailedBatch.status === 'Running' ? 'info' :
                  detailedBatch.status === 'Paused' ? 'warning' : 'danger'
                }>
                  {detailedBatch.status === 'Completed' ? 'مكتملة بنجاح' :
                   detailedBatch.status === 'Running' ? 'قيد التشغيل' :
                   detailedBatch.status === 'Paused' ? 'متوقفة مؤقتاً' : 'ملغاة'}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-slate-200/60 pt-3">
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">الغسالة</span>
                  <span className="text-xs font-extrabold text-slate-800 mt-1 block">{detailedBatch.machineName || 'يدوي'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">البرنامج</span>
                  <span className="text-xs font-extrabold text-slate-800 mt-1 block">{detailedBatch.programName || 'برنامج مباشر'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">الوزن الكلي</span>
                  <span className="text-xs font-extrabold text-slate-800 mt-1 block">{detailedBatch.weight} كجم</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">المشغل المسؤول</span>
                  <span className="text-xs font-extrabold text-slate-800 mt-1 block">{detailedBatch.operatorUsername || 'نظام أوتوماتيكي'}</span>
                </div>
              </div>

              {/* Status Controls */}
              {(detailedBatch.status === 'Running' || detailedBatch.status === 'Paused') && (
                <div className="flex gap-2 mt-2 pt-3 border-t border-slate-250/30">
                  {detailedBatch.status === 'Running' ? (
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      onClick={() => handleUpdateStatus(detailedBatch.id, 'Paused')}
                      className="flex-1 text-xs py-1.5"
                    >
                      <Pause size={12} />
                      إيقاف مؤقت
                    </Button>
                  ) : (
                    <Button 
                      variant="primary" 
                      size="sm" 
                      onClick={() => handleUpdateStatus(detailedBatch.id, 'Running')}
                      className="flex-1 text-xs py-1.5"
                    >
                      <Play size={12} />
                      استئناف التشغيل
                    </Button>
                  )}
                  <Button 
                    variant="primary" 
                    size="sm" 
                    onClick={() => handleUpdateStatus(detailedBatch.id, 'Completed')}
                    className="flex-1 text-xs py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border-transparent"
                  >
                    <CheckCircle size={12} />
                    إنهاء وتأكيد
                  </Button>
                  <Button 
                    variant="danger" 
                    size="sm" 
                    onClick={() => handleUpdateStatus(detailedBatch.id, 'Cancelled')}
                    className="text-xs py-1.5 px-3"
                  >
                    <XCircle size={12} />
                  </Button>
                </div>
              )}
            </div>

            {/* Linens allocation summary */}
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Layers size={14} className="text-slate-500" />
                توزيع الحمولة والوزن
              </h4>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-[9px] text-slate-400 font-bold block">ملابس نزلاء</span>
                  <span className="text-xs font-bold text-slate-700 mt-0.5 block">{detailedBatch.guestWeight} كجم</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-[9px] text-slate-400 font-bold block">زي موظفين</span>
                  <span className="text-xs font-bold text-slate-700 mt-0.5 block">{detailedBatch.staffWeight} كجم</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-[9px] text-slate-400 font-bold block">خاص ومميز</span>
                  <span className="text-xs font-bold text-slate-700 mt-0.5 block">{detailedBatch.specialWeight} كجم</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-[9px] text-slate-400 font-bold block">بقع عنيدة</span>
                  <span className="text-xs font-bold text-slate-700 mt-0.5 block">{detailedBatch.spotWeight} كجم</span>
                </div>
              </div>
            </div>

            {/* Chemicals Consumptions Expected vs Actual */}
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sliders size={14} className="text-slate-500" />
                مراقبة الجرعات الكيميائية الفعالة
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-right border-collapse">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-[10px] font-bold text-slate-500">المادة الكيميائية</th>
                      <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-500">المقترحة</th>
                      <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-500">الفعلية</th>
                      <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-500">الانحراف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {detailedBatch.consumptions && detailedBatch.consumptions.length > 0 ? (
                      detailedBatch.consumptions.map((c, i) => {
                        const variance = (c.variance ?? (c.actualQty - c.expectedQty));
                        return (
                          <tr key={i}>
                            <td className="px-3 py-2 font-bold text-slate-750">{c.chemicalName}</td>
                            <td className="px-3 py-2 text-center text-slate-600">{c.expectedQty} لتر</td>
                            <td className="px-3 py-2 text-center font-bold text-slate-800">{c.actualQty} لتر</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`font-bold ${
                                variance === 0 ? 'text-emerald-600' :
                                variance > 0 ? 'text-rose-600' : 'text-amber-600'
                              }`}>
                                {variance > 0 ? `+${variance}` : variance} لتر
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-3 text-center text-slate-400 text-[11px]">
                          لم يتم تسجيل استهلاك كيميائي لهذه الدورة
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Input Linen items checklist */}
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Layers2 size={14} className="text-slate-500" />
                قائمة البياضات المحملة بالدورة
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                {detailedBatch.items && detailedBatch.items.length > 0 ? (
                  detailedBatch.items.map((item, idx) => {
                    const matchName = STANDARD_LINENS.find(i => i.itemCode === item.itemCode)?.itemNameAr || item.itemCode;
                    return (
                      <div key={idx} className="flex justify-between items-center p-2.5 hover:bg-slate-50">
                        <span className="font-bold text-slate-700">{matchName}</span>
                        <div className="flex gap-2">
                          <span className="bg-slate-150 text-slate-700 px-2 py-0.5 rounded font-bold">{item.quantity} قطعة</span>
                          <Badge variant={item.role === 'INPUT' ? 'info' : item.role === 'OUTPUT' ? 'success' : 'danger'}>
                            {item.role === 'INPUT' ? 'مدخلات' : item.role === 'OUTPUT' ? 'سليم' : 'هالك/تالف'}
                          </Badge>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-slate-400">لا توجد أصناف مدخلة</div>
                )}
              </div>
            </div>
            
          </div>
        ) : null}
      </Drawer>

      {/* WIZARD MODAL */}
      <Modal 
        isOpen={isCreateRequested} 
        onClose={() => navigate('/laundry/batches')} 
        title={`معالج إنشاء دورة غسيل جديدة - خطوة ${wizardStep} من 5`}
        size="lg"
      >
        <div className="flex flex-col gap-6 text-right font-arabic">
          
          {/* Progress stepper line */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            {[1, 2, 3, 4, 5].map(step => (
              <div key={step} className="flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  wizardStep === step 
                    ? 'bg-blue-600 text-white' 
                    : wizardStep > step 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-slate-100 text-slate-450 border border-slate-200'
                }`}>
                  {step}
                </div>
                <span className={`text-[10px] font-bold ${wizardStep === step ? 'text-blue-600' : 'text-slate-400'}`}>
                  {step === 1 ? 'الغسالة' : step === 2 ? 'البرنامج' : step === 3 ? 'الكيماويات' : step === 4 ? 'الأوزان' : 'مراجعة'}
                </span>
                {step < 5 && <ChevronRight size={12} className="text-slate-300" />}
              </div>
            ))}
          </div>

          {/* STEP 1: Select Machine */}
          {wizardStep === 1 && (
            <div className="flex flex-col gap-4">
              <span className="text-xs font-bold text-slate-500">اختر الغسالة الصناعية الشاغرة لدورة التشغيل:</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {machines.map(m => (
                  <div 
                    key={m.id}
                    onClick={() => handleSelectMachine(m.id)}
                    className="border border-slate-200 hover:border-blue-500 rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center border border-slate-200 group-hover:bg-blue-50 group-hover:text-blue-600">
                      <WashingMachine size={20} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-extrabold text-slate-800">{m.name}</span>
                      <span className="text-[10px] text-slate-450 mt-1 font-semibold">سعة التحميل: {m.capacity} كجم</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: Select Program */}
          {wizardStep === 2 && (
            <div className="flex flex-col gap-4">
              <span className="text-xs font-bold text-slate-500">حدد دورة غسيل متوافقة مع حمولة ومستوى اتساخ الشحنة:</span>
              {wizardPrograms.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  لا توجد برامج مسجلة لهذه الغسالة. يرجى الرجوع لتبويب البرامج وإدخالها.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {wizardPrograms.map(p => (
                    <div 
                      key={p.id}
                      onClick={() => handleSelectProgram(p)}
                      className="border border-slate-200 hover:border-blue-500 rounded-xl p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-all group"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-extrabold text-slate-800">{p.name}</span>
                        <span className="text-[10px] text-slate-455 mt-1">{p.description || 'دورة غسيل قياسية'}</span>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-[10px] text-slate-500 font-bold flex items-center gap-0.5">
                            <Clock size={11} /> {p.durationMins} دقيقة
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold flex items-center gap-0.5">
                            <Thermometer size={11} /> {p.temperatureC}°م
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-400" />
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between border-t border-slate-100 pt-4">
                <Button variant="outline" size="sm" onClick={() => setWizardStep(1)}>السابق</Button>
              </div>
            </div>
          )}

          {/* STEP 3: Chemical Recipe Dosing */}
          {wizardStep === 3 && (
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500">معايير جرعات الحقن الكيميائي (وصفة: {wizardRecipe?.name || 'يدوية'}):</span>
                <Badge variant="info">مستوى أمان STRICT</Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {wizardData.consumptions.map((c, idx) => {
                  let liquidColor = 'bg-blue-500/80';
                  if (c.chemicalName.includes('صابون') || c.chemicalName.includes('منظف') || c.chemicalName.includes('Detergent')) {
                    liquidColor = 'bg-blue-500/70';
                  } else if (c.chemicalName.includes('كلور') || c.chemicalName.includes('مبيض') || c.chemicalName.includes('Bleach')) {
                    liquidColor = 'bg-amber-400/70';
                  } else if (c.chemicalName.includes('منعم') || c.chemicalName.includes('Softener')) {
                    liquidColor = 'bg-rose-400/70';
                  } else {
                    liquidColor = 'bg-teal-400/60';
                  }

                  const fillPct = Math.min(Math.round((c.actualQty / (c.expectedQty || 1)) * 65), 90);

                  return (
                    <div key={idx} className="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
                      <div className="flex items-center gap-4">
                        {/* Chemical beaker drawing */}
                        <div className="relative w-12 h-20 border-3 border-slate-500 rounded-b-xl rounded-t bg-slate-100 flex items-end overflow-hidden shadow-inner flex-shrink-0">
                          {/* Dosing ticks / measurements */}
                          <div className="absolute inset-y-0 right-1 w-1 flex flex-col justify-between py-1 text-[7px] text-slate-400 font-mono z-20 pointer-events-none select-none">
                            <span>-</span><span>-</span><span>-</span><span>-</span><span>-</span>
                          </div>
                          {/* Liquid reflection gloss */}
                          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none z-20" />
                          {/* Filling Liquid */}
                          <div 
                            className={`absolute bottom-0 inset-x-0 ${liquidColor} transition-all duration-500 rounded-b-lg`}
                            style={{ height: `${fillPct || 20}%` }}
                          />
                        </div>

                        <div className="flex flex-col text-right">
                          <span className="text-xs font-extrabold text-slate-800">{c.chemicalName}</span>
                          <span className="text-[10px] text-slate-400 font-semibold mt-1">الجرعة المقترحة: {c.expectedQty} لتر</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.1"
                          value={c.actualQty}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setWizardData(prev => ({
                              ...prev,
                              consumptions: prev.consumptions.map((item, i) => 
                                i === idx ? { ...item, actualQty: val, mode: 'MANUAL' } : item
                              )
                            }));
                          }}
                          className="w-20 px-2 py-1.5 bg-white border-2 border-slate-350 rounded-lg text-center font-bold text-slate-800 text-xs focus:outline-none focus:border-blue-500"
                        />
                        <span className="text-xs text-slate-400 font-bold">لتر</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between border-t border-slate-100 pt-4">
                <Button variant="outline" size="sm" onClick={() => setWizardStep(2)}>السابق</Button>
                <Button variant="primary" size="sm" onClick={handleRecipeNext}>التالي</Button>
              </div>
            </div>
          )}

          {/* STEP 4: Weights & pieces allocation */}
          {wizardStep === 4 && (() => {
            const maxCap = machines.find(m => m.id === wizardData.machineId)?.capacity || 10;
            const loadPct = Math.round((wizardData.weight / maxCap) * 100) || 0;
            let barColor = 'bg-emerald-500';
            let textColor = 'text-emerald-600';
            if (loadPct > 100) {
              barColor = 'bg-rose-600 animate-pulse';
              textColor = 'text-rose-600';
            } else if (loadPct > 85) {
              barColor = 'bg-amber-500';
              textColor = 'text-amber-600';
            }

            return (
              <div className="flex flex-col gap-4">
                <span className="text-xs font-bold text-slate-500">توزيع أوزان بياضات الفندق المحملة لدورة التشغيل:</span>
                
                {/* Physical Weight Scale Meter */}
                <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 flex flex-col gap-3 relative shadow-inner">
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:12px_12px] pointer-events-none rounded-2xl" />
                  
                  <div className="flex justify-between items-center text-xs font-mono font-bold relative z-10">
                    <span className="text-slate-400 font-arabic">ميزان الحمولة الآمن</span>
                    <span className={`${textColor} font-bold`}>{loadPct}% ({wizardData.weight} / {maxCap} كجم)</span>
                  </div>

                  {/* Meter Bar */}
                  <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden relative z-10 p-0.5 border border-slate-700">
                    <div className={`h-full ${barColor} rounded-full transition-all duration-300`} style={{ width: `${Math.min(loadPct, 100)}%` }} />
                  </div>

                  {/* Warning message */}
                  {loadPct > 100 && (
                    <div className="flex items-center gap-1 text-[10px] text-rose-400 font-bold animate-pulse mt-1 relative z-10 justify-center">
                      <AlertCircle size={12} />
                      تنبيه: الحمولة الموزونة تتخطى سعة الغسالة القصوى المسموحة!
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="الوزن الإجمالي للغسيل (كجم)"
                    type="number"
                    required
                    value={wizardData.weight}
                    onChange={(e) => setWizardData({ ...wizardData, weight: Number(e.target.value) })}
                  />
                  <Input
                    label="العدد التقديري للقطع (حبة)"
                    type="number"
                    value={wizardData.pieces}
                    onChange={(e) => setWizardData({ ...wizardData, pieces: Number(e.target.value) })}
                  />
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <Input
                    label="نزلاء (كجم)"
                    type="number"
                    value={wizardData.guestWeight}
                    onChange={(e) => setWizardData({ ...wizardData, guestWeight: Number(e.target.value) })}
                  />
                  <Input
                    label="زي موظفين"
                    type="number"
                    value={wizardData.staffWeight}
                    onChange={(e) => setWizardData({ ...wizardData, staffWeight: Number(e.target.value) })}
                  />
                  <Input
                    label="شراشف خاصة"
                    type="number"
                    value={wizardData.specialWeight}
                    onChange={(e) => setWizardData({ ...wizardData, specialWeight: Number(e.target.value) })}
                  />
                  <Input
                    label="بقع وتطهير"
                    type="number"
                    value={wizardData.spotWeight}
                    onChange={(e) => setWizardData({ ...wizardData, spotWeight: Number(e.target.value) })}
                  />
                </div>

                {/* Items Picker */}
                <div className="flex flex-col gap-2 mt-2">
                  <span className="text-xs font-bold text-slate-700">تثبيت البياضات والأصناف المحملة:</span>
                  <div className="flex gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200/80 items-end">
                    <div className="flex-1 flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-500">اختر الصنف</span>
                      <select
                        id="wizard-linens-picker"
                        className="px-2 py-1.5 bg-white border border-slate-200 rounded text-xs"
                      >
                        {STANDARD_LINENS.map((i, idx) => (
                          <option key={`${i.itemCode}-${idx}`} value={i.itemCode}>{i.itemNameAr}</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-24 flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-500">الكمية (حبة)</span>
                      <input
                        type="number"
                        id="wizard-linens-qty"
                        defaultValue={10}
                        className="px-2 py-1.5 bg-white border border-slate-200 rounded text-xs text-center"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const codeEl = document.getElementById('wizard-linens-picker') as HTMLSelectElement;
                        const qtyEl = document.getElementById('wizard-linens-qty') as HTMLInputElement;
                        if (codeEl && qtyEl) {
                          handleAddWizardLinen(codeEl.value, Number(qtyEl.value));
                        }
                      }}
                      className="py-1.5 px-3"
                    >
                      إضافة
                    </Button>
                  </div>

                  {/* Linens List */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                    {wizardData.items.length === 0 ? (
                      <div className="p-4 text-center text-slate-400">لم يتم اختيار أي بياضات بعد</div>
                    ) : (
                      wizardData.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2.5 bg-white hover:bg-slate-50">
                          <span className="font-bold text-slate-700">{item.itemNameAr} ({item.itemCode})</span>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-slate-800">{item.quantity} حبة</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveWizardLinen(item.itemCode)}
                              className="text-rose-600 hover:text-rose-800 font-bold"
                            >
                              حذف
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex justify-between border-t border-slate-100 pt-4">
                  <Button variant="outline" size="sm" onClick={() => setWizardStep(3)}>السابق</Button>
                  <Button 
                    variant="primary" 
                    size="sm" 
                    onClick={handleWeightsNext}
                    disabled={wizardData.items.length === 0}
                  >
                    التالي
                  </Button>
                </div>
              </div>
            );
          })()}

          {/* STEP 5: Final Review & Confirmation */}
          {wizardStep === 5 && (
            <div className="flex flex-col gap-4">
              <span className="text-xs font-bold text-slate-500">راجع البيانات المدخلة وتأكد من الجاهزية للتشغيل:</span>
              
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block">الغسالة المستهدفة</span>
                    <span className="font-extrabold text-slate-800 mt-1 block">
                      {machines.find(m => m.id === wizardData.machineId)?.name || ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block">برنامج التشغيل</span>
                    <span className="font-extrabold text-slate-800 mt-1 block">
                      {wizardPrograms.find(p => p.id === wizardData.programId)?.name || ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block">وزن شحنة الملابس</span>
                    <span className="font-extrabold text-slate-800 mt-1 block">{wizardData.weight} كجم</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block">إجمالي عدد قطع البياضات</span>
                    <span className="font-extrabold text-slate-800 mt-1 block">
                      {wizardData.pieces || wizardData.items.reduce((sum, item) => sum + item.quantity, 0)} قطعة
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between border-t border-slate-100 pt-4">
                <Button variant="outline" size="sm" onClick={() => setWizardStep(4)}>السابق</Button>
                <Button 
                  variant="primary" 
                  size="sm" 
                  onClick={handleStartBatch} 
                  isLoading={submitting}
                  className="bg-emerald-600 hover:bg-emerald-700 border-transparent text-white gap-1.5"
                >
                  <Play size={14} />
                  بدأ تشغيل الدورة الآن!
                </Button>
              </div>
            </div>
          )}

        </div>
      </Modal>

    </div>
  );
}
