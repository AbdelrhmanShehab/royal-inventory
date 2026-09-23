import api from './axios';
import hierarchyApi from './hierarchy.api';
import type { 
  Warehouse, 
  CreateWarehousePayload, 
  UpdateWarehousePayload, 
  ComsysWarehouse 
} from '../types/warehouse';

export const warehousesApi = {
  // Fetch synced COMSYS stores for linking
  getComsysWarehouses: async (division?: 'fb' | 'gs'): Promise<ComsysWarehouse[]> => {
    try {
      const response = await api.get('/warehouses', {
        params: division ? { division } : {}
      });
      const data = response.data;
      if (Array.isArray(data)) {
        return data.map((wh: any) => ({
          id: wh.id,
          storeCode: String(wh.storeCode || wh.store_code || ''),
          storeNameAr: wh.storeNameAr || wh.store_name_ar || '',
          storeNameEn: wh.storeNameEn || wh.store_name_en || null,
          division: wh.division || 'fb',
          isActive: wh.isActive !== undefined ? Boolean(wh.isActive) : true,
          syncedAt: wh.syncedAt || wh.synced_at,
        }));
      }
      return [];
    } catch (error) {
      console.warn('COMSYS Warehouses API error:', error);
      return [];
    }
  },

  // Fetch canonical operational warehouses and parent entities from hierarchy tree
  getOperationalWarehouses: async (ignoreScope: boolean = true): Promise<{
    allWarehouses: Warehouse[];
    parentEntities: Warehouse[];
  }> => {
    try {
      const groups = await hierarchyApi.getRawTree(ignoreScope);
      const allWarehouses: Warehouse[] = [];
      const parentEntities: Warehouse[] = [];

      const processNode = (n: any, parentName: string | null, groupName: string) => {
        const warehouseObj: Warehouse = {
          id: String(n.id),
          nodeId: Number(n.id),
          name: n.nodeNameAr || n.name || 'مستودع بدون اسم',
          nameEn: n.nodeNameEn || n.nameEn || null,
          nodeType: n.nodeType || (n.parentNodeId === null ? 'parent' : 'child'),
          parentNodeId: n.parentNodeId ? Number(n.parentNodeId) : null,
          parentName: parentName || (n.nodeType === 'parent' ? '— كيان رئيسي —' : 'غير محدد'),
          groupId: Number(n.groupId),
          groupName: groupName,
          division: (n.division === 'gs' ? 'gs' : 'fb'),
          manager: n.managerName || n.manager || '—',
          managerName: n.managerName || n.manager || '',
          comsysStoreCode: n.comsysStoreCode || n.comsys_store_code || null,
          hasLaundryAccess: Boolean(n.hasLaundryAccess ?? n.has_laundry_access ?? false),
          capacity: 2000,
          currentStock: Number(n.totalStock || 0),
          status: (n.isActive === false || n.is_active === false) ? 'inactive' : 'active',
          isActive: n.isActive !== undefined ? Boolean(n.isActive) : (n.is_active !== undefined ? Boolean(n.is_active) : true),
        };

        if (n.nodeType === 'parent') {
          parentEntities.push(warehouseObj);
        }
        allWarehouses.push(warehouseObj);

        if (n.children && Array.isArray(n.children) && n.children.length > 0) {
          for (const child of n.children) {
            processNode(child, n.nodeNameAr || n.name, groupName);
          }
        }
      };

      for (const group of groups) {
        const groupName = group.groupNameAr || group.groupNameEn || 'مجموعة عامة';
        const rootNodes = group.nodes || [];
        for (const root of rootNodes) {
          processNode(root, null, groupName);
        }
      }

      return { allWarehouses, parentEntities };
    } catch (error) {
      console.error('Failed to fetch operational warehouses:', error);
      return { allWarehouses: [], parentEntities: [] };
    }
  },

  // Backward-compatible getWarehouses: returns flattened list of operational warehouses
  getWarehouses: async (): Promise<Warehouse[]> => {
    const { allWarehouses, parentEntities } = await warehousesApi.getOperationalWarehouses(true);
    if (allWarehouses.length > 0) {
      return allWarehouses;
    }
    // If no child warehouses found, return parent entities
    if (parentEntities.length > 0) {
      return parentEntities;
    }
    return [];
  },

  // Create warehouse under entity
  createWarehouse: async (payload: CreateWarehousePayload): Promise<{ id: number; message: string }> => {
    return hierarchyApi.createNode(payload);
  },

  // Update warehouse
  updateWarehouse: async (id: number | string, payload: UpdateWarehousePayload): Promise<{ message: string }> => {
    return hierarchyApi.updateNode(id, payload);
  },

  // Delete / deactivate warehouse
  deleteWarehouse: async (id: number | string): Promise<{ message: string }> => {
    return hierarchyApi.deleteNode(id);
  }
};

export default warehousesApi;

