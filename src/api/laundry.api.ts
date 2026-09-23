import api from './axios';
import type {
  LaundryMachine,
  LaundryProgram,
  LaundryRecipe,
  LaundryBatch,
  LaundryTransfer,
  LaundryReturn,
  LaundryTicket,
  LaundryLoss,
  LaundryReconciliation,
  ProfitabilityRecord,
  ChemicalItem,
} from '../types/laundry';

export const laundryApi = {
  // Machines
  getMachines: async (): Promise<LaundryMachine[]> => {
    return api.get('/laundry/machines').then(res => res.data);
  },
  createMachine: async (data: { machineName: string; capacityKg: number; isActive?: boolean }): Promise<any> => {
    return api.post('/laundry/machines', data).then(res => res.data);
  },

  // Programs
  getPrograms: async (machineId: number): Promise<LaundryProgram[]> => {
    return api.get(`/laundry/machines/${machineId}/programs`).then(res => res.data);
  },
  createProgram: async (data: Omit<LaundryProgram, 'id'>): Promise<any> => {
    return api.post('/laundry/machines/programs', data).then(res => res.data);
  },
  updateProgram: async (programId: number, data: Partial<LaundryProgram>): Promise<any> => {
    return api.put(`/laundry/machines/programs/${programId}`, data).then(res => res.data);
  },
  deleteProgram: async (programId: number): Promise<any> => {
    return api.delete(`/laundry/machines/programs/${programId}`).then(res => res.data);
  },

  // Recipes
  getRecipes: async (): Promise<LaundryRecipe[]> => {
    return api.get('/laundry/recipes').then(res => res.data);
  },
  getRecipe: async (recipeId: number): Promise<LaundryRecipe> => {
    return api.get(`/laundry/recipes/${recipeId}`).then(res => res.data);
  },
  createRecipe: async (data: Omit<LaundryRecipe, 'id'>): Promise<any> => {
    return api.post('/laundry/recipes', data).then(res => res.data);
  },
  deleteRecipe: async (recipeId: number): Promise<any> => {
    return api.delete(`/laundry/recipes/${recipeId}`).then(res => res.data);
  },

  // Chemicals
  getChemicals: async (): Promise<ChemicalItem[]> => {
    return api.get('/laundry/chemicals').then(res => res.data);
  },
  classifyChemical: async (itemCode: string, classification: 'production' | 'maintenance'): Promise<any> => {
    return api.put('/laundry/chemicals/classification', { itemCode, classification }).then(res => res.data);
  },

  // Batches
  getBatches: async (): Promise<LaundryBatch[]> => {
    return api.get('/laundry/batches').then(res => res.data);
  },
  getBatch: async (batchId: number): Promise<LaundryBatch> => {
    return api.get(`/laundry/batches/${batchId}`).then(res => res.data);
  },
  createBatch: async (data: any): Promise<any> => {
    return api.post('/laundry/batches', data).then(res => res.data);
  },
  updateBatchStatus: async (batchId: number, status: LaundryBatch['status']): Promise<any> => {
    return api.put(`/laundry/batches/${batchId}/status`, { status }).then(res => res.data);
  },

  // Transfers
  getTransfers: async (): Promise<LaundryTransfer[]> => {
    return api.get('/laundry/transfers').then(res => res.data);
  },
  createTransfer: async (data: any): Promise<any> => {
    return api.post('/laundry/transfers', data).then(res => res.data);
  },
  sendTransfer: async (transferId: number): Promise<any> => {
    return api.post(`/laundry/transfers/${transferId}/send`).then(res => res.data);
  },
  getTransferById: async (transferId: number): Promise<LaundryTransfer> => {
    return api.get(`/laundry/transfers/${transferId}`).then(res => res.data);
  },
  receiveTransfer: async (data: any): Promise<any> => {
    return api.post('/laundry/transfers/receive', data).then(res => res.data);
  },

  // Returns
  getReturns: async (): Promise<LaundryReturn[]> => {
    return api.get('/laundry/returns').then(res => res.data);
  },
  createReturn: async (data: any): Promise<any> => {
    return api.post('/laundry/returns', data).then(res => res.data);
  },
  getReturnById: async (returnId: number): Promise<LaundryReturn> => {
    return api.get(`/laundry/returns/${returnId}`).then(res => res.data);
  },
  verifyReturn: async (returnId: number, data: any): Promise<any> => {
    return api.put(`/laundry/returns/${returnId}/verify`, data).then(res => res.data);
  },

  // Losses
  getLosses: async (): Promise<LaundryLoss[]> => {
    return api.get('/laundry/losses').then(res => res.data);
  },
  createLoss: async (data: any): Promise<any> => {
    return api.post('/laundry/losses', data).then(res => res.data);
  },

  // Tickets (Guest & Staff)
  getTickets: async (): Promise<LaundryTicket[]> => {
    return api.get('/laundry/tickets').then(res => res.data);
  },
  createTicket: async (data: any): Promise<any> => {
    return api.post('/laundry/tickets', data).then(res => res.data);
  },
  getTicketById: async (ticketId: number): Promise<LaundryTicket> => {
    return api.get(`/laundry/tickets/${ticketId}`).then(res => res.data);
  },
  updateTicketStatus: async (ticketId: number, status: LaundryTicket['status']): Promise<any> => {
    return api.put(`/laundry/tickets/${ticketId}/status`, { status }).then(res => res.data);
  },

  // Reports
  getDashboardSummary: async (startDate: string, endDate: string): Promise<any> => {
    return api.get(`/laundry/reports/dashboard-summary?startDate=${startDate}&endDate=${endDate}`).then(res => res.data);
  },
  getReconciliationReport: async (): Promise<LaundryReconciliation[]> => {
    return api.get('/laundry/reports/reconciliation').then(res => res.data);
  },
  getProfitabilityReport: async (fromDate: string, toDate: string): Promise<ProfitabilityRecord[]> => {
    return api.get(`/laundry/reports/profitability?fromDate=${fromDate}&toDate=${toDate}`).then(res => res.data);
  },
  getLaundryStock: async (): Promise<any[]> => {
    return api.get('/laundry/stock').then(res => res.data);
  },

  // Syncing
  syncComsysPOS: async (): Promise<any> => {
    return api.post('/laundry/pos-sync').then(res => res.data);
  },
  getLastPosSync: async (): Promise<any> => {
    return api.get('/laundry/pos-sync/status').then(res => res.data);
  },
  // ZK Custody & Attendance Integration
  getZkCheckins: async (limit: number = 10): Promise<any> => {
    return api.get(`/laundry/zk/checkins?limit=${limit}`).then(res => res.data);
  },
  getZkEmployeeDetails: async (userCode: string): Promise<any> => {
    return api.get(`/laundry/zk/employee/${encodeURIComponent(userCode)}`).then(res => res.data);
  },
  createZkTransaction: async (data: { userCode: string; itemCode: string; action: 'Handover' | 'Receive'; quantity: number; notes?: string }): Promise<any> => {
    return api.post('/laundry/zk/transactions', data).then(res => res.data);
  },
  getZkDashboard: async (): Promise<any> => {
    return api.get('/laundry/zk/dashboard').then(res => res.data);
  },
};

export default laundryApi;
