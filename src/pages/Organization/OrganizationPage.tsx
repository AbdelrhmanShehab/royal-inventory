// Organization Structure & Warehouse Stock Explorer
import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  ChefHat,
  Hotel,
  UtensilsCrossed,
  Wine,
  Home,
  ChevronDown,
  ChevronLeft,
  Search,
  Layers,
  ArrowLeftRight,
  Activity,
  Package,
  AlertCircle,
  WashingMachine,
  Boxes,
  RefreshCw,
  FolderTree,
  ShieldCheck,
  CheckCircle2,
  Plus,
  X
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Loader from '../../components/ui/Loader';
import { hierarchyApi, filterHierarchyForUserScope } from '../../api/hierarchy.api';
import type { StockItem } from '../../types/inventory';
import { transactionsApi } from '../../api/transactions.api';
import type { OrganizationNode } from '../../types/hierarchy';
import type { TransferTransaction } from '../../types/transaction';

import { useWarehouseScope } from '../../hooks/useWarehouseScope';

const formatDateTime = (dateStr?: string | Date) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('ar-EG', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '—';
  }
};

export default function OrganizationPage() {
  const { currentNodeId, isGlobalAdmin } = useWarehouseScope();
  const [hierarchy, setHierarchy] = useState<OrganizationNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<OrganizationNode | null>(null);
  const [nodeInventory, setNodeInventory] = useState<StockItem[]>([]);
  const [nodeTransactions, setNodeTransactions] = useState<TransferTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingNodeData, setLoadingNodeData] = useState(false);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'inventory' | 'subunits' | 'transactions'>('inventory');

  // Add Child Node Modal State
  const [addNodeParent, setAddNodeParent] = useState<OrganizationNode | null>(null);
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeDivision, setNewNodeDivision] = useState<'fb' | 'gs'>('gs');
  const [newNodeLaundry, setNewNodeLaundry] = useState(false);
  const [isSavingNode, setIsSavingNode] = useState(false);
  const [saveNodeError, setSaveNodeError] = useState<string | null>(null);

  // Pagination for inventory items
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Helper to find node recursively by numeric/string ID
  const findNodeInTree = (nodesList: OrganizationNode[], targetId: number | string): OrganizationNode | null => {
    for (const node of nodesList) {
      if (Number(node.id) === Number(targetId) || String(node.id) === String(targetId)) {
        return node;
      }
      if (node.children && node.children.length > 0) {
        const found = findNodeInTree(node.children, targetId);
        if (found) return found;
      }
    }
    return null;
  };

  // Fetch initial hierarchy
  const fetchHierarchy = async () => {
    try {
      setLoading(true);
      const data = await hierarchyApi.getTree();
      const displayData = (!isGlobalAdmin && currentNodeId)
        ? filterHierarchyForUserScope(data, currentNodeId)
        : data;

      setHierarchy(displayData);

      if (displayData.length > 0) {
        let initialSelected: OrganizationNode | null = null;
        if (!isGlobalAdmin && currentNodeId) {
          initialSelected = findNodeInTree(displayData, currentNodeId);
        }
        if (!initialSelected && selectedNode) {
          initialSelected = findNodeInTree(displayData, selectedNode.id);
        }
        if (!initialSelected) {
          // Default to first active hotel if available
          const firstGroup = displayData[0];
          initialSelected = (firstGroup.children && firstGroup.children.length > 0)
            ? firstGroup.children[0]
            : firstGroup;
        }
        setSelectedNode(initialSelected);
        if (initialSelected) {
          setExpandedNodes(prev => ({
            ...prev,
            [displayData[0].id]: true,
            [initialSelected.id]: true
          }));
        }
      }
    } catch (err) {
      console.error('Error fetching tree:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHierarchy();
  }, [currentNodeId, isGlobalAdmin]);

  // Fetch node specific data when selectedNode changes
  useEffect(() => {
    if (!selectedNode) return;
    const fetchNodeDetails = async () => {
      setLoadingNodeData(true);
      try {
        const [stock, nodeTxs] = await Promise.all([
          hierarchyApi.getNodeStock(selectedNode.id),
          transactionsApi.getTransfers({ nodeId: selectedNode.id })
        ]);
        setNodeInventory(stock || []);
        setNodeTransactions(nodeTxs || []);
      } catch (err) {
        console.error('Error fetching node details:', err);
      } finally {
        setLoadingNodeData(false);
      }
    };
    fetchNodeDetails();
  }, [selectedNode]);

  // Toggle node expansion
  const toggleExpand = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  // Open Add Child Modal
  const handleAddChild = (e: React.MouseEvent, parentNode: OrganizationNode) => {
    e.stopPropagation();
    setAddNodeParent(parentNode);
    setNewNodeName('');
    setNewNodeDivision('gs');
    setNewNodeLaundry(false);
    setSaveNodeError(null);
    // Auto-expand parent
    setExpandedNodes(prev => ({ ...prev, [parentNode.id]: true }));
  };

  // Save New Child Node
  const handleSaveNewNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addNodeParent || !newNodeName.trim()) return;
    setIsSavingNode(true);
    setSaveNodeError(null);
    try {
      const parentId = Number(addNodeParent.id);
      const parentNode = addNodeParent;
      // Determine groupId from parent's parentId chain
      const groupId = parentNode.groupId ?? 1;
      await hierarchyApi.createNode({
        nodeNameAr: newNodeName.trim(),
        nodeType: 'child',
        parentNodeId: parentId,
        groupId,
        division: newNodeDivision,
        hasLaundryAccess: newNodeLaundry,
        isActive: true,
      });
      setAddNodeParent(null);
      await fetchHierarchy();
    } catch (err: any) {
      setSaveNodeError(err?.response?.data?.message || err?.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setIsSavingNode(false);
    }
  };

  // Node Icons mapping
  const getNodeIcon = (type: string, size = 18) => {
    switch (type) {
      case 'group': return <Building2 size={size} className="text-blue-600" />;
      case 'hotel': return <Hotel size={size} className="text-indigo-600" />;
      case 'laundry': return <WashingMachine size={size} className="text-cyan-600" />;
      case 'kitchen': return <ChefHat size={size} className="text-amber-600" />;
      case 'bar': return <Wine size={size} className="text-rose-600" />;
      case 'restaurant': return <UtensilsCrossed size={size} className="text-teal-600" />;
      case 'housing': return <Home size={size} className="text-emerald-600" />;
      default: return <Boxes size={size} className="text-slate-500" />;
    }
  };

  const getNodeTypeName = (type: string) => {
    switch (type) {
      case 'group': return 'مجموعة تشغيلية رئيسية';
      case 'hotel': return 'مستودع رئيسي (Comsys Linked)';
      case 'laundry': return 'مغسلة مركزية (Comsys Linked)';
      case 'kitchen': return 'مطبخ تشغيلي داخلي';
      case 'bar': return 'ركن مشروبات / بار داخلي';
      case 'restaurant': return 'مطعم تشغيلي';
      case 'housing': return 'موقع إسكان / دور فندقي';
      default: return 'وحدة تشغيلية فرعية';
    }
  };

  // Filtered inventory in active node
  const filteredInventory = useMemo(() => {
    if (!itemSearchQuery.trim()) return nodeInventory;
    const q = itemSearchQuery.toLowerCase().trim();
    return nodeInventory.filter(item =>
      (item.item_name_ar || '').toLowerCase().includes(q) ||
      (item.item_code || '').toLowerCase().includes(q) ||
      (item.category || '').toLowerCase().includes(q)
    );
  }, [nodeInventory, itemSearchQuery]);

  // Paginated inventory items
  const paginatedInventory = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredInventory.slice(start, start + pageSize);
  }, [filteredInventory, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredInventory.length / pageSize) || 1;

  // Calculate high-level KPIs for selected node
  const totalOperationalQty = useMemo(() => {
    return nodeInventory.reduce((sum, item) => sum + (item.qty_operational || 0), 0);
  }, [nodeInventory]);

  const activeItemsCount = useMemo(() => {
    return nodeInventory.filter(i => (i.qty_operational || 0) > 0).length;
  }, [nodeInventory]);

  const transfersCount = nodeTransactions.length;
  const lastMovement = nodeTransactions.length > 0 && nodeTransactions[0].createdAt
    ? formatDateTime(nodeTransactions[0].createdAt)
    : 'لا توجد حركات مسجلة';

  // Recursive Tree Render
  const renderTree = (nodes: OrganizationNode[]) => {
    const filterTree = (list: OrganizationNode[]): OrganizationNode[] => {
      return list
        .map(node => ({
          ...node,
          children: node.children ? filterTree(node.children) : undefined
        }))
        .filter(node => {
          const isNodeActive = node.status === 'active' || node.type === 'group';
          const hasChildren = Boolean(node.children && node.children.length > 0);

          if (!showInactive && !isNodeActive && !hasChildren) {
            return false;
          }

          if (searchQuery.trim()) {
            return node.name.includes(searchQuery) || hasChildren;
          }
          return true;
        });
    };

    const filtered = filterTree(nodes);

    const buildTreeElements = (list: OrganizationNode[], depth = 0) => {
      return list.map(node => {
        const hasChildren = Boolean(node.children && node.children.length > 0);
        const isExpanded = !!expandedNodes[node.id];
        const isSelected = selectedNode?.id === node.id;
        const isNodeInactive = node.status === 'inactive' && node.type !== 'group';

        const distinctItems = node.stats?.itemCount || 0;

        return (
          <div key={node.id} className="flex flex-col select-none">
            {/* Tree Node Row */}
            <div
              onClick={() => setSelectedNode(node)}
              className={`
                group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer mb-1 border
                ${isSelected
                  ? 'bg-blue-50/90 text-blue-950 border-blue-300 shadow-xs font-bold ring-2 ring-blue-500/20'
                  : isNodeInactive
                    ? 'text-slate-400 bg-slate-50/40 border-transparent hover:bg-slate-100/60 opacity-60'
                    : 'text-slate-700 bg-white border-transparent hover:bg-slate-50 hover:border-slate-200/60 hover:text-slate-900'}
              `}
              style={{ paddingRight: `${depth * 14 + 10}px` }}
            >
              <div className="flex items-center gap-2 min-w-0">
                {hasChildren ? (
                  <button
                    onClick={(e) => toggleExpand(node.id, e)}
                    className="p-1 rounded-md hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronLeft size={14} />}
                  </button>
                ) : (
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-blue-600 ring-2 ring-blue-300' : isNodeInactive ? 'bg-slate-300' : 'bg-slate-400'}`}></span>
                  </div>
                )}

                <div className="flex items-center gap-1.5 truncate">
                  <div className={`p-1 rounded-lg ${isSelected ? 'bg-white shadow-2xs' : 'bg-slate-100/70'}`}>
                    {getNodeIcon(node.type, 14)}
                  </div>
                  <span className={`truncate text-xs ${isSelected ? 'font-black text-blue-950' : 'text-slate-800'}`}>
                    {node.name}
                  </span>
                  {isNodeInactive && (
                    <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      معطل
                    </span>
                  )}
                </div>
              </div>

              {/* Node Stats Pill + Add Child Button */}
              <div className="flex items-center gap-1.5 flex-shrink-0 mr-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${isSelected
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                    : 'bg-slate-100 text-slate-600 border-slate-200/60 group-hover:bg-white'
                  }`}>
                  {distinctItems > 0
                    ? `${distinctItems} صنف`
                    : (hasChildren ? `${node.children?.length} فروع` : '0 صنف')}
                </span>
                {/* + Add Child Node Button — shown only for non-group nodes */}
                {node.type !== 'group' && isGlobalAdmin && (
                  <button
                    onClick={(e) => handleAddChild(e, node)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white border border-emerald-200 hover:border-emerald-600 transition-all cursor-pointer"
                    title={`إضافة مخزن فرعي تحت ${node.name}`}
                  >
                    <Plus size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Children Subtree */}
            {hasChildren && isExpanded && (
              <div className="flex flex-col border-r border-slate-200/80 mr-3 pr-1">
                {buildTreeElements(node.children!, depth + 1)}
              </div>
            )}
          </div>
        );
      });
    };

    return buildTreeElements(filtered);
  };

  if (loading) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center gap-3">
        <Loader size="lg" label="جاري استرجاع شجرة المخازن والهيكل التنظيمي..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">

      {/* ── Top Executive Breadcrumb & Scope Header ───────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-sm">
            <FolderTree size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">الهيكل التنظيمي والمستودعات</h1>
              <Badge variant="info">الشجرة المعتمدة</Badge>
            </div>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              متابعة توزيع العهد ومستلزمات الإسكان في الفنادق الرئيسية والمغسلة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchHierarchy}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            تحديث البيانات
          </button>
        </div>
      </div>

      {/* ── Main Two-Column Layout ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ── Right Column: Hierarchical Explorer Tree (4 cols) ─────────── */}
        <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl flex flex-col h-[780px] shadow-xs overflow-hidden">

          {/* Tree Header & Search */}
          <div className="p-4 border-b border-slate-100 space-y-3 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <Layers size={14} className="text-blue-600" />
                شجرة الوحدات والمخازن
              </span>
              <span className="text-[11px] font-bold text-slate-400">
                {hierarchy.length} مجموعات
              </span>
            </div>

            <div className="relative">
              <Search size={15} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن مخزن أو فندق..."
                className="w-full pr-9 pl-3 py-2 bg-white border border-slate-200 text-xs rounded-xl placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <span className="font-semibold text-slate-600">إظهار الوحدات المعطلة</span>
              </label>
            </div>
          </div>

          {/* Tree List Viewport */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {renderTree(hierarchy)}
          </div>

          {/* Tree Footer Scope Note */}
          <div className="p-3 bg-slate-50/80 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <ShieldCheck size={13} className="text-emerald-600" />
              ربط مباشر مع Comsys
            </span>
            <span className="font-mono">FHtlPTrain</span>
          </div>
        </div>

        {/* ── Left Column: Detailed Active Hub Management (8 cols) ────────── */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {selectedNode ? (
            <>
              {/* 1. Selected Hub Hero Banner */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs relative overflow-hidden">
                <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500" />

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center flex-shrink-0 shadow-2xs">
                      {getNodeIcon(selectedNode.type, 28)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="text-xl font-black text-slate-900 leading-tight">
                          {selectedNode.name}
                        </h2>
                        <Badge variant={selectedNode.status === 'active' ? 'success' : 'neutral'}>
                          {selectedNode.status === 'active' ? 'نشط تشغيلياً' : 'معطل'}
                        </Badge>
                        {selectedNode.id === '6' && (
                          <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-lg">
                            كود كومسيس: 109
                          </span>
                        )}
                        {selectedNode.id === '11' && (
                          <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-lg">
                            كود كومسيس: 106
                          </span>
                        )}
                        {selectedNode.id === '29' && (
                          <span className="text-[11px] font-bold text-cyan-700 bg-cyan-50 border border-cyan-200/80 px-2 py-0.5 rounded-lg">
                            كود كومسيس: 136
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-semibold mt-1.5 flex items-center gap-2">
                        <span>{getNodeTypeName(selectedNode.type)}</span>
                        <span>•</span>
                        <span>المدير المسؤول: <strong className="text-slate-800">{selectedNode.manager || 'أمين المستودع الرئيسي'}</strong></span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start md:self-auto">
                    <span className="text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl">
                      معرف العقدة: #{selectedNode.id}
                    </span>
                  </div>
                </div>

                {/* Warning if inactive */}
                {selectedNode.status === 'inactive' && (
                  <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-900 p-3.5 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle size={18} className="text-amber-600 flex-shrink-0" />
                    <span>هذا المستودع معطل ولا يستقبل تحويلات جديدة أو حركات جرد حالياً.</span>
                  </div>
                )}
              </div>

              {/* 2. Key Metrics 4-Grid Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="border-slate-200/80 bg-white">
                  <Card.Body className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-slate-400">الرصيد الفعلي المتاح</span>
                      <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                        <Package size={16} />
                      </div>
                    </div>
                    <div className="text-xl font-black text-slate-900">
                      {Math.round(totalOperationalQty).toLocaleString()}
                      <span className="text-xs font-medium text-slate-400 mr-1.5">وحدة</span>
                    </div>
                    <span className="text-[10px] text-blue-600 font-bold block mt-1">
                      {activeItemsCount} صنف برصيد متاح
                    </span>
                  </Card.Body>
                </Card>

                <Card className="border-slate-200/80 bg-white">
                  <Card.Body className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-slate-400">أنواع الأصناف</span>
                      <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                        <Boxes size={16} />
                      </div>
                    </div>
                    <div className="text-xl font-black text-slate-900">
                      {nodeInventory.length}
                      <span className="text-xs font-medium text-slate-400 mr-1.5">صنف مسجل</span>
                    </div>
                    <span className="text-[10px] text-indigo-600 font-bold block mt-1">
                      مستلزمات الغرف والنزلاء
                    </span>
                  </Card.Body>
                </Card>

                <Card className="border-slate-200/80 bg-white">
                  <Card.Body className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-slate-400">الوحدات التابعة</span>
                      <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                        <Layers size={16} />
                      </div>
                    </div>
                    <div className="text-xl font-black text-slate-900">
                      {selectedNode.children ? selectedNode.children.length : 0}
                      <span className="text-xs font-medium text-slate-400 mr-1.5">أدوار / فروع</span>
                    </div>
                    <span className="text-[10px] text-emerald-600 font-bold block mt-1">
                      مواقع التوزيع الداخلي
                    </span>
                  </Card.Body>
                </Card>

                <Card className="border-slate-200/80 bg-white">
                  <Card.Body className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-slate-400">حركات التحويل</span>
                      <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600 border border-purple-100">
                        <ArrowLeftRight size={16} />
                      </div>
                    </div>
                    <div className="text-xl font-black text-slate-900">
                      {transfersCount}
                      <span className="text-xs font-medium text-slate-400 mr-1.5">حركة</span>
                    </div>
                    <span className="text-[10px] text-purple-600 font-bold block mt-1 truncate">
                      {lastMovement}
                    </span>
                  </Card.Body>
                </Card>
              </div>

              {/* 3. Interactive Detail Panel with Tabs */}
              <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">

                {/* Navigation Tabs Header */}
                <div className="flex items-center justify-between px-6 pt-4 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('inventory')}
                      className={`px-4 py-2.5 text-xs font-black rounded-t-xl transition-all cursor-pointer border-b-2 flex items-center gap-2 ${activeTab === 'inventory'
                          ? 'border-blue-600 text-blue-700 bg-white shadow-xs'
                          : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/50'
                        }`}
                    >
                      <Boxes size={15} />
                      أصناف المستودع المتوفرة ({nodeInventory.length})
                    </button>

                    {selectedNode.children && selectedNode.children.length > 0 && (
                      <button
                        onClick={() => setActiveTab('subunits')}
                        className={`px-4 py-2.5 text-xs font-black rounded-t-xl transition-all cursor-pointer border-b-2 flex items-center gap-2 ${activeTab === 'subunits'
                            ? 'border-blue-600 text-blue-700 bg-white shadow-xs'
                            : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/50'
                          }`}
                      >
                        <Layers size={15} />
                        الوحدات والأدوار التابعة ({selectedNode.children.length})
                      </button>
                    )}
                  </div>
                </div>

                {/* Tab 1: Inventory Table */}
                {activeTab === 'inventory' && (
                  <div className="p-5 space-y-4">
                    {/* Search & Actions Bar */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="relative w-full sm:w-80">
                        <Search size={15} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          value={itemSearchQuery}
                          onChange={(e) => setItemSearchQuery(e.target.value)}
                          placeholder="ابحث باسم الصنف أو الكود..."
                          className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 text-xs font-medium rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <span>عرض:</span>
                          <select
                            value={pageSize}
                            onChange={(e) => {
                              setPageSize(Number(e.target.value));
                              setCurrentPage(1);
                            }}
                            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
                          >
                            <option value={25}>25 صنف</option>
                            <option value={50}>50 صنف</option>
                            <option value={100}>100 صنف</option>
                          </select>
                        </div>
                        <span className="text-xs text-slate-400 font-bold">
                          إجمالي: {filteredInventory.length} صنف
                        </span>
                      </div>
                    </div>

                    {loadingNodeData ? (
                      <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                        <Loader size="md" label="جاري تحميل أصناف المخزن..." />
                      </div>
                    ) : filteredInventory.length === 0 ? (
                      <div className="py-16 text-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                        <Package size={32} className="mx-auto text-slate-300 mb-2" />
                        <span className="text-xs font-bold block">لا توجد أصناف تطابق البحث في هذا المستودع</span>
                      </div>
                    ) : (
                      <>
                        <div className="overflow-x-auto rounded-xl border border-slate-200/90 shadow-2xs">
                          <table className="w-full text-right text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-black divide-x divide-x-reverse divide-slate-200/80">
                                <th className="py-3 px-4 w-28">كود الصنف</th>
                                <th className="py-3 px-4">اسم الصنف والتصنيف</th>
                                <th className="py-3 px-4 w-24">الوحدة</th>
                                <th className="py-3 px-4 text-center w-32">الرصيد المتاح</th>
                                <th className="py-3 px-4 text-center w-28">المستلم</th>
                                <th className="py-3 px-4 text-center w-28">المحول</th>
                                <th className="py-3 px-4 text-center w-28">الحالة</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/80 bg-white">
                              {paginatedInventory.map((item, idx) => {
                                const isPositive = (item.qty_operational || 0) > 0;
                                return (
                                  <tr
                                    key={`${item.item_code}-${idx}`}
                                    className="odd:bg-white even:bg-slate-50/50 hover:bg-blue-50/60 transition-colors divide-x divide-x-reverse divide-slate-200/80"
                                  >
                                    <td className="py-3.5 px-4 font-mono font-bold text-slate-700 bg-slate-50/30">
                                      {item.item_code}
                                    </td>
                                    <td className="py-3.5 px-4">
                                      <div className="font-extrabold text-slate-900 leading-tight">
                                        {item.item_name_ar}
                                      </div>
                                      <div className="text-[10px] text-slate-400 mt-0.5">
                                        {item.category || 'مستلزمات تشغيلية'}
                                      </div>
                                    </td>
                                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                                      {item.unit || 'وحدة'}
                                    </td>
                                    <td className="py-3.5 px-4 text-center font-black text-sm">
                                      <span className={isPositive ? 'text-blue-700' : 'text-slate-400'}>
                                        {Number(item.qty_operational || 0).toLocaleString()}
                                      </span>
                                    </td>
                                    <td className="py-3.5 px-4 text-center text-slate-500 font-semibold">
                                      {Number(item.qty_received || 0).toLocaleString()}
                                    </td>
                                    <td className="py-3.5 px-4 text-center text-slate-500 font-semibold">
                                      {Number(item.qty_transfers || 0).toLocaleString()}
                                    </td>
                                    <td className="py-3.5 px-4 text-center">
                                      {isPositive ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                          <CheckCircle2 size={11} />
                                          متوفر
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                          نفد الرصيد
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Pagination Footer */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs select-none">
                          <span className="text-slate-500 font-semibold">
                            عرض {filteredInventory.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredInventory.length)} من أصل {filteredInventory.length} صنف
                          </span>

                          <div className="flex items-center gap-1.5">
                            <button
                              disabled={currentPage === 1}
                              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            >
                              السابق
                            </button>

                            <span className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 font-black rounded-lg text-xs">
                              صفحة {currentPage} من {totalPages}
                            </span>

                            <button
                              disabled={currentPage >= totalPages}
                              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            >
                              التالي
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Tab 2: Child Units Grid */}
                {activeTab === 'subunits' && selectedNode.children && (
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {selectedNode.children.map((child) => (
                        <div
                          key={child.id}
                          onClick={() => setSelectedNode(child)}
                          className="p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-xs transition-all cursor-pointer bg-white group"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 rounded-xl bg-slate-50 group-hover:bg-blue-50 text-slate-700 group-hover:text-blue-600 transition-colors border border-slate-100">
                                {getNodeIcon(child.type, 18)}
                              </div>
                              <div>
                                <h4 className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                                  {child.name}
                                </h4>
                                <span className="text-[11px] text-slate-400 font-medium">
                                  {getNodeTypeName(child.type)}
                                </span>
                              </div>
                            </div>
                            <Badge variant={child.status === 'active' ? 'success' : 'neutral'}>
                              {child.status === 'active' ? 'نشط' : 'معطل'}
                            </Badge>
                          </div>

                          <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-100">
                            <span className="text-slate-400 font-bold">الرصيد الفعلي:</span>
                            <span className="font-black text-slate-900">
                              {Math.round(child.stats?.operationalInventory || 0).toLocaleString()} وحدة
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tab 3: Transactions Feed */}
                {activeTab === 'transactions' && (
                  <div className="p-5 space-y-3">
                    {nodeTransactions.length === 0 ? (
                      <div className="py-16 text-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                        <Activity size={32} className="mx-auto text-slate-300 mb-2" />
                        <span className="text-xs font-bold block">لا توجد حركات تحويل سابقة مسجلة لهذه الوحدة</span>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden">
                        {nodeTransactions.map((tx) => (
                          <div key={tx.txnId} className="flex items-center justify-between p-3.5 hover:bg-slate-50/80 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                                <ArrowLeftRight size={14} />
                              </div>
                              <div className="text-right">
                                <span className="text-xs font-extrabold text-slate-900 block">
                                  {tx.notes || 'عملية تحويل مخزني'}
                                </span>
                                <span className="text-[10px] text-slate-400 mt-0.5 block">
                                  {formatDateTime(tx.createdAt)} • بواسطة {tx.createdBy}
                                </span>
                              </div>
                            </div>

                            <div className="text-left flex items-center gap-3">
                              <span className="text-xs font-black text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg">
                                {tx.quantity ? `${tx.quantity} ${tx.unit || 'وحدة'}` : `#${tx.txnId}`}
                              </span>
                              <Badge variant={tx.status === 'completed' ? 'success' : 'neutral'}>
                                {tx.status === 'completed' ? 'مكتمل' : tx.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            </>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-slate-400 bg-white border border-slate-200/80 rounded-2xl p-12">
              <FolderTree size={48} className="text-slate-300 mb-3" />
              <h3 className="text-base font-bold text-slate-700">اختر وحدة من الهيكل التنظيمي</h3>
              <p className="text-xs text-slate-400 mt-1">
                انقر على أي فندق أو مستودع فرعي من الشجرة في الجانب الأيمن لاستعراض تفاصيله وأرصدته
              </p>
            </div>
          )}
        </div>

      </div>

      {/* ── Add Child Node Modal ─────────────────────────────────────────── */}
      {addNodeParent && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="bg-emerald-700 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center shadow-xs">
                  <Plus size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold">إضافة وحدة / مخزن فرعي</h2>
                  <p className="text-xs text-emerald-200 mt-0.5">تحت: <span className="font-bold text-white">{addNodeParent.name}</span></p>
                </div>
              </div>
              <button
                onClick={() => setAddNodeParent(null)}
                className="p-1.5 rounded-lg text-emerald-300 hover:text-white hover:bg-emerald-600 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveNewNode} className="p-6 flex flex-col gap-4">
              {saveNodeError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3.5 py-2.5 rounded-xl flex items-center gap-2">
                  <AlertCircle size={14} />
                  {saveNodeError}
                </div>
              )}

              {/* Node Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black text-slate-800">اسم الوحدة / المخزن (بالعربي) *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newNodeName}
                  onChange={(e) => setNewNodeName(e.target.value)}
                  placeholder="مثال: مخزن الطابق الثالث، مطبخ الوجبات الخفيفة..."
                  className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>



              {/* Laundry Access */}
              <label className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={newNodeLaundry}
                  onChange={(e) => setNewNodeLaundry(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">لديه صلاحية البياضات والمغسلة</span>
                  <span className="text-[10px] text-slate-500">فعّل هذا إذا كانت الوحدة ستتعامل مع بياضات وطلبات الغسيل</span>
                </div>
              </label>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 mt-1">
                <button
                  type="button"
                  onClick={() => setAddNodeParent(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingNode || !newNodeName.trim()}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {isSavingNode ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      جاري الحفظ...
                    </>
                  ) : (
                    <>
                      <Plus size={14} />
                      إضافة الوحدة
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
