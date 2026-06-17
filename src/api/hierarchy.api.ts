import api from './axios';
import type { InventoryNode, OrganizationNode } from '../types/hierarchy';
import type { StockItem } from '../types/inventory';

// Build a tree from a flat parent-child record structure (fallback if API is flat)
export const buildTree = (nodes: InventoryNode[]): InventoryNode[] => {
  const nodeMap = new Map<number, InventoryNode & { children: InventoryNode[] }>();
  
  // Initialize with empty children arrays
  nodes.forEach(node => {
    nodeMap.set(node.node_id, { ...node, children: [] });
  });

  const roots: InventoryNode[] = [];

  nodes.forEach(node => {
    const mappedNode = nodeMap.get(node.node_id)!;
    if (node.parent_node_id !== null && nodeMap.has(node.parent_node_id)) {
      const parent = nodeMap.get(node.parent_node_id)!;
      parent.children.push(mappedNode);
    } else {
      roots.push(mappedNode);
    }
  });

  return roots;
};

// Transform group DTO mapping to OrganizationNode
export const transformGroup = (group: any): OrganizationNode => {
  return {
    id: `group-${group.id}`,
    name: group.groupNameAr || group.groupNameEn || 'مجموعة غير معروفة',
    type: 'group',
    manager: 'مدير المجموعة',
    status: group.isActive ? 'active' : 'inactive',
    parentId: null,
    children: (group.nodes || []).map(transformNode),
    stats: {
      operationalInventory: 0,
      itemCount: 0,
      transfersCount: 0,
      lastMovement: '—'
    }
  };
};

// Transform InventoryNode -> OrganizationNode
export const transformNode = (node: any): OrganizationNode => {
  let mappedType: OrganizationNode['type'] = 'other';
  const nodeType = node.nodeType || node.node_type || 'child';
  const parentNodeId = node.parentNodeId !== undefined ? node.parentNodeId : (node.parent_node_id !== undefined ? node.parent_node_id : null);
  const division = node.division || 'fb';
  const id = node.id || node.node_id;
  const nodeNameAr = node.nodeNameAr || node.node_name_ar || 'وحدة غير معروفة';
  const managerName = node.managerName || node.manager_name || '—';
  const isActive = node.isActive !== undefined ? node.isActive : (node.is_active !== undefined ? node.is_active : true);

  if (nodeType === 'parent') {
    mappedType = parentNodeId === null ? 'hotel' : 'hotel';
  } else {
    mappedType = division === 'fb' ? 'kitchen' : 'warehouse';
  }

  const children = node.children ? node.children.map(transformNode) : [];

  return {
    id: String(id),
    name: nodeNameAr,
    type: mappedType,
    manager: managerName,
    status: isActive ? 'active' : 'inactive',
    parentId: parentNodeId ? String(parentNodeId) : null,
    children: children,
    stats: {
      operationalInventory: Number(node.totalStock || node.total_stock || 0),
      itemCount: children.length,
      transfersCount: 0,
      lastMovement: '—'
    }
  };
};

// Transform NodeStockItem -> StockItem
export const transformStockItem = (item: any): StockItem => {
  return {
    item_code: item.itemCode || item.item_code || '',
    item_name_ar: item.itemNameAr || item.item_name_ar || item.item_name_en || `صنف ${item.itemCode || item.item_code}`,
    item_name_en: item.item_name_en || '',
    category: item.categoryCode || item.category || 'عام',
    unit: item.unitNameAr || item.unit || 'وحدة',
    qty_operational: Number(item.qtyOperational !== undefined ? item.qtyOperational : (item.qty_operational !== undefined ? item.qty_operational : 0)),
    qty_received: Number(item.qtyReceived !== undefined ? item.qtyReceived : (item.qty_received !== undefined ? item.qty_received : 0)),
    qty_consumed: Number(item.qtyConsumed !== undefined ? item.qtyConsumed : (item.qty_consumed !== undefined ? item.qty_consumed : 0)),
    qty_wasted: Number(item.qtyWasted !== undefined ? item.qtyWasted : (item.qty_wasted !== undefined ? item.qty_wasted : (item.qtyDamaged || item.qty_damaged || 0))),
    avg_cost: Number(item.avg_cost || item.price || 15),
    total_value: Number(item.total_value || (Number(item.qtyOperational !== undefined ? item.qtyOperational : (item.qty_operational || 0)) * 15)),
    reorder_level: item.reorder_level || item.minimum_qty || 10
  };
};

export const hierarchyApi = {
  getTree: async (): Promise<OrganizationNode[]> => {
    const response = await api.get('/hierarchy/tree');
    let data = response.data;
    if (Array.isArray(data)) {
      const isGroupList = data.some(item => 'groupNameAr' in item);
      if (isGroupList) {
        return data.map(transformGroup);
      }

      const hasNested = data.some(n => n.children && n.children.length > 0);
      if (!hasNested && data.length > 1) {
        const snakeNodes: InventoryNode[] = data.map(n => ({
          node_id: Number(n.id || n.node_id),
          comsys_store_code: n.comsysStoreCode || n.comsys_store_code || null,
          group_id: Number(n.groupId || n.group_id),
          parent_node_id: n.parentNodeId !== undefined ? (n.parentNodeId !== null ? Number(n.parentNodeId) : null) : (n.parent_node_id !== undefined && n.parent_node_id !== null ? Number(n.parent_node_id) : null),
          node_name_ar: n.nodeNameAr || n.node_name_ar || '',
          node_type: n.nodeType || n.node_type || 'child',
          manager_name: n.managerName || n.manager_name || '',
          is_active: n.isActive !== undefined ? n.isActive : (n.is_active !== undefined ? n.is_active : true),
          division: n.division || 'fb',
          children: n.children || []
        }));
        data = buildTree(snakeNodes);
      }
      return data.map(transformNode);
    }
    return [];
  },

  getNode: async (id: string | number): Promise<OrganizationNode> => {
    const response = await api.get(`/hierarchy/nodes/${id}`);
    return transformNode(response.data);
  },

  getNodeStock: async (nodeId: string | number): Promise<StockItem[]> => {
    if (String(nodeId).startsWith('group-')) {
      return [];
    }
    const response = await api.get(`/hierarchy/nodes/${nodeId}/stock`);
    const data = response.data;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const items = data.items || [];
      return items.map(transformStockItem);
    } else if (Array.isArray(data)) {
      return data.map(transformStockItem);
    }
    return [];
  },

  getStock: async (): Promise<StockItem[]> => {
    const response = await api.get('/hierarchy/stock');
    const data = response.data;
    if (Array.isArray(data)) {
      return data.map(transformStockItem);
    }
    return [];
  }
};

export default hierarchyApi;
