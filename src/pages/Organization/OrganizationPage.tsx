import { useState, useEffect } from 'react';
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
  User, 
  Layers, 
  ArrowLeftRight, 
  Activity,
  Package
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Loader from '../../components/ui/Loader';
import { hierarchyApi } from '../../api/hierarchy.api';
import type { StockItem } from '../../types/inventory';
import { transactionsApi } from '../../api/transactions.api';
import type { OrganizationNode } from '../../types/hierarchy';
import type { TransferTransaction } from '../../types/transaction';

export default function OrganizationPage() {
  const [hierarchy, setHierarchy] = useState<OrganizationNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<OrganizationNode | null>(null);
  const [nodeInventory, setNodeInventory] = useState<StockItem[]>([]);
  const [nodeTransactions, setNodeTransactions] = useState<TransferTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Expand States
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Fetch initial hierarchy
  useEffect(() => {
    const fetchHierarchy = async () => {
      try {
        const data = await hierarchyApi.getTree();
        setHierarchy(data);
        if (data.length > 0) {
          // Select first root node by default
          setSelectedNode(data[0]);
          // Expand first node children by default
          setExpandedNodes({ [data[0].id]: true });
        }
      } catch (err) {
        console.error('Error fetching tree:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHierarchy();
  }, []);

  // Fetch node specific data when selectedNode changes
  useEffect(() => {
    if (!selectedNode) return;
    const fetchNodeDetails = async () => {
      try {
        // Fetch node stock
        const stock = await hierarchyApi.getNodeStock(selectedNode.id);
        setNodeInventory(stock || []);

        // Fetch all transfers and filter for this node
        const allTransfers = await transactionsApi.getTransfers();
        const filteredTxs = allTransfers.filter(
          tx => String(tx.fromNodeId) === String(selectedNode.id) || String(tx.toNodeId) === String(selectedNode.id)
        );
        setNodeTransactions(filteredTxs);
      } catch (err) {
        console.error('Error fetching node details:', err);
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

  // Helper: Node Icons mapping
  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'group': return <Building2 size={16} className="text-blue-600" />;
      case 'hotel': return <Hotel size={16} className="text-indigo-600" />;
      case 'kitchen': return <ChefHat size={16} className="text-amber-600" />;
      case 'bar': return <Wine size={16} className="text-rose-600" />;
      case 'restaurant': return <UtensilsCrossed size={16} className="text-teal-600" />;
      case 'housing': return <Home size={16} className="text-slate-600" />;
      default: return <Layers size={16} className="text-slate-400" />;
    }
  };

  const getNodeTypeName = (type: string) => {
    switch (type) {
      case 'group': return 'مجموعة تشغيلية';
      case 'hotel': return 'فرع فندقي';
      case 'kitchen': return 'مطبخ تشغيلي';
      case 'bar': return 'ركن مشروبات / بار';
      case 'restaurant': return 'مطعم عائلي';
      case 'housing': return 'سكن ومبيت ضيوف';
      default: return 'قسم تشغيلي';
    }
  };

  // Sort stock items to find most consumed (descending by qty_consumed)
  const mostConsumed = [...nodeInventory]
    .filter(item => item.qty_consumed && item.qty_consumed > 0)
    .sort((a, b) => b.qty_consumed - a.qty_consumed)
    .slice(0, 5);

  const getLeafNodesCount = (node: OrganizationNode): number => {
    if (!node.children || node.children.length === 0) {
      return 0;
    }
    let count = 0;
    const recurse = (n: OrganizationNode) => {
      if (!n.children || n.children.length === 0) {
        count++;
      } else {
        n.children.forEach(recurse);
      }
    };
    node.children.forEach(recurse);
    return count;
  };

  const getLeafItemsCount = (node: OrganizationNode): number => {
    if (!node.children || node.children.length === 0) {
      return node.stats?.itemCount || 0;
    }
    return node.children.reduce((sum, child) => sum + getLeafItemsCount(child), 0);
  };

  // Recursive Tree Render
  const renderTree = (nodes: OrganizationNode[]) => {
    // Filter nodes based on search query
    const filterTree = (list: OrganizationNode[]): OrganizationNode[] => {
      return list
        .map(node => ({
          ...node,
          children: node.children ? filterTree(node.children) : undefined
        }))
        .filter(node => 
          node.name.includes(searchQuery) || 
          (node.children && node.children.length > 0)
        );
    };

    const filtered = filterTree(nodes);

    const buildTreeElements = (list: OrganizationNode[], depth = 0) => {
      return list.map(node => {
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = !!expandedNodes[node.id];
        const isSelected = selectedNode?.id === node.id;

        return (
          <div key={node.id} className="flex flex-col select-none">
            {/* Tree Row */}
            <div 
              onClick={() => setSelectedNode(node)}
              className={`
                flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer group mb-1
                ${isSelected 
                  ? 'bg-blue-50 text-blue-700 font-bold border-r-4 border-blue-600' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
              `}
              style={{ paddingRight: `${depth * 16 + 12}px` }}
            >
              <div className="flex items-center gap-2">
                {hasChildren ? (
                  <button 
                    onClick={(e) => toggleExpand(node.id, e)}
                    className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronLeft size={14} />}
                  </button>
                ) : (
                  <div className="w-6 h-6 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {getNodeIcon(node.type)}
                  <span>{node.name}</span>
                </div>
              </div>

              {node.stats && (
                <span className="text-[10px] bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-full group-hover:bg-white transition-colors">
                  {hasChildren 
                    ? `${getLeafNodesCount(node)} مخزن • ${getLeafItemsCount(node)} صنف` 
                    : `${node.stats.itemCount} صنف`
                  }
                </span>
              )}
            </div>

            {/* Render Children */}
            {hasChildren && isExpanded && (
              <div className="flex flex-col">
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
      <div className="h-full flex items-center justify-center">
        <Loader size="lg" label="جاري تحميل الهيكل التنظيمي..." />
      </div>
    );
  }

  // Calculate stats
  const totalOperationalQty = nodeInventory.reduce((sum, item) => sum + (item.qty_operational || 0), 0);
  const itemCount = nodeInventory.length;
  const transfersCount = nodeTransactions.length;
  const lastMovement = nodeTransactions.length > 0 
    ? new Date(nodeTransactions[0].createdAt).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'لا توجد حركات';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-[calc(100vh-120px)] overflow-hidden">
      
      {/* LEFT SIDEBAR: Hierarchical Explorer Tree */}
      <div className="lg:col-span-1 bg-white border border-slate-200/80 rounded-2xl flex flex-col h-full overflow-hidden shadow-xs">
        {/* Tree Search Box */}
        <div className="p-4 border-b border-slate-100">
          <div className="relative flex items-center">
            <Search size={16} className="absolute right-3 text-slate-400 pointer-events-none" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في الوحدات..." 
              className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 text-xs rounded-lg placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Tree scroll viewport */}
        <div className="flex-1 overflow-y-auto p-3">
          {renderTree(hierarchy)}
        </div>
      </div>

      {/* RIGHT CONTENT PANEL: Selected Node Information */}
      <div className="lg:col-span-3 flex flex-col gap-6 h-full overflow-y-auto pr-1">
        {selectedNode ? (
          <>
            {/* 1. Header Information Block */}
            <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 select-none">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                  {getNodeIcon(selectedNode.type)}
                </div>
                <div className="flex flex-col text-right">
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-extrabold text-slate-800">{selectedNode.name}</h1>
                    <Badge variant={selectedNode.status === 'active' ? 'success' : 'neutral'}>
                      {selectedNode.status === 'active' ? 'نشط' : 'غير نشط'}
                    </Badge>
                  </div>
                  <span className="text-xs text-slate-400 mt-1 font-semibold">
                    {getNodeTypeName(selectedNode.type)}
                  </span>
                </div>
              </div>

              {/* Manager & Status detail */}
              <div className="flex items-center gap-4 bg-slate-50 border border-slate-100 px-4 py-2.5 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-blue-100/50 text-blue-600 flex items-center justify-center">
                  <User size={16} />
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[10px] text-slate-400 font-bold">المدير المسؤول</span>
                  <span className="text-xs font-bold text-slate-700 mt-0.5">{selectedNode.manager || 'غير معين'}</span>
                </div>
              </div>
            </div>

            {/* 2. Statistics Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'الرصيد التشغيلي', value: totalOperationalQty.toLocaleString() || 0, icon: Package, color: 'text-blue-600' },
                { label: 'عدد الأصناف', value: itemCount, icon: Layers, color: 'text-indigo-600' },
                { label: 'التحويلات والحركات', value: transfersCount, icon: ArrowLeftRight, color: 'text-purple-600' },
                { label: 'آخر حركة مخزنية', value: lastMovement, icon: Activity, color: 'text-emerald-600' }
              ].map((stat, idx) => (
                <Card key={idx} className="border-slate-200/60">
                  <Card.Body className="p-4 flex items-center gap-3">
                    <div className={`p-2 bg-slate-50 border border-slate-100 rounded-lg ${stat.color}`}>
                      <stat.icon size={18} />
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-[10px] font-bold text-slate-400 leading-none">{stat.label}</span>
                      <span className="text-xs font-extrabold text-slate-800 mt-1">{stat.value}</span>
                    </div>
                  </Card.Body>
                </Card>
              ))}
            </div>

            {/* 3. Child Units Section (Render direct child nodes if group/hotel) */}
            {selectedNode.children && selectedNode.children.length > 0 && (
              <div className="flex flex-col gap-4">
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Layers size={16} className="text-blue-600" />
                  الوحدات التشغيلية الفرعية ({selectedNode.children.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedNode.children.map((child) => (
                    <Card 
                      key={child.id} 
                      hoverable 
                      className="cursor-pointer border-slate-200/60"
                      onClick={() => setSelectedNode(child)}
                    >
                      <Card.Body className="p-4 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center">
                            {getNodeIcon(child.type)}
                          </div>
                          <div className="flex flex-col text-right">
                            <span className="text-xs font-bold text-slate-800">{child.name}</span>
                            <span className="text-[10px] text-slate-400 mt-0.5 leading-none">{getNodeTypeName(child.type)}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-extrabold text-blue-600 bg-blue-50/50 px-2.5 py-1 rounded-md">
                            {child.stats?.operationalInventory.toLocaleString() || 0} وحدة
                          </span>
                          <span className="text-[9px] text-slate-400 font-semibold mt-1">آخر حركة: {child.stats?.lastMovement || 'لا يوجد'}</span>
                        </div>
                      </Card.Body>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Inventory List & Recent Transactions Split Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              
              {/* Node Inventory List */}
              <div className="flex flex-col gap-3 xl:col-span-1">
                <h3 className="text-sm font-bold text-slate-800">الأصناف الحالية بالوحدة ({nodeInventory.length})</h3>
                <Card className="border-slate-200/60 max-h-[320px] overflow-y-auto">
                  <Card.Body className="p-0">
                    {nodeInventory.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">لا يوجد مخزون مسجل حالياً لهذه الوحدة</div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {nodeInventory.map((item) => (
                          <div key={item.item_code} className="flex justify-between items-center p-3 hover:bg-slate-50/50">
                            <div className="flex flex-col text-right">
                              <span className="text-xs font-bold text-slate-800">{item.item_name_ar}</span>
                              <span className="text-[9px] text-slate-400 mt-0.5">{item.item_code}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-extrabold text-slate-800">{item.qty_operational} {item.unit || 'وحدة'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </div>

              {/* Most Consumed Items */}
              <div className="flex flex-col gap-3 xl:col-span-1">
                <h3 className="text-sm font-bold text-slate-800">الأصناف الأكثر استهلاكاً</h3>
                <Card className="border-slate-200/60 max-h-[320px] overflow-y-auto">
                  <Card.Body className="p-0">
                    {mostConsumed.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">لا توجد أصناف مستهلكة مسجلة</div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {mostConsumed.map((item) => (
                          <div key={item.item_code} className="flex justify-between items-center p-3 hover:bg-slate-50/50">
                            <div className="flex flex-col text-right">
                              <span className="text-xs font-bold text-slate-800">{item.item_name_ar}</span>
                              <span className="text-[9px] text-slate-400 mt-0.5">{item.item_code}</span>
                            </div>
                            <span className="text-xs font-extrabold text-rose-600">
                              {item.qty_consumed} {item.unit || 'وحدة'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </div>

              {/* Node Recent Transactions */}
              <div className="flex flex-col gap-3 xl:col-span-1">
                <h3 className="text-sm font-bold text-slate-800">الحركات الأخيرة بالوحدة ({nodeTransactions.length})</h3>
                <Card className="border-slate-200/60 max-h-[320px] overflow-y-auto">
                  <Card.Body className="p-0">
                    {nodeTransactions.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">لا توجد حركات تشغيلية سابقة لهذه الوحدة</div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {nodeTransactions.slice(0, 5).map((tx) => (
                          <div key={tx.txnId} className="flex justify-between items-center p-3 hover:bg-slate-50/50">
                            <div className="flex flex-col text-right">
                              <span className="text-xs font-bold text-slate-800">{tx.notes || 'تحويل مخزني'}</span>
                              <span className="text-[9px] text-slate-400 mt-0.5">
                                {new Date(tx.createdAt).toLocaleDateString('ar-EG')} • بواسطة {tx.createdBy}
                              </span>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-xs font-extrabold text-slate-850">
                                {tx.quantity ? `${tx.quantity} ${tx.unit || ''}` : tx.referenceNo || `#${tx.txnId}`}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </div>

            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400">
            يرجى تحديد وحدة تشغيلية من الهيكل التنظيمي لعرض تفاصيلها.
          </div>
        )}
      </div>

    </div>
  );
}
