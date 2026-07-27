import { useState, useEffect } from 'react';
import { 
  Settings, 
  RotateCw, 
  CloudLightning,
  UserCheck
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { laundryApi } from '../../api/laundry.api';

export default function SettingsPage() {
  const [lastSync, setLastSync] = useState<any>(null);
  const [syncLoading, setSyncLoading] = useState(false);

  // Mock ZK Custody checkins list for visual completeness
  const zkCheckins = [
    { checkinId: 1, employeeId: 101, employeeName: 'أحمد علي', checkTime: '2026-07-12 08:30:12', sensorId: 4 },
    { checkinId: 2, employeeId: 102, employeeName: 'محمد سعيد', checkTime: '2026-07-12 08:45:00', sensorId: 4 },
    { checkinId: 3, employeeId: 105, employeeName: 'محمود جابر', checkTime: '2026-07-12 09:00:15', sensorId: 2 }
  ];

  const loadData = async () => {
    try {
      const syncStatus = await laundryApi.getLastPosSync();
      setLastSync(syncStatus || null);
    } catch (err) {
      console.error('Failed to load settings details:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSyncNow = async () => {
    try {
      setSyncLoading(true);
      await laundryApi.syncComsysPOS();
      await loadData();
    } catch (err) {
      console.error('POS Sync failed:', err);
    } finally {
      setSyncLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 font-arabic dir-rtl select-none text-right">
      
      {/* Header section */}
      <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-extrabold text-slate-800 flex items-center gap-2">
            <Settings size={24} className="text-blue-600 animate-spin-slow" />
            إعدادات النظام ومزامنة POS
          </h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-1">
            ربط مبيعات وتذاكر المغسلة مع نظام COMSYS POS ومزامنة حضور وانصراف موظفي المغسلة عبر أجهزة البصمة ZK.
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* COMSYS POS Sync Widget */}
        <div className="flex flex-col gap-4">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <CloudLightning size={18} className="text-blue-600" />
            مزامنة مبيعات المغسلة (COMSYS POS Link)
          </h2>
          <Card className="border-slate-200/60 shadow-2xs">
            <Card.Body className="p-5 flex flex-col gap-5">
              
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex justify-between items-center text-xs">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-slate-400 font-bold">آخر مزامنة ناجحة</span>
                  <span className="font-extrabold text-slate-800">
                    {lastSync ? new Date(lastSync.syncedAt).toLocaleString('ar-EG') : 'غير متوفر'}
                  </span>
                  <span className="text-[10px] text-slate-450 mt-1 font-semibold">
                    تم استيراد {lastSync?.ordersImported || 0} تذكرة مبيعات
                  </span>
                </div>
                <Badge variant={lastSync?.status === 'success' ? 'success' : 'neutral'}>
                  {lastSync?.status === 'success' ? 'مزامنة نشطة' : 'متوقفة'}
                </Badge>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-xs text-slate-500 leading-relaxed font-bold">
                  ملاحظة: يقوم الخادم بتشغيل مزامنة تلقائية عبر Cron Job كل 15 دقيقة. يمكنك استخدام الزر أدناه لتشغيل المزامنة اليدوية الفورية واستيراد التذاكر الجديدة من قاعدة بيانات POS.
                </p>
              </div>

              <div className="border-t border-slate-100 pt-4 mt-2">
                <Button 
                  variant="primary" 
                  size="sm" 
                  onClick={handleSyncNow} 
                  isLoading={syncLoading}
                  className="w-full gap-2"
                >
                  <RotateCw size={14} />
                  تشغيل مزامنة يدوية فورية الآن
                </Button>
              </div>

            </Card.Body>
          </Card>
        </div>

        {/* ZK Custody device integration */}
        <div className="flex flex-col gap-4">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <UserCheck size={18} className="text-blue-600" />
            حضور وانصراف موظفي المغسلة (ZK Attendance)
          </h2>
          <Card className="border-slate-200/60 shadow-2xs">
            <Card.Body className="p-0">
              
              <div className="p-4 border-b border-slate-100 flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700">حالة الربط بجهاز البصمة:</span>
                <Badge variant="success">متصل - منفذ 4370</Badge>
              </div>

              <div className="divide-y divide-slate-100 text-xs">
                {zkCheckins.map((checkin) => (
                  <div key={checkin.checkinId} className="flex justify-between items-center p-3.5 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-150 flex items-center justify-center font-bold text-[10px] text-slate-700">
                        {checkin.employeeId}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">{checkin.employeeName}</span>
                        <span className="text-[9px] text-slate-400 mt-1 font-semibold">بصمة إصبع (حساس رقم {checkin.sensorId})</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">{checkin.checkTime}</span>
                  </div>
                ))}
              </div>

            </Card.Body>
          </Card>
        </div>

      </div>

    </div>
  );
}
