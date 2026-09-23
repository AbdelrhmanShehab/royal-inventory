import api from '../../../api/axios';
import type { 
  TransferDetails, 
  TransferSummary, 
  CreateTransferPayload, 
  TransferFilterParams,
  TransferType 
} from '../types/transfer.types';

const resolveTxnType = (t: any): TransferType => {
  const rawType = t.txnType || t.txn_type;
  if (rawType === 'laundry') return 'laundry';
  const toId = Number(t.toNodeId || t.to_node_id);
  const toName = String(t.toNodeNameAr || t.to_node_name || '');
  const notes = String(t.notes || '');
  if (toId === 29 || toName.includes('مغسلة') || notes.includes('[تحويل للمغسلة]')) {
    return 'laundry';
  }
  return (rawType as TransferType) || 'internal_transfer';
};

export const transferApi = {
  // GET /transactions/transfers
  getTransfers: async (params?: TransferFilterParams | number): Promise<TransferSummary[]> => {
    const queryParams = typeof params === 'number' ? { nodeId: params } : params;
    const response = await api.get('/transactions/transfers', { params: queryParams });
    const data = response.data?.data || response.data || [];
    
    if (!Array.isArray(data)) return [];
    return data.map((t: any) => ({
      id: Number(t.txnId || t.id),
      txnType: resolveTxnType(t),
      status: t.status || 'draft',
      fromNodeId: Number(t.fromNodeId || t.from_node_id),
      fromNodeNameAr: t.fromNodeNameAr || t.from_node_name,
      toNodeId: t.toNodeId ? Number(t.toNodeId || t.to_node_id) : null,
      toNodeNameAr: t.toNodeNameAr || t.to_node_name,
      createdBy: t.createdBy || t.created_by || 'أمين المستودع',
      createdByNameAr: t.createdByNameAr || t.created_by_name || t.createdBy,
      createdAt: t.createdAt || t.created_at || new Date().toISOString(),
      updatedAt: t.updatedAt || t.updated_at,
      itemCount: Array.isArray(t.lines) && t.lines.length > 0 ? t.lines.length : Number(t.itemCount !== undefined ? t.itemCount : (t.item_count || t.itemsCount || 0)),
      totalCost: t.totalCost ? Number(t.totalCost) : undefined
    }));
  },

  // GET /transactions/transfers/:id
  getTransferById: async (id: number | string): Promise<TransferDetails> => {
    const response = await api.get(`/transactions/transfers/${id}`);
    const t = response.data?.data || response.data;
    
    return {
      id: Number(t.txnId || t.id || id),
      txnType: resolveTxnType(t),
      status: t.status || 'draft',
      fromNodeId: Number(t.fromNodeId || t.from_node_id),
      fromNodeNameAr: t.fromNodeNameAr || t.from_node_name,
      toNodeId: t.toNodeId ? Number(t.toNodeId || t.to_node_id) : null,
      toNodeNameAr: t.toNodeNameAr || t.to_node_name,
      createdBy: t.createdBy || t.created_by || 'أمين المستودع',
      createdByNameAr: t.createdByNameAr || t.created_by_name || t.createdBy,
      createdAt: t.createdAt || t.created_at || new Date().toISOString(),
      updatedAt: t.updatedAt || t.updated_at,
      itemCount: Array.isArray(t.lines) && t.lines.length > 0 ? t.lines.length : Number(t.itemCount !== undefined ? t.itemCount : (t.item_count || t.itemsCount || 0)),
      totalCost: t.totalCost ? Number(t.totalCost) : undefined,
      reason: t.reason,
      notes: t.notes,
      lines: (t.lines || []).map((l: any) => ({
        id: l.id,
        itemCode: l.itemCode || l.item_code,
        itemNameAr: l.itemNameAr || l.item_name,
        quantity: Number(l.quantity || l.qty || 0),
        unitCode: l.unitCode || l.unit_code,
        unitNameAr: l.unitNameAr || l.unit_name,
        unitCost: Number(l.unitCost || l.unit_cost || 0)
      })),
      timeline: t.timeline || []
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
