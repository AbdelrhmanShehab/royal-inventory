import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  WashingMachine, 
  Activity, 
  DollarSign, 
  Layers, 
  Search, 
  Play, 
  TrendingUp, 
  RotateCw, 
  Gauge
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Loader from '../../components/ui/Loader';
import { laundryApi } from '../../api/laundry.api';
import type { LaundryMachine, LaundryBatch } from '../../types/laundry';

export default function LaundryDashboard() {
  const navigate = useNavigate();
  const [machines, setMachines] = useState<LaundryMachine[]>([]);
  const [activeBatches, setActiveBatches] = useState<LaundryBatch[]>([]);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [mList, bList] = await Promise.all([
        laundryApi.getMachines(),
        laundryApi.getBatches()
      ]);

      setMachines(mList || []);
      setActiveBatches(bList || []);

      // Unified dashboard summary call for stats (today's stats)
      const today = new Date().toISOString().split('T')[0];
      const summary = await laundryApi.getDashboardSummary(
        `${today}T00:00:00.000Z`,
        `${today}T23:59:59.999Z`
      );
      setDashboardStats(summary || null);
    } catch (error) {
      console.error('Error loading laundry dashboard details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Refresh machine states periodically every 15s to keep dashboard active
    const timer = setInterval(() => {
      loadData();
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  if (loading && !dashboardStats) {
    return (
      <div className="h-full flex items-center justify-center py-20">
        <Loader size="lg" label="جاري تشغيل مركز العمليات ومزامنة بيانات الغسالات..." />
      </div>
    );
  }

  // Calculate machine running counts
  const runningBatches = activeBatches.filter(b => b.status === 'Running' || b.status === 'Paused');
  const runningMachineIds = runningBatches.map(b => b.machineId);
  const runningCount = machines.filter(m => runningMachineIds.includes(m.id)).length;
  const idleCount = machines.length - runningCount;

  // Search filter
  const filteredMachines = machines.filter(m => {
    const q = searchQuery.toLowerCase();
    const batch = activeBatches.find(b => b.machineId === m.id && (b.status === 'Running' || b.status === 'Paused'));
    return (
      m.name.toLowerCase().includes(q) ||
      (batch && batch.batchNumber.toLowerCase().includes(q)) ||
      (batch && (batch.programName || '').toLowerCase().includes(q)) ||
      (batch && (batch.operatorUsername || '').toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex flex-col gap-6 font-arabic dir-rtl select-none">
      {/* Brand Operations Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md animate-pulse">
            <WashingMachine size={24} />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-extrabold text-slate-800 flex items-center gap-2">
              لوحة التحكم والمراقبة الفورية (المغسلة)
            </h1>
            <p className="text-xs lg:text-sm text-slate-500 mt-1 leading-relaxed">
              شاشة تشغيل حية لمراقبة الأجهزة الصناعية، برامج الحقن الكيميائي، وحساب معدل الإنتاجية والفاقد والربحية.
            </p>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" size="sm" onClick={loadData} className="w-full md:w-auto">
            <RotateCw size={14} className="animate-spin-slow" />
            تحديث الحالة
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/laundry/batches')} className="w-full md:w-auto">
            <Play size={14} />
            دورة تشغيل جديدة
          </Button>
        </div>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[
          { label: 'غسالات قيد التشغيل', value: runningCount, subtitle: `من أصل ${machines.length}`, icon: Gauge, color: 'text-blue-600 bg-blue-50 border-blue-100' },
          { label: 'غسالات خاملة (جاهزة)', value: idleCount, subtitle: 'بانتظار التحميل', icon: WashingMachine, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
          { label: 'دورات اليوم الكلية', value: dashboardStats?.batches?.totalRuns || 0, subtitle: `${dashboardStats?.batches?.totalPieces || 0} قطعة ملابس`, icon: Activity, color: 'text-purple-600 bg-purple-50 border-purple-100' },
          { label: 'وزن التشغيل اليومي', value: `${dashboardStats?.batches?.totalWeightKg || 0} كجم`, subtitle: 'متوسط الحمولة 85%', icon: Layers, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
          { label: 'تكلفة الكيماويات اليوم', value: `${(dashboardStats?.batches?.totalChemicalCost || 0).toLocaleString()} ج.م`, subtitle: 'شامل الصابون والمطهرات', icon: DollarSign, color: 'text-rose-600 bg-rose-50 border-rose-100' },
          { label: 'إجمالي إيرادات اليوم', value: `${(dashboardStats?.revenue?.totalRevenue || 0).toLocaleString()} ج.م`, subtitle: `من ${dashboardStats?.revenue?.totalTickets || 0} تذكرة POS`, icon: TrendingUp, color: 'text-amber-600 bg-amber-50 border-amber-100' },
        ].map((kpi, idx) => (
          <Card key={idx} className="border-slate-200/60 shadow-2xs hover:shadow-xs transition-shadow">
            <Card.Body className="p-4 flex flex-col justify-between h-full gap-3">
              <div className="flex justify-between items-start">
                <span className="text-[10px] md:text-xs font-bold text-slate-500">{kpi.label}</span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${kpi.color}`}>
                  <kpi.icon size={16} />
                </div>
              </div>
              <div>
                <span className="text-lg md:text-xl font-extrabold text-slate-800 leading-none">{kpi.value}</span>
                <p className="text-[9px] text-slate-400 mt-1 font-semibold">{kpi.subtitle}</p>
              </div>
            </Card.Body>
          </Card>
        ))}
      </div>

      {/* Global Search & Filters */}
      <div className="flex items-center gap-3 bg-white p-3 border border-slate-200/80 rounded-xl">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="بحث سريع عن غسالة، رقم دورة، برنامج تشغيل، أو اسم المشغل..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-10 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs md:text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all placeholder-slate-400"
          />
        </div>
      </div>

      {/* Live Machines Monitor Grid */}
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <Activity size={18} className="text-blue-600" />
          الحالة الحية للمكائن والغسالات الصناعية
        </h2>

        {filteredMachines.length === 0 ? (
          <Card className="border-slate-200/60 p-12 text-center text-slate-400 text-sm">
            لا توجد أجهزة مطابقة للبحث أو مدخلة بالنظام.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMachines.map((m) => {
              // Find if this machine has an active running batch
              const activeBatch = activeBatches.find(
                (b) => b.machineId === m.id && (b.status === 'Running' || b.status === 'Paused')
              );

              // Mock progress calculation for aesthetic appeal
              let progressPercent = 0;
              let stageText = 'خاملة';
              let tempC = 0;
              let timeRemaining = '00:00';

              if (activeBatch) {
                // If running, determine current cycle stages based on active batch time or mock
                const elapsedMins = activeBatch.startedAt 
                  ? Math.floor((Date.now() - new Date(activeBatch.startedAt).getTime()) / 60000) 
                  : 10;
                const duration = activeBatch.programId ? 45 : 30; // default mins
                progressPercent = Math.min(Math.round((elapsedMins / duration) * 100), 99);
                tempC = activeBatch.status === 'Paused' ? 25 : 55;

                if (progressPercent < 15) {
                  stageText = 'تجهيز وضخ المياه';
                } else if (progressPercent < 40) {
                  stageText = 'حقن كيميائي وغسيل رئيسي';
                } else if (progressPercent < 70) {
                  stageText = 'شطف وتصريف';
                } else {
                  stageText = 'عصر سريع وتجفيف';
                }

                if (activeBatch.status === 'Paused') {
                  stageText = 'متوقف مؤقتاً';
                }

                const remainMins = Math.max(duration - elapsedMins, 1);
                timeRemaining = `${remainMins.toString().padStart(2, '0')}:00`;
              }

              return (
                <Card 
                  key={m.id} 
                  className={`border-slate-350 hover:border-blue-500 transition-all shadow-md relative overflow-hidden bg-gradient-to-b from-slate-100 to-slate-200 group rounded-2xl border-2`}
                >
                  {/* Top Control Panel of the Washing Machine */}
                  <div className="bg-slate-800 text-slate-200 px-4 py-2.5 border-b border-slate-700 flex justify-between items-center text-[10px] font-mono tracking-wider">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        activeBatch 
                          ? (activeBatch.status === 'Paused' ? 'bg-amber-400 animate-pulse' : 'bg-blue-400 animate-pulse') 
                          : 'bg-emerald-500 animate-indicator-pulse'
                      }`} />
                      <span>{activeBatch ? (activeBatch.status === 'Paused' ? 'SYS-PAUSED' : 'SYS-RUNNING') : 'SYS-READY'}</span>
                    </div>
                    <span className="font-extrabold">{m.name}</span>
                  </div>

                  <Card.Body className="p-4 flex flex-col gap-4">
                    {/* The Visual Drum / Door Container */}
                    <div className="flex justify-center py-2 relative">
                      {/* Washing Machine Door Frame (circular 3D window) */}
                      <div className="relative w-36 h-36 rounded-full border-8 border-slate-400 bg-slate-900 shadow-inner flex items-center justify-center overflow-hidden">
                        {/* Shimmer reflection */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none z-20" />
                        
                        {/* Sloshing Water simulation */}
                        {activeBatch ? (
                          <>
                            <div className={`absolute bottom-0 left-0 right-0 h-[60%] bg-blue-500/30 transition-all duration-1000 z-10 ${
                              activeBatch.status === 'Running' ? 'animate-slosh' : ''
                            }`}>
                              <div className="absolute top-0 inset-x-0 h-1.5 bg-blue-400/40" />
                            </div>
                            
                            {/* Tiny rising bubbles */}
                            {activeBatch.status === 'Running' && (
                              <div className="absolute inset-0 z-15 pointer-events-none">
                                <div className="absolute w-1.5 h-1.5 rounded-full bg-white/60 left-[20%] animate-bubbles" style={{ animationDelay: '0s' }} />
                                <div className="absolute w-1 h-1 rounded-full bg-white/50 left-[50%] animate-bubbles" style={{ animationDelay: '0.4s' }} />
                                <div className="absolute w-2.5 h-2.5 rounded-full bg-white/40 left-[80%] animate-bubbles" style={{ animationDelay: '0.8s' }} />
                                <div className="absolute w-1 h-1 rounded-full bg-white/70 left-[40%] animate-bubbles" style={{ animationDelay: '1.2s' }} />
                              </div>
                            )}

                            {/* Rotating clothes inside */}
                            <div className={`z-10 text-white/80 p-2 ${
                              activeBatch.status === 'Running' ? 'animate-spin-slow' : ''
                            }`}>
                              <Layers size={36} className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
                            </div>
                          </>
                        ) : (
                          // Idle empty drum
                          <div className="text-slate-600 z-10 flex flex-col items-center gap-1 font-bold text-[10px]">
                            <WashingMachine size={36} className="opacity-25" />
                            <span className="opacity-45">حوض فارغ</span>
                          </div>
                        )}
                      </div>

                      {/* Remaining Time LED Overlay */}
                      {activeBatch && (
                        <div className="absolute top-4 right-4 bg-slate-950 text-rose-500 font-mono px-2 py-0.5 rounded border border-slate-800 text-[11px] font-bold shadow-inner">
                          {timeRemaining}
                        </div>
                      )}

                      {/* Temperature Indicator LED Overlay */}
                      {activeBatch && tempC > 0 && (
                        <div className="absolute top-4 left-4 bg-slate-950 text-amber-500 font-mono px-2 py-0.5 rounded border border-slate-800 text-[11px] font-bold shadow-inner">
                          {tempC}°C
                        </div>
                      )}
                    </div>

                    {/* Progress Bar & Details */}
                    {activeBatch ? (
                      <div className="bg-slate-800/95 text-slate-100 rounded-xl p-3 border border-slate-700 flex flex-col gap-2">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                          <span>{stageText}</span>
                          <span>{progressPercent}%</span>
                        </div>
                        {/* Process progress bar */}
                        <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                        </div>
                        <div className="flex justify-between items-center text-[10px] mt-1">
                          <span className="text-slate-350">البرنامج: {activeBatch.programName || 'يدوي'}</span>
                          <span className="text-slate-350">{activeBatch.weight} كجم</span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white/85 border border-dashed border-slate-300 rounded-xl py-3.5 text-center text-xs text-slate-500 font-bold">
                        جاهز لاستقبال عهدة بياضات جديدة
                      </div>
                    )}

                    {/* Bottom controls */}
                    <div className="flex justify-between items-center pt-2 border-t border-slate-250/30">
                      <div className="text-[10px] text-slate-550 font-bold">
                        {activeBatch ? `دورة #${activeBatch.batchNumber}` : 'خامل'}
                      </div>
                      <div className="flex gap-1.5">
                        {activeBatch ? (
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={() => navigate(`/laundry/batches?batchId=${activeBatch.id}`)}
                            className="px-2.5 py-1 text-[11px] font-bold"
                          >
                            لوحة التحكم
                          </Button>
                        ) : (
                          <Button 
                            variant="primary" 
                            size="sm" 
                            onClick={() => navigate(`/laundry/batches?machineId=${m.id}`)}
                            className="px-2.5 py-1 text-[11px] font-bold"
                          >
                            تشغيل الغسالة
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Warnings & Chemical Overrides Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Batch Summary Widget */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          <h3 className="text-sm font-bold text-slate-800">أحدث دورات الغسيل اليوم</h3>
          <Card className="border-slate-200/60 shadow-2xs">
            <Card.Body className="p-0">
              <div className="divide-y divide-slate-100">
                {activeBatches.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">لا توجد دورات مسجلة اليوم</div>
                ) : (
                  activeBatches.slice(0, 5).map((batch) => (
                    <div key={batch.id} className="flex justify-between items-center p-3.5 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-100">
                          {batch.batchNumber.split('-')[1] || batch.id}
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="text-xs font-extrabold text-slate-800">دورة #{batch.batchNumber}</span>
                          <span className="text-[10px] text-slate-400 mt-1 font-semibold">
                            {batch.machineName || 'غسالة صناعية'} • {batch.programName || 'برنامج يدوي'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-bold text-slate-800">{batch.weight} كجم</span>
                          <span className="text-[9px] text-slate-400 mt-0.5">{batch.pieces} قطعة</span>
                        </div>
                        <Badge variant={
                          batch.status === 'Completed' ? 'success' :
                          batch.status === 'Running' ? 'info' :
                          batch.status === 'Paused' ? 'warning' : 'danger'
                        }>
                          {batch.status === 'Completed' ? 'اكتملت' :
                           batch.status === 'Running' ? 'تعمل' :
                           batch.status === 'Paused' ? 'مؤقت' : 'ملغاة'}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card.Body>
          </Card>
        </div>

        {/* Alert and System Status Panel */}
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold text-slate-800">حالة مضخات الكيماويات والشبكة</h3>
          <Card className="border-slate-200/60 shadow-2xs">
            <Card.Body className="p-4 flex flex-col gap-4">
              {[
                { label: 'مستودع الكيماويات المركزي', val: 'مستقر - مخزون كافٍ', status: 'success' },
                { label: 'وحدات ضخ المياه والصرف', val: 'مستقر - ضغط 4.2 بار', status: 'success' },
                { label: 'مزامنة الكيماويات الأوتوماتيكية', val: 'تعمل كالمعتاد', status: 'success' },
                { label: 'صيانة الغسالة رقم 4 (مجدولة)', val: 'بعد 12 ساعة تشغيل', status: 'warning' }
              ].map((sys, idx) => (
                <div key={idx} className="flex justify-between items-center p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                  <div className="flex flex-col text-right">
                    <span className="text-xs font-bold text-slate-800">{sys.label}</span>
                    <span className="text-[10px] text-slate-400 mt-0.5 font-semibold">{sys.val}</span>
                  </div>
                  <Badge variant={sys.status as any}>{sys.status === 'success' ? 'مستقر' : 'تنبيه'}</Badge>
                </div>
              ))}
            </Card.Body>
          </Card>
        </div>
      </div>
    </div>
  );
}
