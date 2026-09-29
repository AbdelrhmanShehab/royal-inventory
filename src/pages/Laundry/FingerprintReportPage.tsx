import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Fingerprint, 
  Search, 
  RotateCw, 
  Calendar, 
  User, 
  ArrowUpRight, 
  Download, 
  Printer, 
  CheckCircle2,
  Clock,
  Layers
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Loader from '../../components/ui/Loader';
import EmptyState from '../../components/ui/EmptyState';
import { laundryApi } from '../../api/laundry.api';

interface CheckinRecord {
  userCode?: string;
  employeeId?: string;
  employeeName?: string;
  checkTime?: string;
  sensorId?: string;
  serialNumber?: string;
  title?: string;
  verifyMode?: string;
}

export const FingerprintReportPage: React.FC = () => {
  const navigate = useNavigate();
  const [checkins, setCheckins] = useState<CheckinRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'today' | 'week'>('all');

  const fetchCheckins = async () => {
    try {
      setLoading(true);
      const res = await laundryApi.getZkCheckins(100);
      const list = Array.isArray(res) ? res : (res?.data || []);
      setCheckins(list);
    } catch (err) {
      console.error('Error fetching fingerprint checkins:', err);
      setCheckins([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCheckins();
  }, []);

  // Filter checkins
  const filteredCheckins = checkins.filter((item) => {
    const code = (item.userCode || item.employeeId || '').toLowerCase();
    const name = (item.employeeName || '').toLowerCase();
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || code.includes(q) || name.includes(q);

    if (!matchesSearch) return false;

    if (filterPeriod === 'today') {
      const todayStr = new Date().toISOString().split('T')[0];
      const itemDateStr = item.checkTime ? new Date(item.checkTime).toISOString().split('T')[0] : '';
      return itemDateStr === todayStr;
    }

    if (filterPeriod === 'week') {
      const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
      const itemTime = item.checkTime ? new Date(item.checkTime).getTime() : 0;
      return itemTime >= weekAgo;
    }

    return true;
  });

  // Calculate high level metrics
  const totalCount = checkins.length;
  const uniqueUsers = new Set(checkins.map(c => c.userCode || c.employeeId).filter(Boolean)).size;
  const todayCount = checkins.filter(c => {
    const todayStr = new Date().toISOString().split('T')[0];
    const cDateStr = c.checkTime ? new Date(c.checkTime).toISOString().split('T')[0] : '';
    return cDateStr === todayStr;
  }).length;

  const exportCSV = () => {
    const headers = ['كود الموظف', 'اسم الموظف', 'وقت وتاريخ البصمة', 'رقم الحساس', 'الرقم التسلسلي'];
    const rows = filteredCheckins.map(c => [
      c.userCode || c.employeeId || '---',
      c.employeeName || 'غير معروف',
      c.checkTime ? new Date(c.checkTime).toLocaleString('ar-EG') : '---',
      c.sensorId || '104',
      c.serialNumber || '---'
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `fingerprint_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-6 font-arabic dir-rtl select-none pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <Fingerprint size={26} />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-extrabold text-slate-800 flex items-center gap-2">
              تقرير سجل بصمات العاملين (حضور البصمة)
            </h1>
            <p className="text-xs lg:text-sm text-slate-500 mt-1 leading-relaxed">
              سجل تفصيلي لحركات البصمة المسجلة عبر أجهزة ZKTeco للمغسلة مع إمكانية الوصول السريع لعهدة كل موظف.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button variant="outline" size="sm" onClick={fetchCheckins} disabled={loading}>
            <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
            تحديث السجل
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={filteredCheckins.length === 0}>
            <Download size={14} />
            تصدير CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer size={14} />
            طباعة
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200/80 shadow-2xs">
          <Card.Body className="p-5 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-slate-500 font-bold">إجمالي سجلات البصمة</span>
              <span className="text-2xl font-black text-slate-800 mt-1 font-mono">{totalCount}</span>
              <span className="text-[10px] text-slate-400 mt-0.5">مسجلة بقاعدة بيانات ZKTeco</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers size={22} />
            </div>
          </Card.Body>
        </Card>

        <Card className="border-slate-200/80 shadow-2xs">
          <Card.Body className="p-5 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-slate-500 font-bold">بصمات اليوم</span>
              <span className="text-2xl font-black text-emerald-600 mt-1 font-mono">{todayCount}</span>
              <span className="text-[10px] text-emerald-600/80 mt-0.5 font-semibold">حركات مسجلة خلال اليوم</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Clock size={22} />
            </div>
          </Card.Body>
        </Card>

        <Card className="border-slate-200/80 shadow-2xs">
          <Card.Body className="p-5 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-slate-500 font-bold">الموظفون الفريدون</span>
              <span className="text-2xl font-black text-purple-600 mt-1 font-mono">{uniqueUsers}</span>
              <span className="text-[10px] text-slate-400 mt-0.5">موظف قام بالبصمة</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <User size={22} />
            </div>
          </Card.Body>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="border-slate-200/80 shadow-2xs">
        <Card.Body className="p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم أو كود الموظف..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2 text-xs focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-xs text-slate-500 font-bold flex items-center gap-1.5 ml-2">
              <Calendar size={14} />
              الفترة:
            </span>
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1 text-xs">
              <button
                type="button"
                onClick={() => setFilterPeriod('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  filterPeriod === 'all' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setFilterPeriod('today')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  filterPeriod === 'today' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                اليوم
              </button>
              <button
                type="button"
                onClick={() => setFilterPeriod('week')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  filterPeriod === 'week' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                آخر 7 أيام
              </button>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Main Table */}
      <Card className="border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50/70 border-b border-slate-200/80 flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
            <Fingerprint size={16} className="text-blue-600" />
            <span>سجل البصمات المباشر</span>
            <span className="text-xs font-normal text-slate-400">({filteredCheckins.length} حركة)</span>
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center items-center">
            <Loader size="md" label="جاري تحميل سجل البصمات من جهاز ZKTeco..." />
          </div>
        ) : filteredCheckins.length === 0 ? (
          <EmptyState
            title="لا توجد سجلات بصمة مطابقة"
            description="لم يتم العثور على أي حركات بصمة وفقاً لمعايير البحث الحالية."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100/70 text-slate-600 border-b border-slate-200 font-bold">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">كود الموظف</th>
                  <th className="py-3 px-4">اسم الموظف</th>
                  <th className="py-3 px-4">تاريخ ووقت البصمة</th>
                  <th className="py-3 px-4">رقم الجهاز / الحساس</th>
                  <th className="py-3 px-4">الرقم التسلسلي (SN)</th>
                  <th className="py-3 px-4">طريقة التحقق</th>
                  <th className="py-3 px-4 text-center">إجراء العهدة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredCheckins.map((item, idx) => {
                  const code = item.userCode || item.employeeId || '---';
                  const name = item.employeeName || 'غير معروف';
                  const formattedTime = item.checkTime ? new Date(item.checkTime).toLocaleString('ar-EG') : '---';

                  return (
                    <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-3 px-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200/80 font-mono font-bold text-slate-800 text-[11px]">
                          {code}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {name}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 text-[11px]" dir="ltr">
                        {formattedTime}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {item.sensorId || '104'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 text-[10px]">
                        {item.serialNumber || 'ZK-LND-01'}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="success">
                          <CheckCircle2 size={11} className="ml-1" />
                          بصمة إصبع
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/laundry/handover?userCode=${code}`)}
                          className="text-blue-600 hover:bg-blue-50 border border-blue-200 text-xs py-1 px-2"
                        >
                          <ArrowUpRight size={13} className="ml-1" />
                          تسليم / استلام
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default FingerprintReportPage;
