import api from './axios';
import type { User, CreateUserData, UpdateUserData } from '../types/user';

export const transformUser = (rawUser: any): User => {
  const active = rawUser.isActive !== undefined 
    ? Boolean(rawUser.isActive) 
    : (rawUser.is_active !== undefined ? Boolean(rawUser.is_active) : true);

  return {
    id: rawUser.id || rawUser.user_id,
    username: rawUser.username || '',
    fullNameAr: rawUser.fullNameAr || rawUser.full_name_ar || rawUser.username || '',
    role: rawUser.role || 'staff',
    nodeId: rawUser.nodeId ?? rawUser.node_id ?? null,
    nodeIds: rawUser.nodeIds || [],
    nodeNameAr: rawUser.nodeNameAr || rawUser.unitName || 'المكتب الرئيسي',
    unitId: rawUser.nodeId ? String(rawUser.nodeId) : '',
    unitName: rawUser.nodeNameAr || rawUser.unitName || 'المكتب الرئيسي',
    status: active ? 'active' : 'inactive',
    isActive: active,
    email: rawUser.email || `${rawUser.username || 'user'}@royal-inventory.com`,
    createdAt: rawUser.createdAt || rawUser.created_at
  };
};

export const usersApi = {
  getUsers: async (): Promise<User[]> => {
    const response = await api.get('/users');
    const data = response.data;
    if (Array.isArray(data)) {
      return data.map(transformUser);
    }
    return [];
  },

  getUserById: async (id: string | number): Promise<User> => {
    const response = await api.get(`/users/${id}`);
    return transformUser(response.data);
  },

  createUser: async (data: CreateUserData): Promise<{ id: number }> => {
    const response = await api.post('/users', data);
    return response.data;
  },

  updateUser: async (id: string | number, data: UpdateUserData): Promise<{ message: string }> => {
    const response = await api.put(`/users/${id}`, data);
    return response.data;
  },

  deleteUser: async (id: string | number): Promise<{ message: string }> => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },

  resetPassword: async (id: string | number, newPassword: string): Promise<{ message: string }> => {
    const response = await api.patch(`/users/${id}/reset-password`, { newPassword });
    return response.data;
  },

  updateUserStatus: async (user: User, newStatus: 'active' | 'inactive'): Promise<{ message: string }> => {
    const isActive = newStatus === 'active';
    const payload: UpdateUserData = {
      fullNameAr: user.fullNameAr,
      role: user.role,
      nodeId: user.nodeId ?? null,
      nodeIds: user.nodeIds || [],
      isActive
    };
    const response = await api.put(`/users/${user.id}`, payload);
    return response.data;
  }
};

export default usersApi;
