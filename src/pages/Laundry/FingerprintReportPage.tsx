import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Fingerprint, 
  Search, 
  RotateCw, 
  User, 
  ArrowUpRight, 
  Download, 
  Printer, 
  Clock, 
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Loader from '../../components/ui/Loader';
import EmptyState from '../../components/ui/EmptyState';
import { DateRangeFilterBar } from '../../components/common/DateRangeFilterBar';
import { laundryApi } from '../../api/laundry.api';

interface CheckinRecord {
  userId: number;
  userCode?: string;
  employeeId?: string;
  employeeName?: string;
  department?: string;
  checkTime?: string;
  sensorId?: string;
  serialNumber?: string;
  title?: string;
  verifyMode?: string;
}

interface CheckinStats {
  total: number;
  uniqueUsers: number;
  todayCount: number;
}

interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export const FingerprintReportPage: React.FC = () => {
  const navigate = useNavigate();
  const [checkins, setCheckins] = useState<CheckinRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search with debounce
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Date Filters
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  
  // Pagination & Accurate Database Stats
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [stats, setStats] = useState<CheckinStats>({
    total: 0,
    uniqueUsers: 0,
    todayCount: 0
  });
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false
  });

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchCheckins = useCallback(async () => {
    try {
      setLoading(true);
      const res = await laundryApi.getZkCheckins({ 
        page,
        pageSize,
        fromDate: fromDate || undefined, 
        toDate: toDate || undefined,
        search: searchQuery.trim() || undefined
      });

      if (res && res.items) {
        setCheckins(res.items);
        if (res.stats) {
          setStats(res.stats);
        }
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } else {
        const list = Array.isArray(res) ? res : (res?.data || []);
        setCheckins(list);
        setStats({
          total: list.length,
          uniqueUsers: new Set(list.map((c: any) => c.userId).filter(Boolean)).size,
          todayCount: list.filter((c: any) => {
            const todayStr = new Date().toISOString().split('T')[0];
            const cDateStr = c.checkTime ? new Date(c.checkTime).toISOString().split('T')[0] : '';
            return cDateStr === todayStr;
          }).length
        });
        setPagination({
          page: 1,
          pageSize: list.length || 50,
          total: list.length,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false
        });
      }
    } catch (err) {
      console.error('Error fetching fingerprint checkins:', err);
      setCheckins([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, fromDate, toDate, searchQuery]);

  useEffect(() => {
    fetchCheckins();
  }, [fetchCheckins]);

  const handleFromDateChange = (date: string) => {
    setFromDate(date);
    setPage(1);
  };

  const handleToDateChange = (date: string) => {
    setToDate(date);
    setPage(1);
  };

  const handleClearDates = () => {
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = parseInt(e.target.value, 10);
    setPageSize(newSize);
    setPage(1);
  };

  const exportCSV = () => {
    const headers = ['معرف الموظف الدائم', 'كود الموظف', 'اسم الموظف', 'وقت وتاريخ البصمة', 'رقم الحساس', 'الرقم التسلسلي'];
    const rows = checkins.map(c => [
      c.userId,
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
    link.setAttribute('download', `fingerprint_report_page_${page}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const startRecord = stats.total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, stats.total);

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
              تقرير سجل بصمات العاملين (توقيع البصمة)
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
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={checkins.length === 0}>
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

      {/* Date Range Filter Bar */}
      <DateRangeFilterBar
        fromDate={fromDate}
        toDate={toDate}
        onFromDateChange={handleFromDateChange}
        onToDateChange={handleToDateChange}
        onClear={handleClearDates}
        loading={loading}
        label="تصفية حركات بصمة التوقيع حسب الفترة"
      />

      {/* KPI Cards - 100% Accurate SQL Server Counts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200/80 shadow-2xs">
          <Card.Body className="p-5 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-slate-500 font-bold">إجمالي سجلات البصمة</span>
              <span className="text-2xl font-black text-slate-800 mt-1 font-mono">
                {stats.total.toLocaleString('ar-EG')}
              </span>
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
              <span className="text-2xl font-black text-emerald-600 mt-1 font-mono">
                {stats.todayCount.toLocaleString('ar-EG')}
              </span>
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
              <span className="text-2xl font-black text-purple-600 mt-1 font-mono">
                {stats.uniqueUsers.toLocaleString('ar-EG')}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">موظف مسجل له حركات بصمة</span>
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
          <div className="relative w-full md:w-96">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="بحث بالاسم أو كود الموظف أو القسم..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2 text-xs focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
            />
          </div>
        </Card.Body>
      </Card>

      {/* Main Table */}
      <Card className="border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50/70 border-b border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
            <Fingerprint size={16} className="text-blue-600" />
            <span>سجل البصمات المباشر</span>
            <span className="text-xs font-normal text-slate-400">
              (إجمالي {stats.total.toLocaleString('ar-EG')} حركة)
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>عدد السطور في الصفحة:</span>
            <select
              value={pageSize}
              onChange={handlePageSizeChange}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center items-center">
            <Loader size="md" label="جاري تحميل سجل البصمات من جهاز ZKTeco..." />
          </div>
        ) : checkins.length === 0 ? (
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
                  <th className="py-3 px-4">القسم</th>
                  <th className="py-3 px-4">تاريخ ووقت البصمة</th>
                  <th className="py-3 px-4">رقم الجهاز / الحساس</th>
                  <th className="py-3 px-4">الرقم التسلسلي (SN)</th>
                  <th className="py-3 px-4">طريقة التحقق</th>
                  <th className="py-3 px-4 text-center">إجراء العهدة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {checkins.map((item, idx) => {
                  const code = item.userCode || item.employeeId || '---';
                  const name = item.employeeName || 'غير معروف';
                  const formattedTime = item.checkTime ? new Date(item.checkTime).toLocaleString('ar-EG') : '---';
                  const rowNumber = (page - 1) * pageSize + idx + 1;

                  return (
                    <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-3 px-4 text-center text-slate-400 font-mono">{rowNumber}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200/80 font-mono font-bold text-slate-800 text-[11px]">
                          {code}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {name}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {item.department || '---'}
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
                          <Fingerprint size={12} className="ml-1" />
                          بصمة التوقيع
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/laundry/handover?userId=${item.userId}`)}
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

        {/* Server-Side Pagination Bar */}
        {!loading && stats.total > 0 && (
          <div className="p-4 bg-slate-50/70 border-t border-slate-200/80 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-xs text-slate-600 font-medium">
              عرض من <span className="font-bold text-slate-800 font-mono">{startRecord.toLocaleString('ar-EG')}</span> إلى{' '}
              <span className="font-bold text-slate-800 font-mono">{endRecord.toLocaleString('ar-EG')}</span> من إجمالي{' '}
              <span className="font-bold text-blue-600 font-mono">{stats.total.toLocaleString('ar-EG')}</span> حركة بصمة
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage(1)}
                disabled={page <= 1 || loading}
                title="الصفحة الأولى"
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronsRight size={16} />
              </button>

              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={!pagination.hasPrevPage || page <= 1 || loading}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={14} />
                <span>السابق</span>
              </button>

              <div className="px-3 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold">
                صفحة <span className="font-mono">{page}</span> من <span className="font-mono">{pagination.totalPages || 1}</span>
              </div>

              <button
                type="button"
                onClick={() => setPage(p => Math.min(pagination.totalPages || 1, p + 1))}
                disabled={!pagination.hasNextPage || page >= (pagination.totalPages || 1) || loading}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span>التالي</span>
                <ChevronLeft size={14} />
              </button>

              <button
                type="button"
                onClick={() => setPage(pagination.totalPages || 1)}
                disabled={page >= (pagination.totalPages || 1) || loading}
                title="الصفحة الأخيرة"
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronsLeft size={16} />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default FingerprintReportPage;
