export interface InventoryNode {
  node_id: number;
  comsys_store_code: string | null;
  group_id: number;
  parent_node_id: number | null;
  node_name_ar: string;
  node_type: "parent" | "child";
  manager_name: string;
  is_active: boolean;
  division: "fb" | "gs";
  children?: InventoryNode[];
}

export interface OrganizationNode {
  id: string;
  name: string;
  type:
    | 'group'
    | 'hotel'
    | 'kitchen'
    | 'bar'
    | 'restaurant'
    | 'housing'
    | 'warehouse'
    | 'other';

  manager?: string;
  status: 'active' | 'inactive';

  parentId?: string | null;
  children?: OrganizationNode[];

  stats?: {
    operationalInventory: number;
    itemCount: number;
    transfersCount: number;
    lastMovement: string;
  };
}