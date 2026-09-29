export type UserRole =
  | 'admin'
  | 'manager'
  | 'warehouse_manager'
  | 'warehouse_head'
  | 'accountant'
  | 'staff'
  | 'laundry_supervisor'
  | 'laundry_cashier'
  | 'uniform_clerk'
  | 'laundry_operator';

export interface AppUser {
  id: number;
  user_id?: number;
  username: string;
  fullNameAr?: string;
  full_name_ar?: string;
  role: UserRole;
  nodeId?: number | null;
  node_id?: number | null;
  nodeIds?: number[];
  is_active?: boolean;
  isActive?: boolean;
  last_login_at?: string | null;
  permissions?: string[];
}

export interface User {
  id: string | number;
  username: string;
  fullNameAr: string;
  role: UserRole;
  nodeId?: number | null;
  nodeIds?: number[];
  nodeNameAr?: string;
  unitId?: string;
  unitName?: string;
  status: 'active' | 'inactive';
  isActive: boolean;
  email?: string;
  permissions?: string[];
  createdAt?: string;
}

export interface CreateUserData {
  username: string;
  fullNameAr: string;
  password: string;
  role: UserRole;
  nodeId?: number | null;
  nodeIds?: number[];
  isActive?: boolean;
}

export interface UpdateUserData {
  fullNameAr: string;
  role: UserRole;
  nodeId?: number | null;
  nodeIds?: number[];
  isActive: boolean;
}