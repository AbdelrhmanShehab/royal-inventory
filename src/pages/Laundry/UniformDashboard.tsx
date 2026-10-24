import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  RotateCw, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  Shirt, 
  Fingerprint, 
  History, 
  TrendingUp, 
  Activity 
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { laundryApi } from '../../api/laundry.api';

interface DashboardStats {
  totalHandovers: number;
  totalReceives: number;
  totalPending: number;
}

interface RecentTxn {
  txnId: number;
  userId: number;
  userCode: string;
  employeeName: string;
  itemCode: string;
  itemName: string;
  action: 'Handover' | 'Receive' | string;
  quantity: number;
  transactionDate: string;
}

interface ChartItem {
  date: string;
  action: 'Handover' | 'Receive' | string;
  quantity: number;
}

export const UniformDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalHandovers: 0,
    totalReceives: 0,
    totalPending: 0
  });
  const [recentTransactions, setRecentTransactions] = useState<RecentTxn[]>([]);
  const [chartData, setChartData] = useState<ChartItem[]>([]);
  const [liveCheckins, setLiveCheckins] = useState<any[]>([]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [dashRes, checkinsRes] = await Promise.all([
        laundryApi.getZkDashboard(),
        laundryApi.getZkCheckins(8)
      ]);

      const data = dashRes?.data || dashRes || {};
      if (data.stats) {
        setStats(data.stats);
      }
      if (Array.isArray(data.recentTransactions)) {
        setRecentTransactions(data.recentTransactions);
      }
      if (Array.isArray(data.chartData)) {
        setChartData(data.chartData);
      }

      const cList = Array.isArray(checkinsRes) ? checkinsRes : (checkinsRes?.data || []);
      setLiveCheckins(cList);
    } catch (err) {
      console.error('Failed to load ZK uniform dashboard details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    // Auto-refresh every 20 seconds to keep live feed active
    const timer = setInterval(loadDashboardData, 20000);
    return () => clearInterval(timer);
  }, []);

  // Process chart data: aggregate by day
  const daysMap: Record<string, { handover: number; receive: number }> = {};
  chartData.forEach(item => {
    if (!item.date) return;
    if (!daysMap[item.date]) {
      daysMap[item.date] = { handover: 0, receive: 0 };
    }
    if (item.action === 'Handover') {
      daysMap[item.date].handover += Number(item.quantity) || 0;
    } else if (item.action === 'Receive') {
      daysMap[item.date].receive += Number(item.quantity) || 0;
    }
  });

  const chartDays = Object.keys(daysMap).sort();
  const maxDayQty = Math.max(
    ...chartDays.map(d => Math.max(daysMap[d].handover, daysMap[d].receive)),
    10
  );

  return (
    <div className="flex flex-col gap-6 font-arabic dir-rtl select-none pb-12">
      {/* Top Banner / Navigation */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <Shirt size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl lg:text-2xl font-extrabold text-slate-800">
                لوحة تحكم عهد اليونيفورم والتشغيل
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 font-bold">
                UNIFORM HANDOVER SYSTEM
              </span>
            </div>
            <p className="text-xs lg:text-sm text-slate-500 mt-1 leading-relaxed">
              مراقبة فورية لعمليات تسليم واستلام يونيفورم العاملين وحركات بصمة الحضور وأرصدة العهد قيد الانتظار.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <Button variant="outline" size="sm" onClick={loadDashboardData} disabled={loading}>
            <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
            تحديث
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate('/laundry/fingerprint-report')}
          >
            <Fingerprint size={14} className="text-blue-600" />
            سجل البصمات
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate('/laundry/handover-report')}
          >
            <History size={14} className="text-blue-600" />
            سجل العمليات
          </Button>
          <Button 
            variant="primary" 
            size="sm" 
            onClick={() => navigate('/laundry/handover')}
            className="bg-blue-600 hover:bg-blue-700"
          >
            تسليم / استلام عهدة
          </Button>
        </div>
      </div>

      {/* Main KPI Cards (Matching screenshot 1 exactly) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Custody */}
        <Card className="border-amber-200/80 bg-gradient-to-br from-white to-amber-50/30 shadow-2xs">
          <Card.Body className="p-5 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-extrabold text-amber-700">عهد قيد الانتظار</span>
              <span className="text-3xl font-black text-amber-600 mt-1 font-mono">
                {stats.totalPending.toLocaleString('ar-EG')}
              </span>
              <span className="text-[10px] text-amber-600/80 mt-1 font-semibold">
                يونيفورم مستلم في ذمة الموظفين
              </span>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-inner">
              <Clock size={28} />
            </div>
          </Card.Body>
        </Card>

        {/* Total Received */}
        <Card className="border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/30 shadow-2xs">
          <Card.Body className="p-5 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-extrabold text-emerald-700">إجمالي الاستلام</span>
              <span className="text-3xl font-black text-emerald-600 mt-1 font-mono">
                {stats.totalReceives.toLocaleString('ar-EG')}
              </span>
              <span className="text-[10px] text-emerald-600/80 mt-1 font-semibold">
                تم استرجاعه واستلامه بالمغسلة
              </span>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-inner">
              <ArrowDownLeft size={28} />
            </div>
          </Card.Body>
        </Card>

        {/* Total Handover */}
        <Card className="border-blue-200/80 bg-gradient-to-br from-white to-blue-50/30 shadow-2xs">
          <Card.Body className="p-5 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-extrabold text-blue-700">إجمالي التسليمات</span>
              <span className="text-3xl font-black text-blue-600 mt-1 font-mono">
                {stats.totalHandovers.toLocaleString('ar-EG')}
              </span>
              <span className="text-[10px] text-blue-600/80 mt-1 font-semibold">
                تم تسليمه للموظفين من المغسلة
              </span>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-inner">
              <ArrowUpRight size={28} />
            </div>
          </Card.Body>
        </Card>

        {/* Active Fingerprints / Return Rate */}
        <Card className="border-purple-200/80 bg-gradient-to-br from-white to-purple-50/30 shadow-2xs">
          <Card.Body className="p-5 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-extrabold text-purple-700">نسبة الإرجاع والمطابقة</span>
              <span className="text-3xl font-black text-purple-600 mt-1 font-mono">
                {stats.totalHandovers > 0 
                  ? ((stats.totalReceives / stats.totalHandovers) * 100).toFixed(1) + '%' 
                  : '100%'}
              </span>
              <span className="text-[10px] text-purple-600/80 mt-1 font-semibold">
                معدل انضباط استرجاع العهد
              </span>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-inner">
              <TrendingUp size={28} />
            </div>
          </Card.Body>
        </Card>
      </div>

      {/* Main Grid: Recent Operations (Left) and 7-Day Chart (Right) - Matching screenshot layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Recent Transactions (أحدث العمليات) - Col span 5 */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
              <Activity size={18} className="text-blue-600" />
              أحدث العمليات
            </h2>
            <button
              onClick={() => navigate('/laundry/handover-report')}
              className="text-xs text-blue-600 hover:text-blue-700 font-bold"
            >
              عرض الكل ←
            </button>
          </div>

          <Card className="border-slate-200/80 shadow-xs flex-1">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100/80 text-slate-600 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">Item</th>
                    <th className="py-2.5 px-3 text-center">الكمية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {recentTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 font-medium">
                        لا توجد حركات مسجلة مؤخراً
                      </td>
                    </tr>
                  ) : (
                    recentTransactions.slice(0, 8).map((txn, idx) => {
                      const isHandover = txn.action === 'Handover';
                      return (
                        <tr key={txn.txnId || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3">
                            {isHandover ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                                Handover
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                Receive
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">
                            <div className="flex flex-col">
                              <span>{txn.employeeName || 'غير معروف'}</span>
                              <span className="text-[10px] font-mono text-slate-400 font-normal">
                                كود: {txn.userCode}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-700">
                            {txn.itemName}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold font-mono text-slate-800">
                            {txn.quantity || 1}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* 7-Days Transactions Chart (المعاملات في آخر 7 أيام) - Col span 7 */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
              <TrendingUp size={18} className="text-blue-600" />
              المعاملات في آخر 7 أيام
            </h2>
            <div className="flex items-center gap-4 text-xs font-bold">
              <span className="flex items-center gap-1.5 text-blue-600">
                <span className="w-3 h-3 rounded-sm bg-blue-600 inline-block"></span>
                تسليم (Handover)
              </span>
              <span className="flex items-center gap-1.5 text-emerald-600">
                <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block"></span>
                استلام (Receive)
              </span>
            </div>
          </div>

          <Card className="border-slate-200/80 shadow-xs flex-1 flex flex-col justify-between p-5 bg-gradient-to-b from-white to-slate-50/50">
            {chartDays.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                لا توجد بيانات حركة متوفرة لآخر 7 أيام
              </div>
            ) : (
              <div className="flex flex-col h-full justify-between">
                {/* Visual Bar Columns */}
                <div className="h-60 flex items-end justify-between gap-3 pt-4 px-2 border-b border-slate-200">
                  {chartDays.map((day) => {
                    const data = daysMap[day];
                    const handoverPct = Math.round((data.handover / maxDayQty) * 100);
                    const receivePct = Math.round((data.receive / maxDayQty) * 100);

                    return (
                      <div key={day} className="flex-1 flex flex-col items-center h-full justify-end group">
                        <div className="w-full flex justify-center items-end gap-1.5 h-full pb-1">
                          {/* Handover Bar (Blue) */}
                          <div
                            style={{ height: `${Math.max(handoverPct, 4)}%` }}
                            className="w-4 sm:w-5 bg-blue-600 rounded-t-sm hover:brightness-110 transition-all relative group-hover:shadow-sm"
                            title={`تسليم: ${data.handover}`}
                          >
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-mono font-bold bg-slate-800 text-white px-1.5 py-0.5 rounded pointer-events-none z-10">
                              {data.handover}
                            </span>
                          </div>

                          {/* Receive Bar (Green) */}
                          <div
                            style={{ height: `${Math.max(receivePct, 4)}%` }}
                            className="w-4 sm:w-5 bg-emerald-500 rounded-t-sm hover:brightness-110 transition-all relative group-hover:shadow-sm"
                            title={`استلام: ${data.receive}`}
                          >
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-mono font-bold bg-slate-800 text-white px-1.5 py-0.5 rounded pointer-events-none z-10">
                              {data.receive}
                            </span>
                          </div>
                        </div>

                        {/* Date Label */}
                        <span className="text-[10px] font-mono text-slate-500 font-bold mt-2 whitespace-nowrap">
                          {day.slice(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between items-center text-[11px] text-slate-400 pt-3">
                  <span>المحور الأفقي: الأيام الأخيرة</span>
                  <span>المحور الرأسي: عدد قطع اليونيفورم المتداولة</span>
                </div>
              </div>
            )}
          </Card>
        </div>

      </div>

      {/* Live Fingerprint Feed Strip */}
      <Card className="border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-extrabold text-sm text-slate-800">
              بث بصمات الحضور الحي (Live Fingerprint Monitor)
            </span>
            <span className="text-xs text-slate-400 font-normal">
              - مراقبة حضور موظفي الفندق والمغسلة
            </span>
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate('/laundry/fingerprint-report')}
            className="text-xs py-1 px-2.5"
          >
            عرض سجل الحضور الكامل
          </Button>
        </div>

        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {liveCheckins.length === 0 ? (
            <div className="col-span-4 text-center py-6 text-xs text-slate-400">
              بانتظار استقبال بصمات جديدة من أجهزة ZKTeco...
            </div>
          ) : (
            liveCheckins.slice(0, 4).map((c, idx) => {
              const code = c.userCode || c.employeeId || '---';
              const name = c.employeeName || `موظف ${code}`;
              const time = c.checkTime ? new Date(c.checkTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '---';

              return (
                <div 
                  key={idx} 
                  className="bg-white p-3.5 rounded-xl border border-slate-200/80 flex items-center justify-between hover:border-blue-300 transition-colors shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs font-mono">
                      {code}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800 line-clamp-1">{name}</span>
                      <span className="text-[10px] text-slate-400 font-mono mt-0.5">{time}</span>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1 whitespace-nowrap">
                    <Fingerprint size={12} className="text-emerald-600" />
                    بصمة حضور
                  </span>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
};

export default UniformDashboard;
