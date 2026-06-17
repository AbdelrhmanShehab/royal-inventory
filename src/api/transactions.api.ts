import api from './axios';
import type { TransferTransaction } from '../types/transaction';

// Transform backend txn to TransferTransaction
export const transformTransferTransaction = (tx: any): TransferTransaction => {
  return {
    txnId: tx.txnId || tx.txn_id || 0,
    txnType: tx.txnType || tx.txn_type || 'transfer',
    sku: tx.sku || tx.item_code || '',
    quantity: tx.quantity || tx.qty || 0,
    unit: tx.unit || 'وحدة',
    fromNodeId: tx.fromNodeId || tx.from_node_id || tx.node_id || '',
    toNodeId: tx.toNodeId || tx.to_node_id || '',
    fromNodeName: tx.fromNodeNameAr || tx.fromNodeName || '',
    toNodeName: tx.toNodeNameAr || tx.toNodeName || '',
    createdAt: tx.createdAt || tx.created_at || tx.txn_date || '',
    createdBy: tx.creatorUsername || tx.created_by_name || tx.createdBy || String(tx.created_by || ''),
    status: tx.status || 'completed',
    referenceNo: tx.referenceNo || tx.reference_no || undefined,
    notes: tx.notes || undefined
  };
};

export const transactionsApi = {
  getTransfers: async (): Promise<TransferTransaction[]> => {
    const response = await api.get('/transactions/transfers');
    const data = response.data;
    if (Array.isArray(data)) {
      return data.map(transformTransferTransaction);
    }
    return [];
  },

  createTransfer: async (data: {
    sku: string;
    fromUnitId: string | number;
    toUnitId: string | number;
    quantity: number;
    handler: string;
    notes?: string;
  }): Promise<TransferTransaction> => {
    const response = await api.post('/transactions/transfers', data);
    return transformTransferTransaction(response.data);
  }
};

export default transactionsApi;
