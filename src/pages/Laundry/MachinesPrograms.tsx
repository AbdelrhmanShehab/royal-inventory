import { useState, useEffect } from 'react';
import { 
  WashingMachine, 
  Trash2, 
  Edit3, 
  Clock, 
  Thermometer, 
  RotateCw, 
  Droplet
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Loader from '../../components/ui/Loader';
import { laundryApi } from '../../api/laundry.api';
import type { LaundryMachine, LaundryProgram, LaundryRecipe } from '../../types/laundry';

export default function MachinesPrograms() {
  const [machines, setMachines] = useState<LaundryMachine[]>([]);
  const [recipes, setRecipes] = useState<LaundryRecipe[]>([]);
  const [programs, setPrograms] = useState<LaundryProgram[]>([]);
  const [selectedMachineId, setSelectedMachineId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [programsLoading, setProgramsLoading] = useState(false);

  // Modals
  const [isMachineModalOpen, setIsMachineModalOpen] = useState(false);
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  
  // Forms
  const [machineForm, setMachineForm] = useState({
    machineName: '',
    capacityKg: 25,
    isActive: true
  });

  const [programForm, setProgramForm] = useState({
    id: 0,
    programName: '',
    description: '',
    recommendedCapacity: 20,
    maximumCapacity: 25,
    recipeId: 0,
    durationMins: 45,
    temperatureC: 60,
    waterLevelLiters: 120,
    spinSpeedRpm: 1000,
    isActive: true
  });

  const [isEditingProgram, setIsEditingProgram] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [mList, rList] = await Promise.all([
        laundryApi.getMachines(),
        laundryApi.getRecipes()
      ]);
      setMachines(mList || []);
      setRecipes(rList || []);
      if (mList && mList.length > 0) {
        setSelectedMachineId(mList[0].id);
      }
    } catch (err) {
      console.error('Error loading machines:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPrograms = async (mId: number) => {
    try {
      setProgramsLoading(true);
      const pList = await laundryApi.getPrograms(mId);
      setPrograms(pList || []);
    } catch (err) {
      console.error('Error loading programs:', err);
    } finally {
      setProgramsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedMachineId !== null) {
      loadPrograms(selectedMachineId);
    } else {
      setPrograms([]);
    }
  }, [selectedMachineId]);

  // Machine Actions
  const handleCreateMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await laundryApi.createMachine(machineForm);
      setIsMachineModalOpen(false);
      setMachineForm({ machineName: '', capacityKg: 25, isActive: true });
      loadData();
    } catch (err) {
      console.error('Error creating machine:', err);
    }
  };

  // Program Actions
  const handleSaveProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMachineId === null) return;
    try {
      const payload: any = {
        machineId: selectedMachineId,
        programName: programForm.programName,
        description: programForm.description,
        recommendedCapacity: programForm.recommendedCapacity,
        maximumCapacity: programForm.maximumCapacity,
        recipeId: programForm.recipeId || null,
        durationMins: programForm.durationMins,
        temperatureC: programForm.temperatureC,
        waterLevelLiters: programForm.waterLevelLiters,
        spinSpeedRpm: programForm.spinSpeedRpm,
        isActive: programForm.isActive
      };

      if (isEditingProgram) {
        await laundryApi.updateProgram(programForm.id, payload);
      } else {
        await laundryApi.createProgram(payload);
      }

      setIsProgramModalOpen(false);
      setProgramForm({
        id: 0,
        programName: '',
        description: '',
        recommendedCapacity: 20,
        maximumCapacity: 25,
        recipeId: 0,
        durationMins: 45,
        temperatureC: 60,
        waterLevelLiters: 120,
        spinSpeedRpm: 1000,
        isActive: true
      });
      loadPrograms(selectedMachineId);
    } catch (err) {
      console.error('Error saving program:', err);
    }
  };

  const handleEditProgramClick = (p: LaundryProgram) => {
    setIsEditingProgram(true);
    setProgramForm({
      id: p.id,
      programName: p.name,
      description: p.description || '',
      recommendedCapacity: p.recommendedCapacity || 20,
      maximumCapacity: p.maximumCapacity || 25,
      recipeId: p.recipeId || 0,
      durationMins: p.durationMins || 45,
      temperatureC: p.temperatureC || 60,
      waterLevelLiters: p.waterLevelLiters || 120,
      spinSpeedRpm: p.spinSpeedRpm || 1000,
      isActive: p.isActive
    });
    setIsProgramModalOpen(true);
  };

  const handleDeleteProgramClick = async (pId: number) => {
    if (!confirm('هل أنت متأكد من رغبتك في حذف برنامج التشغيل هذا نهائياً؟')) return;
    try {
      await laundryApi.deleteProgram(pId);
      if (selectedMachineId !== null) {
        loadPrograms(selectedMachineId);
      }
    } catch (err) {
      console.error('Error deleting program:', err);
    }
  };

  return (
    <div className="flex flex-col gap-6 font-arabic dir-rtl select-none text-right">
      
      {/* Header section */}
      <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-extrabold text-slate-800 flex items-center gap-2">
            <WashingMachine size={24} className="text-blue-600" />
            تهيئة المكائن وبرامج الغسيل الصناعية
          </h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-1">
            إضافة وإعداد الغسالات الصناعية وسعاتها، وتخصيص دورات الغسيل (درجات الحرارة، سرعة العصر، كميات ضخ المياه، الوصفات الكيميائية).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsMachineModalOpen(true)}>
            إضافة غسالة جديدة
          </Button>
          <Button 
            variant="primary" 
            size="sm" 
            onClick={() => {
              setIsEditingProgram(false);
              setIsProgramModalOpen(true);
            }}
            disabled={selectedMachineId === null}
          >
            إضافة برنامج غسيل
          </Button>
        </div>
      </div>

      {/* Main Grid: Machines List on Right, Selected Machine's Programs on Left */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Machines List (1 Col) */}
        <div className="flex flex-col gap-4">
          <h2 className="text-base font-bold text-slate-800">الأجهزة المتوفرة</h2>
          {loading ? (
            <Loader size="sm" label="جاري جلب قائمة الأجهزة..." />
          ) : machines.length === 0 ? (
            <div className="bg-white border border-slate-200 p-8 rounded-xl text-center text-slate-400 text-sm">
              لم يتم تعريف أي غسالة صناعية في النظام.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {machines.map(m => (
                <div 
                  key={m.id}
                  onClick={() => setSelectedMachineId(m.id)}
                  className={`p-4 border rounded-xl cursor-pointer transition-all flex justify-between items-center bg-white shadow-2xs hover:shadow-xs ${
                    selectedMachineId === m.id 
                      ? 'border-blue-600 ring-1 ring-blue-500/20' 
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${
                      selectedMachineId === m.id 
                        ? 'bg-blue-50 text-blue-600 border-blue-100' 
                        : 'bg-slate-50 text-slate-450 border-slate-200'
                    }`}>
                      <WashingMachine size={18} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-extrabold text-slate-800">{m.name}</span>
                      <span className="text-[10px] text-slate-400 font-bold mt-0.5">حمولة {m.capacity} كجم</span>
                    </div>
                  </div>
                  <Badge variant={m.isActive ? 'success' : 'neutral'}>
                    {m.isActive ? 'نشطة' : 'معطلة'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Machine Programs List (2 Cols) */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <h2 className="text-base font-bold text-slate-800">
            برامج تشغيل غسالة: {machines.find(m => m.id === selectedMachineId)?.name || ''}
          </h2>

          <Card className="border-slate-200/60 shadow-2xs">
            <Card.Body className="p-4">
              {programsLoading ? (
                <div className="py-12 flex justify-center items-center">
                  <Loader size="sm" label="جاري تحميل برامج الغسيل..." />
                </div>
              ) : programs.length === 0 ? (
                <div className="py-12 text-center text-slate-450 text-xs">
                  لا توجد برامج غسيل مخصصة لهذه الغسالة بعد. اضغط "إضافة برنامج غسيل" بالخارج لإنشاء أول برنامج.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {programs.map(p => {
                    const matchRec = recipes.find(r => r.id === p.recipeId);
                    return (
                      <div key={p.id} className="border border-slate-200 hover:border-slate-300 rounded-xl p-4 flex flex-col justify-between bg-slate-50/50 hover:bg-white transition-all group">
                        
                        {/* Title */}
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col">
                            <span className="text-sm font-extrabold text-slate-800">{p.name}</span>
                            <span className="text-[10px] text-slate-400 mt-1">{p.description || 'دورة غسيل قياسية'}</span>
                          </div>
                          <Badge variant={p.isActive ? 'info' : 'neutral'}>
                            {p.isActive ? 'متاح' : 'غير متوفر'}
                          </Badge>
                        </div>

                        {/* Settings parameter strip */}
                        <div className="grid grid-cols-4 gap-2 mt-4 text-center text-xs">
                          <div className="bg-white p-1.5 rounded border border-slate-200/80">
                            <span className="text-[9px] text-slate-400 font-semibold block">المدة</span>
                            <span className="font-extrabold text-slate-700 mt-0.5 block flex items-center justify-center gap-0.5">
                              <Clock size={10} className="text-slate-450" /> {p.durationMins} د
                            </span>
                          </div>
                          <div className="bg-white p-1.5 rounded border border-slate-200/80">
                            <span className="text-[9px] text-slate-400 font-semibold block">الحرارة</span>
                            <span className="font-extrabold text-slate-700 mt-0.5 block flex items-center justify-center gap-0.5">
                              <Thermometer size={10} className="text-slate-450" /> {p.temperatureC}°
                            </span>
                          </div>
                          <div className="bg-white p-1.5 rounded border border-slate-200/80">
                            <span className="text-[9px] text-slate-400 font-semibold block">المياه</span>
                            <span className="font-extrabold text-slate-700 mt-0.5 block flex items-center justify-center gap-0.5">
                              <Droplet size={10} className="text-slate-450" /> {p.waterLevelLiters} ل
                            </span>
                          </div>
                          <div className="bg-white p-1.5 rounded border border-slate-200/80">
                            <span className="text-[9px] text-slate-400 font-semibold block">العصر</span>
                            <span className="font-extrabold text-slate-700 mt-0.5 block flex items-center justify-center gap-0.5">
                              <RotateCw size={10} className="text-slate-450" /> {p.spinSpeedRpm}
                            </span>
                          </div>
                        </div>

                        {/* Linked recipe detail */}
                        <div className="mt-3 bg-white px-2 py-1.5 rounded border border-slate-100 text-[10px] text-slate-500 font-bold flex justify-between items-center">
                          <span>الجرعة المبرمجة:</span>
                          <span className="text-blue-600">{matchRec ? matchRec.name : 'حقن يدوي كلي'}</span>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 mt-3">
                          <button
                            onClick={() => handleEditProgramClick(p)}
                            className="w-7 h-7 rounded border border-slate-200 text-slate-500 hover:text-slate-750 hover:bg-slate-50 flex items-center justify-center transition-colors cursor-pointer"
                            title="تعديل المعايير"
                          >
                            <Edit3 size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteProgramClick(p.id)}
                            className="w-7 h-7 rounded border border-slate-200 text-rose-500 hover:text-rose-700 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                            title="حذف البرنامج"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </Card.Body>
          </Card>
        </div>

      </div>

      {/* CREATE MACHINE MODAL */}
      <Modal isOpen={isMachineModalOpen} onClose={() => setIsMachineModalOpen(false)} title="تعريف غسالة صناعية جديدة">
        <form onSubmit={handleCreateMachine} className="flex flex-col gap-4 font-arabic">
          <Input
            label="اسم الغسالة التعريفي"
            placeholder="مثال: غسالة هيبش رقم 5 (حمولة ثقيلة)"
            required
            value={machineForm.machineName}
            onChange={(e) => setMachineForm({ ...machineForm, machineName: e.target.value })}
          />
          <Input
            label="السعة الاستيعابية القصوى (كجم)"
            type="number"
            min={1}
            required
            value={machineForm.capacityKg}
            onChange={(e) => setMachineForm({ ...machineForm, capacityKg: Number(e.target.value) })}
          />
          <div className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              id="machine-active-chk"
              checked={machineForm.isActive}
              onChange={(e) => setMachineForm({ ...machineForm, isActive: e.target.checked })}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
            />
            <label htmlFor="machine-active-chk" className="text-xs font-bold text-slate-700">تفعيل العمل الفوري للجهاز بالنظام</label>
          </div>
          <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsMachineModalOpen(false)}>إلغاء</Button>
            <Button type="submit" variant="primary">حفظ الجهاز</Button>
          </div>
        </form>
      </Modal>

      {/* CREATE / EDIT PROGRAM MODAL */}
      <Modal 
        isOpen={isProgramModalOpen} 
        onClose={() => setIsProgramModalOpen(false)} 
        title={isEditingProgram ? 'تعديل معايير برنامج التشغيل' : 'إنشاء برنامج غسيل جديد'}
      >
        <form onSubmit={handleSaveProgram} className="flex flex-col gap-4 font-arabic">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="اسم البرنامج"
              placeholder="مثال: قطنيات حرارة عالية"
              required
              value={programForm.programName}
              onChange={(e) => setProgramForm({ ...programForm, programName: e.target.value })}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">الوصفة الكيميائية المربوطة</label>
              <select
                value={programForm.recipeId}
                onChange={(e) => setProgramForm({ ...programForm, recipeId: Number(e.target.value) })}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-bold"
              >
                <option value={0}>دون ربط تلقائي (حقن يدوي كلي)</option>
                {recipes.map(r => (
                  <option key={r.id} value={r.id}>{r.name} ({r.mode})</option>
                ))}
              </select>
            </div>
          </div>

          <Input
            label="تفاصيل ووصف البرنامج"
            placeholder="مثال: يخصص لغسيل أغطية السرير والمناشف المتسخة بشدة"
            value={programForm.description}
            onChange={(e) => setProgramForm({ ...programForm, description: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="الوزن المقترح للتشغيل (كجم)"
              type="number"
              value={programForm.recommendedCapacity}
              onChange={(e) => setProgramForm({ ...programForm, recommendedCapacity: Number(e.target.value) })}
            />
            <Input
              label="الوزن الأقصى المسموح (كجم)"
              type="number"
              value={programForm.maximumCapacity}
              onChange={(e) => setProgramForm({ ...programForm, maximumCapacity: Number(e.target.value) })}
            />
          </div>

          <div className="grid grid-cols-4 gap-2">
            <Input
              label="المدة (دقيقة)"
              type="number"
              value={programForm.durationMins}
              onChange={(e) => setProgramForm({ ...programForm, durationMins: Number(e.target.value) })}
            />
            <Input
              label="درجة الحرارة"
              type="number"
              value={programForm.temperatureC}
              onChange={(e) => setProgramForm({ ...programForm, temperatureC: Number(e.target.value) })}
            />
            <Input
              label="المياه (لتر)"
              type="number"
              value={programForm.waterLevelLiters}
              onChange={(e) => setProgramForm({ ...programForm, waterLevelLiters: Number(e.target.value) })}
            />
            <Input
              label="العصر (RPM)"
              type="number"
              value={programForm.spinSpeedRpm}
              onChange={(e) => setProgramForm({ ...programForm, spinSpeedRpm: Number(e.target.value) })}
            />
          </div>

          <div className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              id="program-active-chk"
              checked={programForm.isActive}
              onChange={(e) => setProgramForm({ ...programForm, isActive: e.target.checked })}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
            />
            <label htmlFor="program-active-chk" className="text-xs font-bold text-slate-700">تفعيل البرنامج للتشغيل العام فورا</label>
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsProgramModalOpen(false)}>إلغاء</Button>
            <Button type="submit" variant="primary">حفظ تفاصيل الدورة</Button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
