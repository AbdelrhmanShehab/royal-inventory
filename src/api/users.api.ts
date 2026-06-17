import api from './axios';
import type { User } from '../types/user';

const MOCK_USERS_KEY = 'royal_inventory_mock_users';

const initializeMockUsers = (): any[] => {
  const existing = localStorage.getItem(MOCK_USERS_KEY);
  if (existing) {
    try {
      return JSON.parse(existing);
    } catch {
      // ignore
    }
  }

  const initialUsers = [
    {
      user_id: 1,
      username: 'abdulrahman',
      full_name_ar: 'عبدالرحمن محمد',
      role: 'admin',
      node_id: 1,
      unitName: 'المكتب الرئيسي',
      is_active: true,
      email: 'abdulrahman@royal.com'
    },
    {
      user_id: 2,
      username: 'khalid',
      full_name_ar: 'خالد العتيبي',
      role: 'manager',
      node_id: 11,
      unitName: 'مطبخ جاردن الشرقي',
      is_active: true,
      email: 'khalid@royal.com'
    },
    {
      user_id: 3,
      username: 'ahmed',
      full_name_ar: 'أحمد محمود',
      role: 'operator',
      node_id: 14,
      unitName: 'فندق جاردن',
      is_active: true,
      email: 'ahmed@royal.com'
    },
    {
      user_id: 4,
      username: 'salim',
      full_name_ar: 'سليم علي',
      role: 'viewer',
      node_id: 21,
      unitName: 'بار فندق بالاس',
      is_active: true,
      email: 'salim@royal.com'
    }
  ];

  localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(initialUsers));
  return initialUsers;
};

const getLocalUsers = () => initializeMockUsers();
const saveLocalUsers = (users: any[]) => {
  localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
};

export const transformUser = (user: any): User => {
  return {
    id: String(user.id || user.user_id || ''),
    username: user.fullNameAr || user.full_name_ar || user.username || 'مستخدم غير معروف',
    role: user.role || 'viewer',
    unitId: user.nodeId !== undefined && user.nodeId !== null ? String(user.nodeId) : (user.node_id ? String(user.node_id) : ''),
    unitName: user.nodeNameAr || user.unitName || (user.nodeId || user.node_id ? `مستودع رقم ${user.nodeId || user.node_id}` : 'المكتب الرئيسي'),
    status: user.isActive !== undefined ? (user.isActive ? 'active' : 'inactive') : (user.is_active || user.status === 'active' ? 'active' : 'inactive'),
    email: user.email || `${user.username || 'user'}@royal.com`
  };
};

export const usersApi = {
  getUsers: async (): Promise<User[]> => {
    try {
      const response = await api.get('/users');
      const data = response.data;
      if (Array.isArray(data)) {
        return data.map(transformUser);
      }
      return [];
    } catch (error) {
      console.warn('Users API endpoint not found or unreachable, falling back to local simulation.', error);
      return getLocalUsers().map(transformUser);
    }
  },

  updateUserStatus: async (id: string | number, status: 'active' | 'inactive'): Promise<User> => {
    try {
      const is_active = status === 'active';
      const response = await api.patch(`/users/${id}/status`, { is_active });
      return transformUser(response.data);
    } catch (error) {
      console.warn('Users API endpoint not found or unreachable, falling back to local simulation.', error);
      const users = getLocalUsers();
      const numId = Number(id);
      const idx = users.findIndex(u => Number(u.user_id) === numId);
      if (idx === -1) throw new Error('User not found');
      
      users[idx].is_active = status === 'active';
      saveLocalUsers(users);
      return transformUser(users[idx]);
    }
  }
};

export default usersApi;
