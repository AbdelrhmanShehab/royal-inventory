import React, { useState } from 'react';
import { Eye, Building2, ArrowUpDown, User, Calendar, Clock, CheckCircle2, ArrowRight } from 'lucide-react';
import Badge from '../../../components/ui/Badge';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import EmptyState from '../../../components/ui/EmptyState';
import { TRANSFER_STATUS_CONFIG, TRANSFER_TYPES_CONFIG } from '../constants/transfer.constants';
import type { TransferSummary } from '../types/transfer.types';

interface TransferTableProps {
  transfers: TransferSummary[];
  onSelect: (id: number) => void;
}

const formatDateTime = (dateStr?: string) => {
  if (!dateStr) return { date: '—', time: '' };
  try {
    const d = new Date(dateStr);
    const date = d.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const time = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    return { date, time };
  } catch {
    return { date: dateStr, time: '' };
  }
};

export const TransferTable: React.FC<TransferTableProps> = ({ transfers, onSelect }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const sortedTransfers = [...transfers].sort((a, b) => {
    const timeA = a.createdAt || '';
    const timeB = b.createdAt || '';
    return sortOrder === 'desc' ? timeB.localeCompare(timeA) : timeA.localeCompare(timeB);
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTransfers = sortedTransfers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedTransfers.length / itemsPerPage);

  if (transfers.length === 0) {
    return <EmptyState title="لا توجد حركات مخزنية" description="لم نجد أي نتائج تطابق التصفية الحالية." />;
  }

  return (
    <div className="flex flex-col gap-4 font-arabic select-none" dir="rtl">
      <Card className="border border-slate-200/80 overflow-hidden shadow-xs rounded-xl">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead className="bg-slate-100/90 border-b border-slate-200 sticky top-0 text-slate-700 text-xs font-black">
              <tr className="divide-x divide-x-reverse divide-slate-200">
                <th className="px-4 py-3.5">رقم الحركة</th>
                <th className="px-4 py-3.5">نوع الحركة</th>
                <th className="px-4 py-3.5">مسار النقل (من ⬅ إلى)</th>
                <th className="px-4 py-3.5">مُنشئ المستند (من قام بالطلب)</th>
                <th className="px-4 py-3.5 cursor-pointer hover:text-slate-900" onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}>
                  <div className="flex items-center gap-1">
                    تاريخ ووقت الحركة
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th className="px-4 py-3.5">الأصناف</th>
                <th className="px-4 py-3.5">محطة المسار (Flow Status)</th>
                <th className="px-4 py-3.5 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {currentTransfers.map((item) => {
                const statusInfo = TRANSFER_STATUS_CONFIG[item.status] || { label: item.status, variant: 'neutral' };
                const typeConfig = TRANSFER_TYPES_CONFIG[item.txnType] || { label: item.txnType };
                const createdDateTime = formatDateTime(item.createdAt);
                const confirmedDateTime = formatDateTime(item.confirmedAt);

                return (
                  <tr 
                    key={item.id}
                    onClick={() => onSelect(item.id)}
                    className="odd:bg-white even:bg-slate-50/50 hover:bg-blue-50/60 cursor-pointer transition-colors duration-150 divide-x divide-x-reverse divide-slate-200/80"
                  >
                    {/* رقم الحركة */}
                    <td className="px-4 py-3 font-mono font-extrabold text-blue-700 bg-slate-50/30">
                      #{item.id}
                    </td>

                    {/* نوع الحركة */}
                    <td className="px-4 py-3 font-bold text-slate-800">
                      <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[11px] font-bold border border-slate-200">
                        {typeConfig.label}
                      </span>
                    </td>

                    {/* مسار النقل (من -> إلى) */}
                    <td className="px-4 py-3 font-semibold text-slate-700">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-800 flex items-center gap-1">
                          <Building2 size={12} className="text-slate-400" />
                          {item.fromNodeNameAr || `مستودع #${item.fromNodeId}`}
                        </span>
                        {item.toNodeId ? (
                          <>
                            <ArrowRight size={12} className="text-blue-500 shrink-0" />
                            <span className="font-bold text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                              {item.toNodeNameAr || `مستودع #${item.toNodeId}`}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-400 text-[11px]">(عملية داخلية)</span>
                        )}
                      </div>
                    </td>

                    {/* من قام بالحركة */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100/70 border border-blue-200 text-blue-800 flex items-center justify-center font-bold text-[11px] shrink-0">
                          <User size={13} />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 leading-tight">
                            {item.createdByNameAr || item.creatorUsername || (item.createdBy ? `مستخدم #${item.createdBy}` : 'أمين المستودع')}
                          </span>
                          {item.creatorUsername && item.createdByNameAr && item.creatorUsername !== item.createdByNameAr && (
                            <span className="text-[10px] text-slate-400 font-mono">@{item.creatorUsername}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* التاريخ والوقت الدقيق */}
                    <td className="px-4 py-3 font-mono text-slate-700">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold flex items-center gap-1 text-slate-800">
                          <Calendar size={11} className="text-slate-400" />
                          {createdDateTime.date}
                        </span>
                        {createdDateTime.time && (
                          <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                            <Clock size={10} className="text-blue-500" />
                            {createdDateTime.time}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* عدد الأصناف */}
                    <td className="px-4 py-3 font-bold text-slate-700 font-mono">
                      {item.itemCount} صنف
                    </td>

                    {/* محطة المسار والحالة */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 items-start">
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                        {item.status === 'confirmed' && (item.confirmerNameAr || item.confirmerUsername) && (
                          <div className="text-[10px] text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-1 font-semibold">
                            <CheckCircle2 size={10} className="text-emerald-600" />
                            <span>استلم: {item.confirmerNameAr || item.confirmerUsername}</span>
                            {confirmedDateTime.time && (
                              <span className="text-[9px] text-emerald-600 font-mono">({confirmedDateTime.time})</span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* الإجراءات */}
                    <td className="px-4 py-3 text-center">
                      <button 
                        onClick={(e) => { e.stopPropagation(); onSelect(item.id); }}
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 rounded-lg text-xs font-bold text-slate-600 transition-all flex items-center gap-1 mx-auto cursor-pointer"
                      >
                        <Eye size={13} />
                        عرض المستند
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white border border-slate-200/80 px-6 py-3.5 rounded-xl shadow-xs gap-3">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-slate-500 font-bold">
            عرض {sortedTransfers.length === 0 ? 0 : indexOfFirstItem + 1} - {Math.min(indexOfLastItem, sortedTransfers.length)} من أصل {sortedTransfers.length} مستند
          </span>
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold">
            <span>عرض بالصفحة:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value={25}>25 مستند</option>
              <option value={50}>50 مستند</option>
              <option value={100}>100 مستند</option>
              <option value={200}>200 مستند</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button 
            variant="outline" 
            size="sm" 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => prev - 1)}
          >
            السابق
          </Button>
          <span className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 font-black rounded-lg text-xs">
            صفحة {currentPage} من {Math.max(1, totalPages)}
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            disabled={currentPage >= totalPages || totalPages === 0}
            onClick={() => setCurrentPage(prev => prev + 1)}
          >
            التالي
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TransferTable;
