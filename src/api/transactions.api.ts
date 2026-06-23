import api from './axios';
import type { TransferTransaction } from '../types/transaction';

// Local Storage Keys for Mock Simulation
const MOCK_TRANSACTIONS_KEY = 'royal_inventory_mock_transactions';

const initializeMockTransactions = (): any[] => {
  const existing = localStorage.getItem(MOCK_TRANSACTIONS_KEY);
  if (existing) {
    try {
      return JSON.parse(existing);
    } catch {
      // ignore
    }
  }

  const initialTransactions = [
    {
      txnId: 1001,
      txnType: 'transfer',
      sku: 'ITEM-001',
      quantity: 50,
      unit: 'كجم',
      fromNodeId: 1,
      toNodeId: 11,
      fromNodeName: 'المستودع الرئيسي',
      toNodeName: 'مطبخ جاردن الشرقي',
      createdAt: '2026-06-16 09:00',
      createdBy: 'أمين المستودع',
      status: 'completed'
    }
  ];

  localStorage.setItem(MOCK_TRANSACTIONS_KEY, JSON.stringify(initialTransactions));
  return initialTransactions;
};

const getLocalTransactions = () => initializeMockTransactions();
const saveLocalTransactions = (txs: any[]) => {
  localStorage.setItem(MOCK_TRANSACTIONS_KEY, JSON.stringify(txs));
};

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
    try {
      const response = await api.get('/transactions/transfers');
      const data = response.data;
      if (Array.isArray(data)) {
        return data.map(transformTransferTransaction);
      }
      return [];
    } catch (error) {
      console.warn('Transactions API endpoint unreachable, falling back to local simulation.', error);
      return getLocalTransactions().map(transformTransferTransaction);
    }
  },

  createTransfer: async (data: {
    sku: string;
    fromUnitId: string | number;
    toUnitId: string | number;
    quantity: number;
    handler: string;
    notes?: string;
  }): Promise<TransferTransaction> => {
    try {
      const response = await api.post('/transactions/transfers', data);
      return transformTransferTransaction(response.data);
    } catch (error) {
      console.warn('Transactions API endpoint unreachable, falling back to local simulation.', error);
      const txs = getLocalTransactions();
      const newTx = {
        txnId: Math.floor(1000 + Math.random() * 9000),
        txnType: 'transfer',
        sku: data.sku,
        quantity: data.quantity,
        unit: 'وحدة',
        fromNodeId: data.fromUnitId,
        toNodeId: data.toUnitId,
        fromNodeName: `وحدة ${data.fromUnitId}`,
        toNodeName: `وحدة ${data.toUnitId}`,
        createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        createdBy: data.handler,
        status: 'completed',
        notes: data.notes
      };
      txs.unshift(newTx);
      saveLocalTransactions(txs);
      return transformTransferTransaction(newTx);
    }
  }
};

export default transactionsApi;
