import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shirt,
  Search,
  RotateCw,
  Printer,
  Download,
  Clock,
  AlertTriangle,
  Users,
  Building2,
  Calendar,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Layers,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import EmptyState from '../../components/ui/EmptyState';
import { laundryApi } from '../../api/laundry.api';

interface InLaundryItem {
  userItemId: number;
  itemCode: string;
  itemName: string;
  userId: number;
  userCode: string;
  employeeName: string;
  jobTitle: string;
  department: string;
  txnId: number;
  lastAction: string;
  receivedDate: string;
  handledBy: string;
  notes?: string;
  hoursInLaundry: number;
  daysInLaundry: number;
}

interface BreakdownStat {
  name: string;
  count: number;
  percentage: number;
}

interface InventoryResponse {
  summary: {
    totalItems: number;
    totalEmployees: number;
    receivedToday: number;
    delayedOver24h: number;
    delayedOver48h: number;
  };
  byItem: BreakdownStat[];
  byDepartment: BreakdownStat[];
  items: InLaundryItem[];
}

export const InLaundryReportPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<InventoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedItemName, setSelectedItemName] = useState<string>('all');
  const [delayFilter, setDelayFilter] = useState<'all' | 'today' | 'over24h' | 'over48h'>('all');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await laundryApi.getInLaundryInventory();
      const payload = res?.data || res;
      setData(payload);
    } catch (err) {
      console.error('Error fetching in-laundry inventory:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  // Filtered Items
  const filteredItems = useMemo(() => {
    if (!data?.items) return [];

    return data.items.filter((item) => {
      // Text Search
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || (
        (item.userCode || '').toLowerCase().includes(q) ||
        (item.employeeName || '').toLowerCase().includes(q) ||
        (item.itemCode || '').toLowerCase().includes(q) ||
        (item.itemName || '').toLowerCase().includes(q) ||
        (item.department || '').toLowerCase().includes(q) ||
        (item.jobTitle || '').toLowerCase().includes(q)
      );

      // Dept Filter
      const matchDept = selectedDept === 'all' || item.department === selectedDept;

      // Item Name Filter
      const matchItem = selectedItemName === 'all' || item.itemName === selectedItemName;

      // Delay Filter
      let matchDelay = true;
      if (delayFilter === 'today') {
        const todayStr = new Date().toISOString().split('T')[0];
        const rDateStr = item.receivedDate ? new Date(item.receivedDate).toISOString().split('T')[0] : '';
        matchDelay = rDateStr === todayStr;
      } else if (delayFilter === 'over24h') {
        matchDelay = item.hoursInLaundry >= 24;
      } else if (delayFilter === 'over48h') {
        matchDelay = item.hoursInLaundry >= 48;
      }

      return matchSearch && matchDept && matchItem && matchDelay;
    });
  }, [data, searchQuery, selectedDept, selectedItemName, delayFilter]);

  // Paginated Items
  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDept, selectedItemName, delayFilter, pageSize]);

  // Export CSV
  const handleExportCSV = () => {
    if (!filteredItems.length) return;
    const headers = [
      'معرف الموظف الدائم',
      'كود الموظف',
      'اسم الموظف',
      'الوظيفة',
      'القسم',
      'اسم الصنف',
      'كود الصنف',
      'تاريخ الاستلام',
      'الوقت في المغسلة (ساعات)',
      'المسؤول',
      'ملاحظات'
    ];

    const rows = filteredItems.map(item => [
      item.userId,
      item.userCode || '',
      `"${item.employeeName || ''}"`,
      `"${item.jobTitle || ''}"`,
      `"${item.department || ''}"`,
      `"${item.itemName || ''}"`,
      item.itemCode || '',
      item.receivedDate ? new Date(item.receivedDate).toLocaleString('ar-EG') : '',
      item.hoursInLaundry,
      `"${item.handledBy || ''}"`,
      `"${item.notes || ''}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `تقرير_موجودات_المغسلة_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const formatElapsedTime = (hours: number) => {
    if (hours < 1) return 'أقل من ساعة';
    if (hours < 24) return `${hours} ساعة`;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return remHours > 0 ? `${days} يوم و ${remHours} س` : `${days} يوم`;
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in text-right" dir="rtl">
      {/* ─── PRINT-ONLY HEADER ──────────────────────────────────────────────── */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-slate-900">منتجع رويال بيتش - التقرير الشامل لموجودات المغسلة</h1>
            <p className="text-sm text-slate-600 mt-1">
              حصر دقيق لجميع عهد اليونيفورم المتواجدة قيد الغسيل والتجهيز | وقت الطباعة: {new Date().toLocaleString('ar-EG')}
            </p>
          </div>
          <div className="text-left font-mono text-sm">
            <span className="font-bold">إجمالي القطع: {filteredItems.length}</span>
          </div>
        </div>
      </div>

      {/* ─── TOP BAR (Screen only) ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Shirt className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  موجودات المغسلة الحالية
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  جرد لحظي مباشر
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                حصر شامل لكل قطع اليونيفورم والعهد المستلمة داخل المغسلة حالياً ولم تُسلّم بعد للموظفين
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <Button
            variant="outline"
            onClick={fetchReport}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-bold border-slate-200 hover:bg-slate-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            تحديث
          </Button>

          <Button
            variant="outline"
            onClick={handleExportCSV}
            disabled={!filteredItems.length}
            className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 border-emerald-200 hover:bg-emerald-50"
          >
            <Download className="w-3.5 h-3.5" />
            تصدير Excel (CSV)
          </Button>

          <Button
            variant="outline"
            onClick={handlePrint}
            disabled={!filteredItems.length}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-700 border-slate-300 hover:bg-slate-100 shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            طباعة تقرير
          </Button>

          <Button
            onClick={() => navigate('/laundry/handover')}
            className="flex items-center gap-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
          >
            تسليم / استلام العهد
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {loading && !data ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <Loader size="lg" />
          <p className="text-sm font-bold text-slate-500">جاري مسح وجرد محتويات المغسلة الحالية من قاعدة البيانات...</p>
        </div>
      ) : !data ? (
        <EmptyState
          title="تعذر تحميل تقرير المغسلة"
          description="تأكد من الاتصال بقاعدة بيانات البصمة ثم أعد المحاولة"
          icon={AlertTriangle}
          action={<Button onClick={fetchReport}>إعادة المحاولة</Button>}
        />
      ) : (
        <>
          {/* ─── SUMMARY KPI CARDS ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4">
            {/* Total In Laundry */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-5 text-white shadow-xl shadow-blue-500/15 relative overflow-hidden">
              <div className="absolute top-0 left-0 -ml-4 -mt-4 w-24 h-24 rounded-full bg-white/10 blur-xl pointer-events-none" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-100">إجمالي القطع بالمغسلة</span>
                <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
                  <Shirt className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl md:text-4xl font-black tracking-tight">{data.summary.totalItems}</span>
                <span className="text-xs font-bold text-blue-200">قطعة يونيفورم</span>
              </div>
              <div className="mt-2 text-[11px] text-blue-100 flex items-center gap-1">
                <span>تنتظر الغسيل والتسليم</span>
              </div>
            </div>

            {/* Total Employees */}
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">الموظفين أصحاب العهد</span>
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">{data.summary.totalEmployees}</span>
                <span className="text-xs font-bold text-slate-400">موظف</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
                <span>لهم عهد داخل المغسلة حالياً</span>
              </div>
            </div>

            {/* Received Today */}
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">تم استلامها اليوم</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl md:text-4xl font-black text-emerald-600 tracking-tight">{data.summary.receivedToday}</span>
                <span className="text-xs font-bold text-slate-400">قطعة</span>
              </div>
              <div className="mt-2 text-[11px] text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>حركات استلام اليوم الجديد</span>
              </div>
            </div>

            {/* Delayed Warning */}
            <div className={`rounded-3xl p-5 border shadow-sm transition-all ${
              data.summary.delayedOver24h > 0 
                ? 'bg-amber-50/70 border-amber-200' 
                : 'bg-white border-slate-100'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900">تنبيه المتأخرات</span>
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl md:text-4xl font-black text-amber-700 tracking-tight">{data.summary.delayedOver24h}</span>
                <span className="text-xs font-bold text-amber-800">أكثر من 24 س</span>
              </div>
              <div className="mt-2 text-[11px] text-amber-800 flex items-center gap-1 font-semibold">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                <span>منها {data.summary.delayedOver48h} قطعة تجاوزت 48 ساعة!</span>
              </div>
            </div>
          </div>

          {/* ─── VISUAL BREAKDOWN CARDS ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:grid-cols-2">
            {/* By Item Type */}
            <Card className="p-5 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Layers className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm font-black text-slate-900">توزيع القطع حسب الصنف بالمغسلة</h2>
                </div>
                <span className="text-xs font-bold text-slate-400 font-mono">{data.byItem.length} أصناف</span>
              </div>

              <div className="space-y-3">
                {data.byItem.map((item) => {
                  const isSelected = selectedItemName === item.name;
                  return (
                    <div 
                      key={item.name}
                      onClick={() => setSelectedItemName(isSelected ? 'all' : item.name)}
                      className={`p-2.5 rounded-xl transition-all cursor-pointer border ${
                        isSelected 
                          ? 'bg-blue-50/80 border-blue-300 shadow-xs' 
                          : 'hover:bg-slate-50 border-transparent hover:border-slate-200'
                      }`}
                    >
                      <div className="flex justify-between items-center text-xs font-bold mb-1.5">
                        <span className="text-slate-800 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-600" />
                          {item.name}
                        </span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="font-black text-slate-900">{item.count} قطعة</span>
                          <span className="text-[10px] text-slate-400">({item.percentage}%)</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-gradient-to-l from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(3, item.percentage))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* By Department */}
            <Card className="p-5 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm font-black text-slate-900">توزيع القطع حسب الأقسام الأكثر إيداعاً</h2>
                </div>
                <span className="text-xs font-bold text-slate-400 font-mono">{data.byDepartment.length} أقسام</span>
              </div>

              <div className="space-y-3">
                {data.byDepartment.map((dept) => {
                  const isSelected = selectedDept === dept.name;
                  return (
                    <div 
                      key={dept.name}
                      onClick={() => setSelectedDept(isSelected ? 'all' : dept.name)}
                      className={`p-2.5 rounded-xl transition-all cursor-pointer border ${
                        isSelected 
                          ? 'bg-purple-50/80 border-purple-300 shadow-xs' 
                          : 'hover:bg-slate-50 border-transparent hover:border-slate-200'
                      }`}
                    >
                      <div className="flex justify-between items-center text-xs font-bold mb-1.5">
                        <span className="text-slate-800 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-purple-600" />
                          {dept.name}
                        </span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="font-black text-slate-900">{dept.count} قطعة</span>
                          <span className="text-[10px] text-slate-400">({dept.percentage}%)</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-gradient-to-l from-purple-500 to-indigo-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(3, dept.percentage))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* ─── FILTERS & SEARCH CONTROLS ─────────────────────────────────── */}
          <Card className="p-4 rounded-3xl border border-slate-100 shadow-sm print:hidden">
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
              {/* Search Bar */}
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="ابحث بكود الموظف، الاسم، كود الصنف..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Dropdowns */}
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                {/* Department Dropdown */}
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="all">كل الأقسام ({data.summary.totalItems})</option>
                  {data.byDepartment.map((d) => (
                    <option key={d.name} value={d.name}>
                      {d.name} ({d.count})
                    </option>
                  ))}
                </select>

                {/* Item Name Dropdown */}
                <select
                  value={selectedItemName}
                  onChange={(e) => setSelectedItemName(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="all">كل الأصناف ({data.summary.totalItems})</option>
                  {data.byItem.map((i) => (
                    <option key={i.name} value={i.name}>
                      {i.name} ({i.count})
                    </option>
                  ))}
                </select>

                {/* Delay Filter Tabs */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setDelayFilter('all')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      delayFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    الكل
                  </button>
                  <button
                    type="button"
                    onClick={() => setDelayFilter('today')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      delayFilter === 'today'
                        ? 'bg-white text-emerald-700 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    اليوم ({data.summary.receivedToday})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDelayFilter('over24h')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      delayFilter === 'over24h'
                        ? 'bg-white text-amber-700 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    &gt; 24س ({data.summary.delayedOver24h})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDelayFilter('over48h')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      delayFilter === 'over48h'
                        ? 'bg-white text-red-700 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    &gt; 48س ({data.summary.delayedOver48h})
                  </button>
                </div>

                {/* Reset Filters */}
                {(searchQuery || selectedDept !== 'all' || selectedItemName !== 'all' || delayFilter !== 'all') && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedDept('all');
                      setSelectedItemName('all');
                      setDelayFilter('all');
                    }}
                    className="text-xs text-red-600 hover:bg-red-50"
                  >
                    إلغاء التصفية
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* ─── TABLE RESULTS ─────────────────────────────────────────────── */}
          <Card className="rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-800">
                  قائمة القطع المتواجدة بالمغسلة
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-800 font-mono">
                  {filteredItems.length} قطعة
                </span>
              </div>

              {/* Page Size Selector */}
              <div className="flex items-center gap-2 print:hidden">
                <span className="text-xs font-medium text-slate-400">عرض بالصفحة:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-2 py-1 rounded-lg border border-slate-200 text-xs font-bold bg-white text-slate-700"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={500}>الكل (500)</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-100/75 text-slate-600 font-black border-b border-slate-200">
                    <th className="py-3.5 px-4 w-12 text-center">#</th>
                    <th className="py-3.5 px-4 w-28 text-center">كود الموظف</th>
                    <th className="py-3.5 px-4">اسم الموظف والوظيفة</th>
                    <th className="py-3.5 px-4">القسم</th>
                    <th className="py-3.5 px-4">الصنف</th>
                    <th className="py-3.5 px-4 font-mono">كود القطعة</th>
                    <th className="py-3.5 px-4">تاريخ ووقت الاستلام</th>
                    <th className="py-3.5 px-4 text-center">المدة بالمغسلة</th>
                    <th className="py-3.5 px-4 print:hidden text-center w-28">إجراء سريع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400 font-bold">
                        لا توجد قطع مطابقة لشروط البحث والفلترة المحددة
                      </td>
                    </tr>
                  ) : (
                    paginatedItems.map((item, idx) => {
                      const isDelayed48 = item.hoursInLaundry >= 48;
                      const isDelayed24 = item.hoursInLaundry >= 24;

                      return (
                        <tr 
                          key={item.userItemId} 
                          className="hover:bg-blue-50/40 transition-colors group"
                        >
                          {/* Index */}
                          <td className="py-3.5 px-4 text-center font-mono text-slate-400">
                            {(currentPage - 1) * pageSize + idx + 1}
                          </td>

                          {/* Badge / User Code */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => navigate(`/laundry/handover?userId=${item.userId}`)}
                              title="انتقال لصفحة التسليم لهذا الموظف"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 font-black font-mono hover:bg-blue-600 hover:text-white transition-colors border border-blue-200"
                            >
                              <span>{item.userCode} · ID: {item.userId}</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                            </button>
                          </td>

                          {/* Employee Name & Title */}
                          <td className="py-3.5 px-4">
                            <div className="font-black text-slate-900 text-sm">{item.employeeName}</div>
                            <div className="text-[11px] text-slate-400 font-medium">{item.jobTitle || 'موظف'}</div>
                          </td>

                          {/* Department */}
                          <td className="py-3.5 px-4">
                            <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700">
                              {item.department || 'غير محدد'}
                            </span>
                          </td>

                          {/* Item Name */}
                          <td className="py-3.5 px-4">
                            <span className="font-black text-slate-800 text-sm flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              {item.itemName}
                            </span>
                          </td>

                          {/* Item Code */}
                          <td className="py-3.5 px-4 font-mono font-black text-slate-600 text-xs">
                            {item.itemCode}
                          </td>

                          {/* Received Date */}
                          <td className="py-3.5 px-4 font-medium text-slate-600">
                            <div>{item.receivedDate ? new Date(item.receivedDate).toLocaleDateString('ar-EG') : '---'}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {item.receivedDate ? new Date(item.receivedDate).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </div>
                          </td>

                          {/* Time in laundry */}
                          <td className="py-3.5 px-4 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ${
                              isDelayed48 
                                ? 'bg-red-100 text-red-900 border border-red-200' 
                                : isDelayed24 
                                ? 'bg-amber-100 text-amber-900 border border-amber-200' 
                                : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                            }`}>
                              <Clock className="w-3 h-3" />
                              {formatElapsedTime(item.hoursInLaundry)}
                            </span>
                          </td>

                          {/* Fast Action */}
                          <td className="py-3.5 px-4 print:hidden text-center">
                            <button
                              type="button"
                              onClick={() => navigate(`/laundry/handover?userId=${item.userId}`)}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 transition-colors shadow-2xs"
                            >
                              تسليم القطعة
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50/50 print:hidden">
                <span className="text-xs text-slate-500 font-bold">
                  عرض صفحة {currentPage} من {totalPages} (إجمالي {filteredItems.length} قطعة)
                </span>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 h-8 w-8"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>

                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum = currentPage;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (currentPage <= 3) pageNum = i + 1;
                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = currentPage - 2 + i;

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 h-8 w-8"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* ─── PRINT-ONLY SIGNATURE FOOTER ───────────────────────────────── */}
          <div className="hidden print:block mt-12 pt-6 border-t-2 border-slate-300">
            <div className="grid grid-cols-3 gap-8 text-center text-xs font-bold text-slate-800">
              <div>
                <p>مسؤول المغسلة</p>
                <div className="h-16 border-b border-dashed border-slate-400 mt-2" />
                <p className="mt-2 text-slate-400 font-normal">التوقيع / التاريخ</p>
              </div>
              <div>
                <p>مشرف التشغيل واليونيفورم</p>
                <div className="h-16 border-b border-dashed border-slate-400 mt-2" />
                <p className="mt-2 text-slate-400 font-normal">التوقيع / التاريخ</p>
              </div>
              <div>
                <p>مدير الخدمات والمستودعات</p>
                <div className="h-16 border-b border-dashed border-slate-400 mt-2" />
                <p className="mt-2 text-slate-400 font-normal">التوقيع / التاريخ</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default InLaundryReportPage;
