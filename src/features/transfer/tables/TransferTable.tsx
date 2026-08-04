import React, { useState } from 'react';
import { Eye, Building2, ArrowUpDown } from 'lucide-react';
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

export const TransferTable: React.FC<TransferTableProps> = ({ transfers, onSelect }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const itemsPerPage = 10;

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
      <Card className="border-slate-200/60 overflow-hidden shadow-xs">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead className="bg-slate-50/80 border-b border-slate-100 sticky top-0 text-slate-500 text-xs font-bold">
              <tr>
                <th className="px-6 py-4">رقم الحركة</th>
                <th className="px-6 py-4">نوع الحركة</th>
                <th className="px-6 py-4">مستودع المصدر (من)</th>
                <th className="px-6 py-4">مستودع الوجهة (إلى)</th>
                <th className="px-6 py-4">مُنشئ المستند</th>
                <th className="px-6 py-4 cursor-pointer hover:text-slate-800" onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}>
                  <div className="flex items-center gap-1">
                    التاريخ
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th className="px-6 py-4">عدد الأصناف</th>
                <th className="px-6 py-4">الحالة التشغيلية</th>
                <th className="px-6 py-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {currentTransfers.map((item) => {
                const statusInfo = TRANSFER_STATUS_CONFIG[item.status] || { label: item.status, variant: 'neutral' };
                const typeConfig = TRANSFER_TYPES_CONFIG[item.txnType] || { label: item.txnType };

                return (
                  <tr 
                    key={item.id}
                    onClick={() => onSelect(item.id)}
                    className="hover:bg-slate-50/60 cursor-pointer transition-colors duration-150"
                  >
                    <td className="px-6 py-4 font-mono font-extrabold text-blue-700">
                      #{item.id}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800">
                      {typeConfig.label}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <Building2 size={13} className="text-slate-400" />
                        <span>{item.fromNodeNameAr || `مستودع #${item.fromNodeId}`}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700">
                      {item.toNodeNameAr || (item.toNodeId ? `مستودع #${item.toNodeId}` : '—')}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-600">
                      {item.createdByNameAr || item.createdBy}
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-400 font-bold">
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString('ar-SA') : '—'}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-600 font-mono">
                      {item.itemCount} صنف
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    </td>
                    <td className="px-6 py-4 text-center">
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

      {totalPages > 1 && (
        <div className="flex justify-between items-center bg-white border border-slate-200/80 px-6 py-3.5 rounded-xl shadow-xs">
          <span className="text-xs text-slate-400 font-bold">
            عرض {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, sortedTransfers.length)} من أصل {sortedTransfers.length} مستند
          </span>
          <div className="flex gap-1">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
            >
              السابق
            </Button>
            {Array.from({ length: totalPages }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentPage(idx + 1)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currentPage === idx + 1 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-transparent text-slate-500 hover:bg-slate-50'
                }`}
              >
                {idx + 1}
              </button>
            ))}
            <Button 
              variant="outline" 
              size="sm" 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
            >
              التالي
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransferTable;
