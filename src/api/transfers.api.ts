import api from './axios';
import type { TransferRecord, CreateTransferPayload } from '../types/transfer';

export const transfersApi = {
  // Get list of transfers with optional nodeId filter
  listTransfers: async (nodeId?: number): Promise<TransferRecord[]> => {
    const params = nodeId ? { nodeId } : {};
    const response = await api.get('/transactions/transfers', { params });
    // backend response helper wraps result inside response.data.data or response.data
    return response.data?.data || response.data || [];
  },

  // Get single transfer details
  getTransfer: async (id: number | string): Promise<TransferRecord> => {
    const response = await api.get(`/transactions/transfers/${id}`);
    return response.data?.data || response.data;
  },

  // Create new transfer draft
  createDraft: async (payload: CreateTransferPayload): Promise<{ txnId: number; message: string }> => {
    const response = await api.post('/transactions/transfers', payload);
    return response.data;
  },

  // Submit draft for approval
  submitForApproval: async (id: number | string): Promise<{ message: string }> => {
    const response = await api.post(`/transactions/transfers/${id}/submit-approval`);
    return response.data;
  },

  // Approve transfer request
  approveTransfer: async (id: number | string): Promise<{ message: string }> => {
    const response = await api.post(`/transactions/transfers/${id}/approve`);
    return response.data;
  },

  // Dispatch/Ship transfer from source warehouse
  dispatchTransfer: async (id: number | string): Promise<{ message: string }> => {
    const response = await api.post(`/transactions/transfers/${id}/dispatch`);
    return response.data;
  },

  // Receive and confirm transfer at destination warehouse
  receiveTransfer: async (id: number | string): Promise<{ message: string }> => {
    const response = await api.post(`/transactions/transfers/${id}/receive`);
    return response.data;
  },

  // Cancel transfer request
  cancelTransfer: async (id: number | string): Promise<{ message: string }> => {
    const response = await api.post(`/transactions/transfers/${id}/cancel`);
    return response.data;
  },

  // Confirm single-node transaction (consumption, waste, damage, disposal)
  confirmTransfer: async (id: number | string): Promise<{ message: string }> => {
    const response = await api.post(`/transactions/transfers/${id}/confirm`);
    return response.data;
  }
};

export default transfersApi;
