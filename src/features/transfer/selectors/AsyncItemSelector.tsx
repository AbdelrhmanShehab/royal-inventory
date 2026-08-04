import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Loader2, Package, Check, Tag } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { masterDataApi } from '../../../api/masterData.api';
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

  const effectivePlaceholder = placeholder || (nodeId ? 'ابحث برقم الصنف، الاسم بالعربي/الإنجليزي...' : 'يرجى اختيار مستودع المصدر أولاً...');

  // Debounce search query (250ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Fetch node-specific stock items if nodeId is provided, otherwise fall back to master items
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['node-stock-items', nodeId],
    queryFn: async (): Promise<MasterItem[]> => {
      if (nodeId) {
        try {
          const stock = await hierarchyApi.getNodeStock(nodeId);
          if (stock && stock.length > 0) {
            return stock.map(s => ({
              id: s.item_code,
              itemCode: s.item_code,
              itemNameAr: s.item_name_ar || s.item_code,
              itemNameEn: s.item_name_en,
              categoryCode: s.category,
              unitCode: s.unit || 'حبة',
              unitNameAr: s.unit || 'حبة',   
              avgCost: s.avg_cost || 0
            }));
          }
        } catch (err) {
          console.warn(`Could not load node stock for nodeId ${nodeId}, falling back to master items:`, err);
        }
      }
      return masterDataApi.getItems();
    },
    staleTime: 2 * 60 * 1000
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
          disabled={disabled}
          value={isOpen ? searchTerm : (selectedItem ? `[${selectedItem.itemCode}] ${selectedItem.itemNameAr}` : '')}
          placeholder={effectivePlaceholder}
          onFocus={() => {
            if (!disabled) {
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
          className="w-full pr-9 pl-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50"
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
              جاري البحث في قاعدة بيانات الأصناف...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              لا توجد أصناف تطابق "{searchTerm}"
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = item.itemCode === value;
              const isHighlighted = idx === highlightedIndex;

              return (
                <div
                  key={item.itemCode}
                  onClick={() => handleSelectItem(item)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`p-3 text-xs cursor-pointer flex items-center justify-between transition-colors ${
                    isHighlighted ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50 text-slate-700'
                  } ${isSelected ? 'font-bold bg-blue-50/50' : ''}`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-mono text-[10px] font-bold shrink-0">
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
                    {item.categoryCode && (
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-semibold flex items-center gap-1">
                        <Tag size={10} />
                        {item.categoryCode}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold">
                      {item.unitNameAr || item.unitCode || 'وحدة'}
                    </span>
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
