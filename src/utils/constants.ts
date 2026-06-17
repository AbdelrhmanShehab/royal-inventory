export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const ROUTES = {
  DASHBOARD: '/',
  ORGANIZATION: '/organization',
  INVENTORY: '/inventory',
  TRANSACTIONS: '/transactions',
  REQUESTS: '/requests',
  USERS: '/users',
} as const;

export const CATEGORIES = [
  'أغذية ومواد طهي',
  'مشروبات ومستلزمات بار',
  'بياضات ومستلزمات غرف',
  'أدوات ومعدات مطبخ',
  'مواد نظافة وتطهير',
  'أثاث ومستلزمات تشغيل',
] as const;
