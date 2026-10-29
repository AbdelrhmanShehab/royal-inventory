import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  History, 
  Search, 
  RotateCw, 
  Download, 
  Printer, 
  ArrowDownLeft,
  ArrowUpRight as ArrowUpRightIcon,
  Shirt,
  Layers,
  Fingerprint,
  Clock,
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

interface HandoverTransaction {
  txnId: number;
  userId: number;
  userCode: string;
  employeeName: string;
  itemCode: string;
  itemName: string;
  action: 'Handover' | 'Receive' | string;
  quantity: number;
  transactionDate: string;
  handledBy?: string;
  notes?: string;
}

interface ReportStats {
  total: number;
  totalHandover: number;
  totalReceive: number;
  totalPending: number;
}

interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export const HandoverReportPage: React.FC = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<HandoverTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search with debounce
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filters
  const [actionFilter, setActionFilter] = useState<'all' | 'Handover' | 'Receive'>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  
  // Pagination & Database Stats
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [stats, setStats] = useState<ReportStats>({
    total: 0,
    totalHandover: 0,
    totalReceive: 0,
    totalPending: 0
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

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await laundryApi.getZkTransactions({ 
        page,
        pageSize,
        action: actionFilter,
        search: searchQuery.trim() || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined 
      });

      if (res && res.items) {
        setTransactions(res.items);
        if (res.stats) {
          setStats(res.stats);
        }
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } else {
        const list = Array.isArray(res) ? res : (res?.data || []);
        setTransactions(list);
        const handover = list.filter((t: any) => t.action === 'Handover').length;
        const receive = list.filter((t: any) => t.action === 'Receive').length;
        setStats({
          total: list.length,
          totalHandover: handover,
          totalReceive: receive,
          totalPending: Math.max(0, handover - receive)
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
      console.error('Error fetching handover transactions:', err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, actionFilter, searchQuery, fromDate, toDate]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleActionChange = (action: 'all' | 'Handover' | 'Receive') => {
    setActionFilter(action);
    setPage(1);
  };

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
    const headers = ['رقم الحركة', 'معرف الموظف الدائم', 'كود الموظف', 'اسم الموظف', 'كود الصنف', 'اسم الصنف', 'نوع الحركة', 'الكمية', 'التاريخ والوقت', 'المسؤول', 'ملاحظات'];
    const rows = transactions.map(t => [
      t.txnId,
      t.userId,
      t.userCode || '---',
      t.employeeName || '---',
      t.itemCode || '---',
      t.itemName || '---',
      t.action === 'Handover' ? 'تسليم' : 'استلام',
      t.quantity || 1,
      t.transactionDate ? new Date(t.transactionDate).toLocaleString('ar-EG') : '---',
      t.handledBy || '---',
      t.notes || '---'
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `handover_report_page_${page}_${new Date().toISOString().split('T')[0]}.csv`);
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
            <History size={26} />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-extrabold text-slate-800 flex items-center gap-2">
              تقرير حركات تسليم واستلام اليونيفورم (سجل العمليات)
            </h1>
            <p className="text-xs lg:text-sm text-slate-500 mt-1 leading-relaxed">
              سجل تدقيق كامل لكافة عمليات تسليم واستلام يونيفورم ومهمات العاملين بالمغسلة المركزية.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button variant="outline" size="sm" onClick={fetchTransactions} disabled={loading}>
            <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
            تحديث
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={transactions.length === 0}>
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
            تسليم / استلام جديد
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
        label="تصفية حركات تسليم واستلام العهد حسب الفترة"
      />

      {/* Metric Cards - 100% Accurate SQL Server Counts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Custody */}
        <Card className="border-amber-200/80 bg-gradient-to-br from-white to-amber-50/30 shadow-2xs">
          <Card.Body className="p-5 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-extrabold text-amber-700">صافي قيد الانتظار</span>
              <span className="text-2xl font-black text-amber-600 mt-1 font-mono">
                {stats.totalPending.toLocaleString('ar-EG')}
              </span>
              <span className="text-[10px] text-amber-600/80 mt-0.5 font-semibold">
                يونيفورم معلق بذمة الموظفين (فارق التسليم والاستلام)
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Clock size={22} />
            </div>
          </Card.Body>
        </Card>

        {/* Total Transactions */}
        <Card className="border-slate-200/80 shadow-2xs">
          <Card.Body className="p-5 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-slate-500 font-bold">إجمالي الحركات</span>
              <span className="text-2xl font-black text-slate-800 mt-1 font-mono">
                {stats.total.toLocaleString('ar-EG')}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">إجمالي عمليات التسليم والاستلام بقاعدة البيانات</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Layers size={22} />
            </div>
          </Card.Body>
        </Card>

        {/* Total Handover */}
        <Card className="border-blue-200/80 bg-gradient-to-br from-white to-blue-50/30 shadow-2xs">
          <Card.Body className="p-5 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-blue-600 font-bold">إجمالي التسليمات (Handover)</span>
              <span className="text-2xl font-black text-blue-600 mt-1 font-mono">
                {stats.totalHandover.toLocaleString('ar-EG')}
              </span>
              <span className="text-[10px] text-blue-600/70 mt-0.5 font-semibold">تسليم يونيفورم نظيف للموظف</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ArrowUpRightIcon size={22} />
            </div>
          </Card.Body>
        </Card>

        {/* Total Receive */}
        <Card className="border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/30 shadow-2xs">
          <Card.Body className="p-5 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-emerald-600 font-bold">إجمالي الاستلامات (Receive)</span>
              <span className="text-2xl font-black text-emerald-600 mt-1 font-mono">
                {stats.totalReceive.toLocaleString('ar-EG')}
              </span>
              <span className="text-[10px] text-emerald-600/70 mt-0.5 font-semibold">استلام غسيل متسخ من الموظف</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowDownLeft size={22} />
            </div>
          </Card.Body>
        </Card>
      </div>

      {/* Filters Toolbar */}
      <Card className="border-slate-200/80 shadow-2xs">
        <Card.Body className="p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="بحث بالموظف، أو كود الصنف، أو اسم القطعة..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2 text-xs focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-xs text-slate-500 font-bold ml-2">نوع العملية:</span>
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1 text-xs">
              <button
                type="button"
                onClick={() => handleActionChange('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  actionFilter === 'all' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => handleActionChange('Handover')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  actionFilter === 'Handover' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                تسليم فقط
              </button>
              <button
                type="button"
                onClick={() => handleActionChange('Receive')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  actionFilter === 'Receive' ? 'bg-white text-emerald-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                استلام فقط
              </button>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Transactions Table */}
      <Card className="border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50/80 border-b border-slate-200/80 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-2.5 font-bold text-sm text-slate-800">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shadow-2xs">
              <Shirt size={16} />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-800">سجل المعاملات المكتملة</span>
              <span className="text-xs font-normal text-slate-500">
                (إجمالي <span className="font-mono font-bold text-blue-600">{stats.total.toLocaleString('ar-EG')}</span> معاملة)
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-medium">عرض بالصفحة:</span>
            <select
              value={pageSize}
              onChange={handlePageSizeChange}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 shadow-2xs focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value={25}>25 حركة</option>
              <option value={50}>50 حركة</option>
              <option value={100}>100 حركة</option>
              <option value={200}>200 حركة</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center items-center">
            <Loader size="md" label="جاري استخراج سجل المعاملات..." />
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState
            title="لا توجد معاملات مسجلة"
            description="لم يتم العثور على أي حركات تسليم أو استلام تطابق معايير البحث."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100/80 text-slate-700 border-b border-slate-200 text-xs font-bold">
                <tr>
                  <th className="py-3.5 px-3 w-12 text-center whitespace-nowrap">#</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">رقم الحركة</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">نوع العملية</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">كود الموظف</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">اسم الموظف</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">اسم الصنف / القطعة</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">كود الصنف</th>
                  <th className="py-3.5 px-3 text-center whitespace-nowrap">الكمية</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">التاريخ والوقت</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">المسؤول</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">ملاحظات</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">التوثيق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {transactions.map((t, idx) => {
                  const isHandover = t.action === 'Handover';
                  const formattedTime = t.transactionDate ? new Date(t.transactionDate).toLocaleString('ar-EG') : '---';
                  const rowNumber = (page - 1) * pageSize + idx + 1;

                  const formattedNotes = () => {
                    const n = t.notes || '';
                    if (!n) return <span className="text-slate-400">---</span>;
                    if (n.includes('biometric verification') || n.includes('single item confirmed')) {
                      return (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200">
                          {isHandover ? 'تسليم معتمد بالبصمة' : 'استلام معتمد بالبصمة'}
                        </span>
                      );
                    }
                    return <span className="text-slate-600 text-[11px] max-w-[180px] truncate inline-block" title={n}>{n}</span>;
                  };

                  return (
                    <tr key={t.txnId || idx} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">{rowNumber}</td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-700 whitespace-nowrap">
                        #{t.txnId}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {isHandover ? (
                          <Badge variant="info">
                            <ArrowUpRightIcon size={11} className="ml-1" />
                            تسليم (Handover)
                          </Badge>
                        ) : (
                          <Badge variant="success">
                            <ArrowDownLeft size={11} className="ml-1" />
                            استلام (Receive)
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-mono font-bold text-slate-800 text-[11px]">
                          {t.userCode || '---'} · ID: {t.userId}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800 whitespace-nowrap">
                        {t.employeeName || 'غير معروف'}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-700 whitespace-nowrap">
                        {t.itemName || '---'}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                        {t.itemCode || '---'}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-800 font-mono">
                        {t.quantity || 1}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 text-[11px] whitespace-nowrap" dir="ltr">
                        {formattedTime}
                      </td>
                      <td className="py-3 px-3 text-slate-600 text-[11px] whitespace-nowrap">
                        {t.handledBy === 'System' ? 'النظام (آلي)' : (t.handledBy || 'أمين العهدة')}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {formattedNotes()}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                          <Fingerprint size={13} className="text-emerald-600 shrink-0" />
                          <span>بصمة التوقيع</span>
                        </span>
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
              <span className="font-bold text-blue-600 font-mono">{stats.total.toLocaleString('ar-EG')}</span> معاملة
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

export default HandoverReportPage;
