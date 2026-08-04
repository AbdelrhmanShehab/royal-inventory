import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronLeft, Check, Loader2, Warehouse, Hotel, UtensilsCrossed, Shirt, Store } from 'lucide-react';
import { hierarchyApi } from '../../../api/hierarchy.api';
import type { OrganizationNode } from '../../../types/hierarchy';

interface TreeNodeSelectorProps {
  value?: number | '';
  onChange: (nodeId: number, nodeName: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
}

const getNodeIcon = (type: string) => {
  switch (type?.toLowerCase()) {
    case 'hotel':
      return <Hotel size={14} className="text-blue-600" />;
    case 'warehouse':
    case 'main_warehouse':
      return <Warehouse size={14} className="text-amber-600" />;
    case 'kitchen':
      return <UtensilsCrossed size={14} className="text-emerald-600" />;
    case 'laundry':
      return <Shirt size={14} className="text-purple-600" />;
    default:
      return <Store size={14} className="text-slate-500" />;
  }
};

const TreeNodeItem: React.FC<{
  node: OrganizationNode;
  selectedId?: number | '';
  onSelect: (id: number, name: string) => void;
  level?: number;
}> = ({ node, selectedId, onSelect, level = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const numId = Number(node.id.replace('group-', ''));
  const isSelected = !isNaN(numId) && numId === selectedId;
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="select-none font-arabic">
      <div 
        onClick={() => {
          if (!isNaN(numId)) {
            onSelect(numId, node.name);
          } else if (hasChildren) {
            setIsExpanded(!isExpanded);
          }
        }}
        style={{ paddingRight: `${level * 16 + 12}px` }}
        className={`py-2 pl-3 flex items-center justify-between text-xs cursor-pointer transition-colors ${
          isSelected ? 'bg-blue-50 text-blue-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
        }`}
      >
        <div className="flex items-center gap-2">
          {hasChildren && (
            <span 
              onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
              className="text-slate-400 hover:text-slate-700 p-0.5"
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronLeft size={14} />}
            </span>
          )}
          {!hasChildren && <span className="w-3.5"></span>}
          {getNodeIcon(node.type)}
          <span>{node.name}</span>
          <span className="text-[9px] text-slate-400 font-mono">({node.type})</span>
        </div>
        {isSelected && <Check size={14} className="text-blue-600" />}
      </div>

      {hasChildren && isExpanded && (
        <div className="border-r border-slate-100 pr-1">
          {(node.children || []).map(child => (
            <TreeNodeItem
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const TreeNodeSelector: React.FC<TreeNodeSelectorProps> = ({
  value,
  onChange,
  placeholder = 'اختر من الهيكل التنظيمي...',
  disabled = false,
  error = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const { data: treeNodes = [], isLoading } = useQuery({
    queryKey: ['hierarchy-tree'],
    queryFn: hierarchyApi.getTree,
    staleTime: 10 * 60 * 1000
  });

  // Find selected node name recursively
  const findNodeName = (nodes: OrganizationNode[], targetId?: number | ''): string | null => {
    if (!targetId) return null;
    for (const node of nodes) {
      const numId = Number(node.id.replace('group-', ''));
      if (numId === targetId) return node.name;
      if (node.children) {
        const found = findNodeName(node.children, targetId);
        if (found) return found;
      }
    }
    return null;
  };

  const selectedName = findNodeName(treeNodes, value);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full font-arabic text-right">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 bg-white border rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
          error ? 'border-2 border-red-500 bg-red-50/20' : 'border-slate-200 hover:border-slate-300 focus:border-blue-500'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
      >
        <span className={selectedName ? 'text-slate-800 font-bold' : 'text-slate-400'}>
          {selectedName ? selectedName : placeholder}
        </span>
        <div className="flex items-center gap-1 text-slate-400">
          {isLoading ? <Loader2 size={14} className="animate-spin text-blue-500" /> : <ChevronDown size={14} />}
        </div>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-[9999] max-h-64 overflow-y-auto divide-y divide-slate-100 animate-scale-up">
          {isLoading ? (
            <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin text-blue-600" />
              جاري تحميل الهيكل التنظيمي...
            </div>
          ) : treeNodes.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">لا يوجد بيانات هيكل تنظيمي</div>
          ) : (
            treeNodes.map(node => (
              <TreeNodeItem
                key={node.id}
                node={node}
                selectedId={value}
                onSelect={(id, name) => {
                  onChange(id, name);
                  setIsOpen(false);
                }}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default TreeNodeSelector;
