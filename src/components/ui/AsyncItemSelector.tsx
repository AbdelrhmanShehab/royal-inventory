import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Package, Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { masterDataApi } from '../../api/masterData.api';
import type { MasterItem } from '../../types/transfer';

interface AsyncItemSelectorProps {
  value?: string; // itemCode
  onSelect: (item: MasterItem) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const AsyncItemSelector: React.FC<AsyncItemSelectorProps> = ({
  value,
  onSelect,
  placeholder = 'ابحث برقم الصنف أو الاسم بالعربي/الإنجليزي...',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch all master items
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['master-data-items'],
    queryFn: () => masterDataApi.getItems(),
    staleTime: 5 * 60 * 1000 // Cache for 5 mins
  });

  // Find currently selected item object if value is set
  const selectedItem = items.find(i => i.itemCode === value);

  // Filter items client-side with debounced search query
  const filteredItems = React.useMemo(() => {
    if (!searchTerm.trim()) return items.slice(0, 50); // Top 50 default
    const q = searchTerm.toLowerCase().trim();
    return items.filter(item => 
      item.itemCode.toLowerCase().includes(q) ||
      (item.itemNameAr && item.itemNameAr.toLowerCase().includes(q)) ||
      (item.itemNameEn && item.itemNameEn.toLowerCase().includes(q)) ||
      (item.categoryCode && item.categoryCode.toLowerCase().includes(q))
    ).slice(0, 50);
  }, [items, searchTerm]);

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
    <div ref={containerRef} className="relative w-full text-right font-arabic">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={isOpen ? searchTerm : (selectedItem ? `${selectedItem.itemCode} - ${selectedItem.itemNameAr}` : '')}
          placeholder={placeholder}
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

      {/* Dropdown Options List */}
      {isOpen && (
        <div className="absolute top-full right-0 left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-100 animate-scale-up">
          {isLoading ? (
            <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin text-blue-600" />
              جاري جلب قائمة الأصناف من الخادم...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              لا توجد أصناف تطابق البحث "{searchTerm}"
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
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-mono text-[10px] font-bold">
                      <Package size={14} />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800">{item.itemNameAr}</span>
                      <span className="text-[10px] font-mono text-slate-400">كود: {item.itemCode} {item.itemNameEn ? `| ${item.itemNameEn}` : ''}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-left">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
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
