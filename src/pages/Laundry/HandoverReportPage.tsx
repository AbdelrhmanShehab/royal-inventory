import React, { useState, useEffect } from 'react';
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
  Fingerprint
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Loader from '../../components/ui/Loader';
import EmptyState from '../../components/ui/EmptyState';
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

export const HandoverReportPage: React.FC = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<HandoverTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<'all' | 'Handover' | 'Receive'>('all');

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const res = await laundryApi.getZkTransactions({ limit: 200, action: actionFilter });
      const list = Array.isArray(res) ? res : (res?.data || []);
      setTransactions(list);
    } catch (err) {
      console.error('Error fetching handover transactions:', err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [actionFilter]);

  const filteredTxns = transactions.filter((t) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (t.userCode || '').toLowerCase().includes(q) ||
      (t.employeeName || '').toLowerCase().includes(q) ||
      (t.itemName || '').toLowerCase().includes(q) ||
      (t.itemCode || '').toLowerCase().includes(q)
    );
  });

  const totalHandover = transactions.filter(t => t.action === 'Handover').length;
  const totalReceive = transactions.filter(t => t.action === 'Receive').length;

  const exportCSV = () => {
    const headers = ['رقم الحركة', 'معرف الموظف الدائم', 'كود الموظف', 'اسم الموظف', 'كود الصنف', 'اسم الصنف', 'نوع الحركة', 'الكمية', 'التاريخ والوقت', 'المسؤول', 'ملاحظات'];
    const rows = filteredTxns.map(t => [
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
    link.setAttribute('download', `handover_report_${new Date().toISOString().split('T')[0]}.csv`);
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
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={filteredTxns.length === 0}>
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

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200/80 shadow-2xs">
          <Card.Body className="p-5 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-slate-500 font-bold">إجمالي الحركات</span>
              <span className="text-2xl font-black text-slate-800 mt-1 font-mono">{transactions.length}</span>
              <span className="text-[10px] text-slate-400 mt-0.5">عمليات تسليم واستلام مسجلة</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Layers size={22} />
            </div>
          </Card.Body>
        </Card>

        <Card className="border-slate-200/80 shadow-2xs">
          <Card.Body className="p-5 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-blue-600 font-bold">إجمالي التسليمات (Handover)</span>
              <span className="text-2xl font-black text-blue-600 mt-1 font-mono">{totalHandover}</span>
              <span className="text-[10px] text-blue-600/70 mt-0.5 font-semibold">تسليم يونيفورم للموظف</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ArrowUpRightIcon size={22} />
            </div>
          </Card.Body>
        </Card>

        <Card className="border-slate-200/80 shadow-2xs">
          <Card.Body className="p-5 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-emerald-600 font-bold">إجمالي الاستلامات (Receive)</span>
              <span className="text-2xl font-black text-emerald-600 mt-1 font-mono">{totalReceive}</span>
              <span className="text-[10px] text-emerald-600/70 mt-0.5 font-semibold">استلام غسيل من الموظف</span>
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالموظف، أو كود الصنف، أو اسم القطعة..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2 text-xs focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-xs text-slate-500 font-bold ml-2">نوع العملية:</span>
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1 text-xs">
              <button
                type="button"
                onClick={() => setActionFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  actionFilter === 'all' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setActionFilter('Handover')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  actionFilter === 'Handover' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                تسليم فقط
              </button>
              <button
                type="button"
                onClick={() => setActionFilter('Receive')}
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
        <div className="p-4 bg-slate-50/70 border-b border-slate-200/80 flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
            <Shirt size={16} className="text-blue-600" />
            <span>سجل المعاملات المكتملة</span>
            <span className="text-xs font-normal text-slate-400">({filteredTxns.length} معاملة)</span>
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center items-center">
            <Loader size="md" label="جاري استخراج سجل المعاملات..." />
          </div>
        ) : filteredTxns.length === 0 ? (
          <EmptyState
            title="لا توجد معاملات مسجلة"
            description="لم يتم العثور على أي حركات تسليم أو استلام تطابق معايير البحث."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100/70 text-slate-600 border-b border-slate-200 font-bold">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">رقم الحركة</th>
                  <th className="py-3 px-4">نوع العملية</th>
                  <th className="py-3 px-4">كود الموظف</th>
                  <th className="py-3 px-4">اسم الموظف</th>
                  <th className="py-3 px-4">اسم الصنف / القطعة</th>
                  <th className="py-3 px-4">كود الصنف</th>
                  <th className="py-3 px-4 text-center">الكمية</th>
                  <th className="py-3 px-4">التاريخ والوقت</th>
                  <th className="py-3 px-4">المسؤول</th>
                  <th className="py-3 px-4">ملاحظات</th>
                  <th className="py-3 px-4 text-center">التوثيق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredTxns.map((t, idx) => {
                  const isHandover = t.action === 'Handover';
                  const formattedTime = t.transactionDate ? new Date(t.transactionDate).toLocaleString('ar-EG') : '---';

                  return (
                    <tr key={t.txnId || idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        #{t.txnId}
                      </td>
                      <td className="py-3 px-4">
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
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-mono font-bold text-slate-800 text-[11px]">
                          {t.userCode || '---'} · ID: {t.userId}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {t.employeeName || 'غير معروف'}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-700">
                        {t.itemName || '---'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                        {t.itemCode || '---'}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-800 font-mono">
                        {t.quantity || 1}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 text-[11px]" dir="ltr">
                        {formattedTime}
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-[11px]">
                        {t.handledBy || 'أمين العهدة'}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {t.notes || '---'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Fingerprint size={12} className="text-emerald-600" />
                          بصمة بيومترية
                        </span>
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

export default HandoverReportPage;
