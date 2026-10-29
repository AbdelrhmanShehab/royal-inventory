import React from 'react';
import { Calendar, RotateCcw, Filter } from 'lucide-react';
import Button from '../ui/Button';

interface DateRangeFilterBarProps {
  fromDate: string;
  toDate: string;
  onFromDateChange: (date: string) => void;
  onToDateChange: (date: string) => void;
  onClear: () => void;
  loading?: boolean;
  label?: string;
  className?: string;
}

export const DateRangeFilterBar: React.FC<DateRangeFilterBarProps> = ({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  onClear,
  loading = false,
  label = 'تصفية حسب الفترة الزمنية',
  className = '',
}) => {
  const getTodayStr = () => new Date().toISOString().split('T')[0];

  const setPreset = (type: 'today' | '7days' | '30days' | 'thisMonth') => {
    const today = getTodayStr();
    if (type === 'today') {
      onFromDateChange(today);
      onToDateChange(today);
    } else if (type === '7days') {
      const past = new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString().split('T')[0];
      onFromDateChange(past);
      onToDateChange(today);
    } else if (type === '30days') {
      const past = new Date(Date.now() - 29 * 24 * 3600 * 1000).toISOString().split('T')[0];
      onFromDateChange(past);
      onToDateChange(today);
    } else if (type === 'thisMonth') {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      onFromDateChange(firstDay);
      onToDateChange(today);
    }
  };

  const isFiltered = Boolean(fromDate || toDate);

  // Check which preset is currently active
  const today = getTodayStr();
  const past7 = new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString().split('T')[0];
  const past30 = new Date(Date.now() - 29 * 24 * 3600 * 1000).toISOString().split('T')[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const activePreset = 
    !isFiltered ? 'all' :
    (fromDate === today && toDate === today) ? 'today' :
    (fromDate === past7 && toDate === today) ? '7days' :
    (fromDate === past30 && toDate === today) ? '30days' :
    (fromDate === firstOfMonth && toDate === today) ? 'thisMonth' :
    'custom';

  return (
    <div className={`bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs ${className}`}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Title & Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-slate-700 font-extrabold text-xs pl-2 border-l border-slate-200 ml-1">
            <Calendar size={16} className="text-blue-600" />
            <span>{label}</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={onClear}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activePreset === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              الكل
            </button>
            <button
              type="button"
              onClick={() => setPreset('today')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activePreset === 'today'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              اليوم
            </button>
            <button
              type="button"
              onClick={() => setPreset('7days')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activePreset === '7days'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              آخر 7 أيام
            </button>
            <button
              type="button"
              onClick={() => setPreset('30days')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activePreset === '30days'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              آخر 30 يوم
            </button>
            <button
              type="button"
              onClick={() => setPreset('thisMonth')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activePreset === 'thisMonth'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              الشهر الحالي
            </button>
          </div>
        </div>

        {/* Date Inputs */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-semibold whitespace-nowrap">من:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => onFromDateChange(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors shadow-2xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-semibold whitespace-nowrap">إلى:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => onToDateChange(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors shadow-2xs"
            />
          </div>

          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              disabled={loading}
              className="text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 px-2.5 py-1.5 h-auto rounded-xl"
              title="إلغاء تصفية التاريخ"
            >
              <RotateCcw size={13} className="ml-1" />
              إلغاء التصفية
            </Button>
          )}
        </div>
      </div>

      {isFiltered && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5 text-blue-700 font-medium">
            <Filter size={12} className="text-blue-600" />
            يتم عرض البيانات للفترة: {fromDate || 'البداية'} ← {toDate || 'الآن'}
          </span>
          <span className="text-slate-400 font-mono text-[10px]">
            {activePreset !== 'custom' ? `(فلتر سريع: ${
              activePreset === 'today' ? 'اليوم' :
              activePreset === '7days' ? 'آخر 7 أيام' :
              activePreset === '30days' ? 'آخر 30 يوم' : 'الشهر الحالي'
            })` : '(فترة مخصصة)'}
          </span>
        </div>
      )}
    </div>
  );
};

export default DateRangeFilterBar;
