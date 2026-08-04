import api from './axios';
import type { MasterItem } from '../types/transfer';

export const masterDataApi = {
  getItems: async (params?: { division?: string; categoryCode?: string }): Promise<MasterItem[]> => {
    const response = await api.get('/master-data/items', { params });
    return response.data?.data || response.data || [];
  },

  getCategories: async (division?: string): Promise<any[]> => {
    const response = await api.get('/master-data/categories', { params: { division } });
    return response.data?.data || response.data || [];
  }
};

export default masterDataApi;
