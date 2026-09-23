import api from './axios';
import { masterDataApi } from './masterData.api';
import type { InventoryNode, OrganizationNode } from '../types/hierarchy';
import type { StockItem } from '../types/inventory';
import type { CreateWarehousePayload, UpdateWarehousePayload, HotelGroup } from '../types/warehouse';
import { getItemReorderLevel } from '../utils/reorderLevels';

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

let masterItemsCache: Map<string, { itemNameAr: string; unitNameAr?: string }> | null = null;
let masterItemsPromise: Promise<Map<string, { itemNameAr: string; unitNameAr?: string }>> | null = null;

export const getMasterItemsMap = async (): Promise<Map<string, { itemNameAr: string; unitNameAr?: string }>> => {
  if (masterItemsCache) return masterItemsCache;
  if (!masterItemsPromise) {
    masterItemsPromise = masterDataApi.getItems().then(items => {
      const map = new Map<string, { itemNameAr: string; unitNameAr?: string }>();
      (items || []).forEach((item: any) => {
        const code = String(item.itemCode || item.item_code || '').trim();
        if (code) {
          map.set(code, {
            itemNameAr: item.itemNameAr || item.item_name_ar || item.itemName || '',
            unitNameAr: item.unitNameAr || item.unit_name_ar || item.unit || '',
          });
        }
      });
      masterItemsCache = map;
      return map;
    }).catch(err => {
      console.warn('Failed to load master items for enrichment:', err);
      return new Map();
    });
  }
  return masterItemsPromise;
};

export const enrichStockItems = async (items: StockItem[]): Promise<StockItem[]> => {
  if (!items || items.length === 0) return items;
  const map = await getMasterItemsMap();
  return items.map(item => {
    const code = String(item.item_code).trim();
    const found = map.get(code);
    if (found && found.itemNameAr && (!item.item_name_ar || item.item_name_ar.startsWith('صنف '))) {
      return {
        ...item,
        item_name_ar: found.itemNameAr,
        unit: item.unit === 'وحدة' && found.unitNameAr ? found.unitNameAr : item.unit,
      };
    }
    return item;
  });
};

// Transform NodeStockItem -> StockItem
export const transformStockItem = (item: any): StockItem => {
  const code = String(item.itemCode || item.item_code || '').trim();
  const cached = masterItemsCache?.get(code);
  const extReceived = Number(item.qtyReceived !== undefined ? item.qtyReceived : (item.qty_received !== undefined ? item.qty_received : 0));
  const intIn = Number(item.qtyInternalIn !== undefined ? item.qtyInternalIn : (item.qty_internal_in !== undefined ? item.qty_internal_in : 0));
  const transfersOut = Number(item.qtyTransferredOut !== undefined ? item.qtyTransferredOut : (item.qty_transferred_out !== undefined ? item.qty_transferred_out : 0));
  const returnedOut = Number(item.qtyReturnedOut !== undefined ? item.qtyReturnedOut : (item.qty_returned_out !== undefined ? item.qty_returned_out : 0));
  const laundryQty = Number(item.qtyLaundry !== undefined ? item.qtyLaundry : (item.qty_laundry !== undefined ? item.qty_laundry : 0));

  const rawName = item.itemNameAr || item.item_name_ar || item.item_name_en;
  const resolvedName = (rawName && !rawName.startsWith('صنف ')) ? rawName : (cached?.itemNameAr || rawName || `صنف ${code}`);
  const resolvedUnit = item.unitNameAr || item.unit || cached?.unitNameAr || 'وحدة';

  return {
    item_code: code,
    item_name_ar: resolvedName,
    item_name_en: item.item_name_en || '',
    category: item.categoryCode || item.category || 'عام',
    unit: resolvedUnit,
    qty_operational: Number(item.qtyOperational !== undefined ? item.qtyOperational : (item.qty_operational !== undefined ? item.qty_operational : 0)),
    qty_received: extReceived + intIn,
    qty_transfers: transfersOut,
    qty_laundry: laundryQty,
    qty_consumed: Number(item.qtyConsumed !== undefined ? item.qtyConsumed : (item.qty_consumed !== undefined ? item.qty_consumed : 0)),
    qty_returned: returnedOut,
    qty_wasted: (Number(item.qtyWasted || 0) + Number(item.qtyDamaged || 0) + Number(item.qtyDisposed || 0)),
    avg_cost: Number(item.avg_cost || item.price || item.unit_cost || 0),
    total_value: Number(item.total_value || (Number(item.qtyOperational !== undefined ? item.qtyOperational : (item.qty_operational || 0)) * Number(item.avg_cost || item.price || item.unit_cost || 0))),
    reorder_level: getItemReorderLevel(
      code,
      item.reorder_level || item.minimum_qty || 0
    )
  };
};

// Filter hierarchy tree strictly for a user's assigned scope (removes other hotels/groups completely)
export const filterHierarchyForUserScope = (
  nodesList: OrganizationNode[], 
  targetNodeId: number
): OrganizationNode[] => {
  const findScopedSubtree = (list: OrganizationNode[]): OrganizationNode | null => {
    for (const node of list) {
      if (Number(node.id) === targetNodeId || String(node.id) === String(targetNodeId)) {
        return node;
      }
      if (node.children && node.children.length > 0) {
        const found = findScopedSubtree(node.children);
        if (found) return found;
      }
    }
    return null;
  };

  const result: OrganizationNode[] = [];
  for (const item of nodesList) {
    if (item.type === 'group' && item.children) {
      const found = findScopedSubtree(item.children);
      if (found) {
        result.push({
          ...item,
          children: [found]
        });
      }
    } else {
      if (Number(item.id) === targetNodeId || String(item.id) === String(targetNodeId)) {
        result.push(item);
      } else if (item.children && item.children.length > 0) {
        const found = findScopedSubtree(item.children);
        if (found) {
          result.push(found);
        }
      }
    }
  }

  return result.length > 0 ? result : [];
};

export const hierarchyApi = {
  getTree: async (options?: boolean | { ignoreScope?: boolean } | any): Promise<OrganizationNode[]> => {
    const ignoreScope = typeof options === 'boolean' ? options : (typeof options === 'object' && options !== null ? Boolean(options.ignoreScope) : false);
    const response = await api.get(`/hierarchy/tree${ignoreScope ? '?ignoreScope=true' : ''}`);
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
    let items: StockItem[] = [];
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const rawItems = data.items || [];
      items = rawItems.map(transformStockItem);
    } else if (Array.isArray(data)) {
      items = data.map(transformStockItem);
    }
    return enrichStockItems(items);
  },

  getStock: async (): Promise<StockItem[]> => {
    const response = await api.get('/hierarchy/stock');
    const data = response.data;
    let items: StockItem[] = [];
    if (Array.isArray(data)) {
      items = data.map(transformStockItem);
    }
    return enrichStockItems(items);
  },

  // Raw Tree with full entity & node metadata
  getRawTree: async (ignoreScope: boolean = true): Promise<any[]> => {
    const response = await api.get(`/hierarchy/tree${ignoreScope ? '?ignoreScope=true' : ''}`);
    return Array.isArray(response.data) ? response.data : [];
  },

  // Groups management
  getGroups: async (): Promise<HotelGroup[]> => {
    const response = await api.get('/hierarchy/groups');
    return Array.isArray(response.data) ? response.data : [];
  },

  // Node CRUD operations (real backend)
  createNode: async (payload: CreateWarehousePayload): Promise<{ id: number; message: string }> => {
    const response = await api.post('/hierarchy/nodes', payload);
    return response.data;
  },

  updateNode: async (id: number | string, payload: UpdateWarehousePayload): Promise<{ message: string }> => {
    const response = await api.put(`/hierarchy/nodes/${id}`, payload);
    return response.data;
  },

  deleteNode: async (id: number | string): Promise<{ message: string }> => {
    const response = await api.delete(`/hierarchy/nodes/${id}`);
    return response.data;
  }
};

export default hierarchyApi;
