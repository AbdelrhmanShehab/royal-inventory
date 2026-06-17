import api from './axios';
import type { Warehouse } from '../types/warehouse';

export const transformWarehouse = (wh: any): Warehouse => {
  return {
    id: String(wh.id || wh.storeCode || ''),
    name: wh.storeNameAr || wh.name || 'مستودع غير معروف',
    location: wh.location || (wh.division === 'fb' ? 'قسم الأغذية والمشروبات' : 'القسم العام'),
    capacity: Number(wh.capacity || 2000),
    currentStock: Number(wh.currentStock || 0),
    manager: wh.manager || '—',
    status: wh.isActive === false || wh.status === 'inactive' ? 'inactive' : 'active',
  };
};

export const warehousesApi = {
  getWarehouses: async (): Promise<Warehouse[]> => {
    try {
      const response = await api.get('/warehouses');
      const data = response.data;
      if (Array.isArray(data)) {
        return data.map(transformWarehouse);
      }
      return [];
    } catch (error) {
      console.warn('Warehouses API endpoint unreachable, falling back to local simulation.', error);
      return [
        {
          id: 'node-1-1',
          name: 'مطبخ جاردن الشرقي',
          location: 'مبنى جاردن - الطابق الأول',
          capacity: 1000,
          currentStock: 350,
          manager: 'خالد العتيبي',
          status: 'active'
        },
        {
          id: 'node-1-4',
          name: 'فندق جاردن',
          location: 'مجمع جاردن الرئيسي',
          capacity: 5000,
          currentStock: 1250,
          manager: 'أحمد محمود',
          status: 'active'
        },
        {
          id: 'node-2-1',
          name: 'بار فندق بالاس',
          location: 'مجمع بالاس - البهو الرئيسي',
          capacity: 800,
          currentStock: 120,
          manager: 'سليم علي',
          status: 'active'
        }
      ];
    }
  }
};

export default warehousesApi;
