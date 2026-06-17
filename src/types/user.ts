export interface AppUser {
  user_id: number;

  username: string;

  full_name_ar: string;

  role:
    | "admin"
    | "manager"
    | "operator"
    | "viewer";

  node_id: number | null;

  is_active: boolean;

  last_login_at: string | null;
}

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'manager' | 'operator' | 'viewer';
  unitId: string;
  unitName: string;
  status: 'active' | 'inactive';
  email: string;
}