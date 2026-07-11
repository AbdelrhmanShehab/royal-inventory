export interface AppUser {
  id: number;
  user_id?: number;
  username: string;
  fullNameAr?: string;
  full_name_ar?: string;
  role:
    | "admin"
    | "manager"
    | "warehouse_manager"
    | "warehouse_head"
    | "accountant"
    | "staff";
  nodeId?: number | null;
  node_id?: number | null;
  nodeIds?: number[];
  is_active?: boolean;
  isActive?: boolean;
  last_login_at?: string | null;
  permissions?: string[];
}

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'manager' | 'warehouse_manager' | 'warehouse_head' | 'accountant' | 'staff';
  unitId?: string;
  unitName?: string;
  status: 'active' | 'inactive';
  email?: string;
  permissions?: string[];
}