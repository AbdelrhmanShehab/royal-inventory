import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Package, Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { masterDataApi } from '../../api/masterData.api';
import { hierarchyApi } from '../../api/hierarchy.api';
import type { MasterItem } from '../../types/transfer';

interface AsyncItemSelectorProps {
  value?: string; // itemCode
  nodeId?: number | string | null;
  onSelect: (item: MasterItem) => void;
  placeholder?: string;
  disabled?: boolean;
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
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const effectivePlaceholder = placeholder || (nodeId !== undefined ? (nodeId ? 'ابحث برقم الصنف أو الاسم بالعربي/الإنجليزي...' : 'يرجى اختيار مستودع المصدر أولاً لعرض الأصناف المتوفرة به...') : 'ابحث برقم الصنف أو الاسم بالعربي/الإنجليزي...');

  // Fetch node-specific stock (only positive available quantity) if nodeId is provided; otherwise fetch all master catalog items
  const { data: items = [], isLoading } = useQuery({
    queryKey: nodeId !== undefined ? ['node-stock-items-ui', nodeId] : ['master-data-items'],
    queryFn: async (): Promise<MasterItem[]> => {
      if (nodeId !== undefined) {
        if (!nodeId) return [];
        try {
          const stock = await hierarchyApi.getNodeStock(nodeId);
          if (stock && stock.length > 0) {
            // Strictly exclude any item with stock <= 0
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
          return [];
        } catch (err) {
          console.warn('Could not load node stock for ui selector:', err);
          return [];
        }
      }
      return masterDataApi.getItems();
    },
    staleTime: 30 * 1000
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
          disabled={disabled || (nodeId !== undefined && !nodeId)}
          value={isOpen ? searchTerm : (selectedItem ? `${selectedItem.itemCode} - ${selectedItem.itemNameAr}${selectedItem.availableQty !== undefined ? ` (متاح: ${selectedItem.availableQty})` : ''}` : '')}
          placeholder={effectivePlaceholder}
          onFocus={() => {
            if (!disabled && (nodeId === undefined || nodeId)) {
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

      {/* Dropdown Options List */}
      {isOpen && (
        <div className="absolute top-full right-0 left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-100 animate-scale-up">
          {isLoading ? (
            <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin text-blue-600" />
              جاري جلب قائمة الأصناف المتوفرة...
            </div>
          ) : items.length === 0 ? (
            <div className="p-4 text-center text-xs text-amber-700 bg-amber-50/60 font-medium">
              {nodeId !== undefined 
                ? (nodeId ? '⚠️ لا توجد أصناف ذات رصيد متاح (> 0) في هذا المستودع حالياً' : 'يرجى اختيار مستودع المصدر أولاً لعرض الأصناف المتوفرة به') 
                : 'لا توجد أصناف مسجلة في النظام'}
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
                      <span className="font-bold text-slate-800">{item.itemNameAr}</span>
                      <span className="text-[10px] font-mono text-slate-400">كود: {item.itemCode} {item.itemNameEn ? `| ${item.itemNameEn}` : ''}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-left shrink-0">
                    {item.availableQty !== undefined && (
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                        المتوفر: {item.availableQty} {item.unitNameAr || item.unitCode || 'وحدة'}
                      </span>
                    )}
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
