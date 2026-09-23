export interface Warehouse {
  id: string; // Canonical node ID as string for compatibility
  nodeId: number; // Canonical numeric node_id
  name: string; // Arabic name (node_name_ar)
  nameEn?: string | null;
  nodeType: 'parent' | 'child'; // 'parent' for hotel/entity, 'child' for warehouse
  parentNodeId: number | null; // ID of parent entity (Hotel / Complex)
  parentName?: string; // Resolved name of parent entity
  groupId: number; // ID of hotel group
  groupName?: string; // Resolved name of hotel group
  division: 'fb' | 'gs'; // Food & Beverage or General Stores
  manager: string; // Manager name (for backward compatibility)
  managerName?: string; // Manager name
  managerUserId?: number; // Linked user ID if assigned
  comsysStoreCode?: string | null; // Linked COMSYS store code
  hasLaundryAccess: boolean; // Linen/laundry eligibility
  capacity: number; // Max capacity if defined
  currentStock: number; // Current quantity of items in stock from DB
  status: 'active' | 'inactive';
  isActive: boolean;
  location?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateWarehousePayload {
  nodeNameAr: string;
  nodeType: 'parent' | 'child';
  parentNodeId?: number | null;
  groupId: number;
  division?: 'fb' | 'gs';
  managerName?: string | null;
  comsysStoreCode?: string | null;
  hasLaundryAccess?: boolean;
  isActive?: boolean;
}

export interface UpdateWarehousePayload {
  nodeNameAr: string;
  nodeType: 'parent' | 'child';
  parentNodeId?: number | null;
  division?: 'fb' | 'gs';
  managerName?: string | null;
  comsysStoreCode?: string | null;
  hasLaundryAccess?: boolean;
  isActive: boolean;
}

export interface HotelGroup {
  id: number;
  groupNameAr: string;
  groupNameEn?: string | null;
  groupCode: string;
  isActive: boolean;
  createdAt?: string;
}

export interface ComsysWarehouse {
  id: number;
  storeCode: string;
  storeNameAr: string;
  storeNameEn?: string | null;
  division: 'fb' | 'gs';
  isActive: boolean;
  syncedAt?: string;
}

