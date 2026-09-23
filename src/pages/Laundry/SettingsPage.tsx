import { useState, useEffect } from 'react';
import { 
  RefreshCw,
  UserCheck
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { laundryApi } from '../../api/laundry.api';

export default function SettingsPage() {
  const [lastSync, setLastSync] = useState<any>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [zkCheckins, setZkCheckins] = useState<any[]>([]);

  const loadData = async () => {
    try {
      const syncStatus = await laundryApi.getLastPosSync();
      setLastSync(syncStatus || null);
      const res = await laundryApi.getZkCheckins(10);
      const checkins = Array.isArray(res) ? res : (res?.data || []);
      setZkCheckins(checkins || []);
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
    <div className="flex flex-col gap-6 select-none">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-extrabold text-slate-800">
            إعدادات النظام والربط بالأجهزة
          </h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-1">
            إدارة إعدادات الربط بنقاط البيع COMSYS وأجهزة الحضور والعهد ZK.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* POS COMSYS Sync Card */}
        <div className="flex flex-col gap-4">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <RefreshCw size={18} className="text-blue-600" />
            مزامنة مبيعات نقاط البيع (COMSYS POS)
          </h2>
          <Card className="border-slate-200/60 shadow-2xs">
            <Card.Body className="p-5 flex flex-col gap-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                ربط مبيعات وتذاكر المغسلة مع نظام COMSYS POS ومزامنة حضور وانصراف موظفي المغسلة عبر أجهزة البصمة ZK.
              </p>

              <div className="flex flex-col gap-2 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-600">آخر عملية مزامنة:</span>
                  <span className="font-mono text-slate-800 font-bold">
                    {(lastSync?.lastSyncAt || lastSync?.syncedAt || lastSync?.synced_at) 
                      ? new Date(lastSync.lastSyncAt || lastSync.syncedAt || lastSync.synced_at).toLocaleString('ar-EG') 
                      : 'غير مسجل'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-600">حالة المزامنة:</span>
                  <Badge variant={(lastSync?.status === 'SUCCESS' || lastSync?.lastSyncAt || lastSync?.totalSynced !== undefined) ? 'success' : 'neutral'}>
                    {lastSync?.status || (lastSync?.lastSyncAt ? 'ناجحة' : 'جاهز')}
                  </Badge>
                </div>
                {(lastSync?.totalSynced !== undefined || lastSync?.ordersImported !== undefined || lastSync?.newTickets !== undefined) && (
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-600">عدد التذاكر المستوردة:</span>
                    <span className="font-bold text-blue-700">
                      {lastSync?.totalSynced ?? lastSync?.newTickets ?? lastSync?.ordersImported ?? 0} تذكرة
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-end mt-2">
                <Button
                  variant="primary"
                  onClick={handleSyncNow}
                  disabled={syncLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-xs px-5 py-2 flex items-center gap-2"
                >
                  <RefreshCw size={14} className={syncLoading ? 'animate-spin' : ''} />
                  {syncLoading ? 'جاري المزامنة...' : 'مزامنة مبيعات POS الآن'}
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

              {zkCheckins.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 font-medium">
                  لا توجد حركات بصمة مسجلة حالياً
                </div>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {zkCheckins.map((checkin, idx) => {
                    const userCode = checkin.userCode || checkin.employeeId || '---';
                    const employeeName = checkin.employeeName || `موظف ${userCode}`;
                    const checkTime = checkin.checkTime || checkin.created_at || '---';
                    const sensorId = checkin.sensorId || checkin.serialNumber || '1';

                    return (
                      <div key={checkin.checkinId || idx} className="flex justify-between items-center p-3.5 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-150 flex items-center justify-center font-bold text-[10px] text-slate-700">
                            {userCode}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800">{employeeName}</span>
                            <span className="text-[9px] text-slate-400 mt-1 font-semibold">بصمة إصبع (حساس/جهاز: {sensorId})</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">{checkTime}</span>
                      </div>
                    );
                  })}
                </div>
              )}

            </Card.Body>
          </Card>
        </div>

      </div>

    </div>
  );
}
