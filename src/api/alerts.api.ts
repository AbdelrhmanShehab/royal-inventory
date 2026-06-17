import api from './axios';
import type { Alert } from '../types/alert';

export const alertsApi = {
  getAlerts: async (): Promise<Alert[]> => {
    try {
      const response = await api.get('/alerts');
      return response.data;
    } catch (error) {
      console.warn('Alerts API endpoint unreachable, falling back to local simulation.', error);
      return [
        {
          id: 'alt-1',
          type: 'warning',
          message: 'مستوى المخزون التشغيلي منخفض لصنف: أرز بسمتي الشعلان في مطبخ جاردن الشرقي',
          sku: 'ITEM-001',
          itemName: 'أرز بسمتي الشعلان',
          timestamp: new Date().toISOString(),
          resolved: false
        },
        {
          id: 'alt-2',
          type: 'critical',
          message: 'مستوى المخزون حرج لصنف: بن هرري محمص فاخر في بار فندق بالاس',
          sku: 'ITEM-002',
          itemName: 'بن هرري محمص فاخر',
          timestamp: new Date().toISOString(),
          resolved: false
        }
      ];
    }
  }
};

export default alertsApi;
