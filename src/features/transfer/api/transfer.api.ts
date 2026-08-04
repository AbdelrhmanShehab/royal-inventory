import api from '../../../api/axios';
import type { 
  TransferDetails, 
  TransferSummary, 
  CreateTransferPayload, 
  TransferFilterParams 
} from '../types/transfer.types';

export const transferApi = {
  // GET /transactions/transfers
  getTransfers: async (params?: TransferFilterParams): Promise<TransferSummary[]> => {
    const response = await api.get('/transactions/transfers', { params });
    const data = response.data?.data || response.data || [];
    
    // Normalize into TransferSummary list
    return data.map((item: any) => ({
      id: Number(item.id || item.txnId),
      txnType: item.txnType,
      status: item.status,
      fromNodeId: Number(item.fromNodeId),
      fromNodeNameAr: item.fromNodeNameAr || item.fromNodeName,
      toNodeId: item.toNodeId ? Number(item.toNodeId) : null,
      toNodeNameAr: item.toNodeNameAr || item.toNodeName,
      createdBy: item.createdBy,
      createdByNameAr: item.createdByNameAr || item.createdBy,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      itemCount: Array.isArray(item.lines) ? item.lines.length : Number(item.itemCount || 0),
      totalCost: item.totalCost ? Number(item.totalCost) : undefined
    }));
  },

  // GET /transactions/transfers/:id
  getTransferById: async (id: number | string): Promise<TransferDetails> => {
    const response = await api.get(`/transactions/transfers/${id}`);
    const data = response.data?.data || response.data;
    
    return {
      id: Number(data.id || id),
      txnType: data.txnType,
      status: data.status,
      fromNodeId: Number(data.fromNodeId),
      fromNodeNameAr: data.fromNodeNameAr || data.fromNodeName,
      toNodeId: data.toNodeId ? Number(data.toNodeId) : null,
      toNodeNameAr: data.toNodeNameAr || data.toNodeName,
      createdBy: data.createdBy,
      createdByNameAr: data.createdByNameAr || data.createdBy,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      itemCount: Array.isArray(data.lines) ? data.lines.length : 0,
      reason: data.reason,
      notes: data.notes,
      lines: (data.lines || []).map((l: any) => ({
        id: l.id,
        itemCode: l.itemCode,
        itemNameAr: l.itemNameAr || l.itemCode,
        itemNameEn: l.itemNameEn,
        quantity: Number(l.quantity),
        unitCode: l.unitCode,
        unitNameAr: l.unitNameAr || l.unitCode,
        unitCost: Number(l.unitCost || 0),
        notes: l.notes
      })),
      timeline: data.timeline || []
    };
  },

  // POST /transactions/transfers
  createTransferDraft: async (payload: CreateTransferPayload): Promise<{ txnId: number; message: string }> => {
    const response = await api.post('/transactions/transfers', payload);
    return response.data;
  },

  // POST /transactions/transfers/:id/submit-approval
  submitForApproval: async (id: number | string): Promise<{ message: string }> => {
    const response = await api.post(`/transactions/transfers/${id}/submit-approval`);
    return response.data;
  },

  // POST /transactions/transfers/:id/approve
  approveTransfer: async (id: number | string): Promise<{ message: string }> => {
    const response = await api.post(`/transactions/transfers/${id}/approve`);
    return response.data;
  },

  // POST /transactions/transfers/:id/dispatch
  dispatchTransfer: async (id: number | string): Promise<{ message: string }> => {
    const response = await api.post(`/transactions/transfers/${id}/dispatch`);
    return response.data;
  },

  // POST /transactions/transfers/:id/receive
  receiveTransfer: async (id: number | string): Promise<{ message: string }> => {
    const response = await api.post(`/transactions/transfers/${id}/receive`);
    return response.data;
  },

  // POST /transactions/transfers/:id/cancel
  cancelTransfer: async (id: number | string): Promise<{ message: string }> => {
    const response = await api.post(`/transactions/transfers/${id}/cancel`);
    return response.data;
  },

  // POST /transactions/transfers/:id/confirm
  confirmTransfer: async (id: number | string): Promise<{ message: string }> => {
    const response = await api.post(`/transactions/transfers/${id}/confirm`);
    return response.data;
  }
};
