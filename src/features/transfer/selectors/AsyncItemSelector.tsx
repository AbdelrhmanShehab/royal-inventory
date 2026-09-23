import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Loader2, Package, Check, Tag } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { hierarchyApi } from '../../../api/hierarchy.api';
import type { MasterItem } from '../../../types/transfer';

interface AsyncItemSelectorProps {
  value?: string;
  nodeId?: number | string | null;
  onSelect: (item: MasterItem) => void;
  placeholder?: string;
  disabled?: boolean;
}

// Highlight matching search text helper
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim() || !text) return <span>{text}</span>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5 font-bold">{part}</mark>
        ) : (
          part
        )
      )}
    </span>
  );
}

export const AsyncItemSelector: React.FC<AsyncItemSelectorProps> = ({
  value,
  nodeId,
  onSelect,
  placeholder,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const effectivePlaceholder = placeholder || (nodeId ? 'ابحث برقم الصنف أو الاسم بالعربي/الإنجليزي...' : 'يرجى اختيار مستودع المصدر أولاً لعرض الأصناف المتوفرة به...');

  // Debounce search query (250ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Fetch node-specific stock items if nodeId is provided. Strictly ONLY items with positive operational stock (> 0)!
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['node-stock-items', nodeId],
    queryFn: async (): Promise<MasterItem[]> => {
      if (!nodeId) {
        return [];
      }
      try {
        const stock = await hierarchyApi.getNodeStock(nodeId);
        if (stock && stock.length > 0) {
          // Strictly filter only items that have operational stock > 0
          const validStock = stock.filter(s => (s.qty_operational || 0) > 0);
          return validStock.map(s => ({
            id: s.item_code,
            itemCode: s.item_code,
            itemNameAr: s.item_name_ar || s.item_code,
            itemNameEn: s.item_name_en,
            categoryCode: s.category,
            unitCode: s.unit || 'حبة',
            unitNameAr: s.unit || 'حبة',   
            avgCost: s.avg_cost || 0,
            availableQty: Number(s.qty_operational || 0)
          }));
        }
      } catch (err) {
        console.warn(`Could not load node stock for nodeId ${nodeId}:`, err);
      }
      // Never fallback to master items without stock!
      return [];
    },
    staleTime: 30 * 1000
  });

  const selectedItem = items.find(i => i.itemCode === value);

  // Filter items matching query
  const filteredItems = useMemo(() => {
    if (!debouncedTerm.trim()) return items.slice(0, 50);
    const q = debouncedTerm.toLowerCase().trim();
    return items.filter(item => 
      item.itemCode.toLowerCase().includes(q) ||
      (item.itemNameAr && item.itemNameAr.toLowerCase().includes(q)) ||
      (item.itemNameEn && item.itemNameEn.toLowerCase().includes(q)) ||
      (item.categoryCode && item.categoryCode.toLowerCase().includes(q))
    ).slice(0, 50);
  }, [items, debouncedTerm]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[highlightedIndex]) {
        handleSelectItem(filteredItems[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelectItem = (item: MasterItem) => {
    onSelect(item);
    setSearchTerm('');
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full font-arabic text-right">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          disabled={disabled || !nodeId}
          value={isOpen ? searchTerm : (selectedItem ? `[${selectedItem.itemCode}] ${selectedItem.itemNameAr} (متاح: ${selectedItem.availableQty || 0})` : '')}
          placeholder={effectivePlaceholder}
          onFocus={() => {
            if (!disabled && nodeId) {
              setIsOpen(true);
              setSearchTerm('');
            }
          }}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setHighlightedIndex(0);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="w-full pr-9 pl-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50 disabled:bg-slate-50 disabled:cursor-not-allowed"
        />
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
          {isLoading ? <Loader2 size={15} className="animate-spin text-blue-500" /> : <Search size={15} />}
        </div>
        {selectedItem && !isOpen && (
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-emerald-600">
            <Check size={14} />
          </div>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full right-0 left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-[9999] max-h-60 overflow-y-auto divide-y divide-slate-100 animate-scale-up">
          {isLoading ? (
            <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin text-blue-600" />
              جاري فحص الأرصدة المتوفرة في المستودع...
            </div>
          ) : items.length === 0 ? (
            <div className="p-4 text-center text-xs text-amber-700 bg-amber-50/60 font-medium">
              {nodeId 
                ? '⚠️ لا توجد أصناف ذات رصيد متاح (> 0) في هذا المستودع حالياً' 
                : 'يرجى اختيار مستودع المصدر أولاً لعرض الأصناف المتوفرة به'}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              لا توجد أصناف متوفرة تطابق "{searchTerm}"
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = item.itemCode === value;
              const isHighlighted = idx === highlightedIndex;

              return (
                <div
                  key={`${item.itemCode}-${idx}`}
                  onClick={() => handleSelectItem(item)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`p-3 text-xs cursor-pointer flex items-center justify-between transition-colors ${
                    isHighlighted ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50 text-slate-700'
                  } ${isSelected ? 'font-bold bg-blue-50/50' : ''}`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center font-mono text-[10px] font-bold shrink-0">
                      <Package size={14} />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800">
                        <HighlightText text={item.itemNameAr} query={debouncedTerm} />
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span>كود: <HighlightText text={item.itemCode} query={debouncedTerm} /></span>
                        {item.itemNameEn && (
                          <>
                            <span>•</span>
                            <span><HighlightText text={item.itemNameEn} query={debouncedTerm} /></span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.availableQty !== undefined && (
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                        المتوفر: {item.availableQty} {item.unitNameAr || item.unitCode || 'وحدة'}
                      </span>
                    )}
                    {item.categoryCode && (
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-semibold flex items-center gap-1">
                        <Tag size={10} />
                        {item.categoryCode}
                      </span>
                    )}
                    {isSelected && <Check size={14} className="text-blue-600" />}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default AsyncItemSelector;
