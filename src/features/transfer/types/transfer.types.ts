export type TransferType = 
  | 'internal_transfer' 
  | 'laundry'
  | 'consumption' 
  | 'return' 
  | 'damage' 
  | 'waste' 
  | 'disposal';

export type TransferStatus = 
  | 'draft' 
  | 'pending_approval' 
  | 'approved' 
  | 'shipped' 
  | 'confirmed' 
  | 'cancelled';

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface MasterItem {
  id?: number | string;
  itemCode: string;
  itemNameAr: string;
  itemNameEn?: string;
  unitCode?: string;
  unitNameAr?: string;
  avgCost?: number;
  categoryName?: string;
  categoryCode?: string;
  availableQty?: number;
}

export interface TransferLine {
  id?: number;
  itemCode: string;
  itemNameAr?: string;
  itemNameEn?: string;
  quantity: number;
  unitCode?: string;
  unitNameAr?: string;
  unitCost?: number;
  notes?: string;
}

export interface TransferWorkflow {
  status: TransferStatus;
  updatedBy: string;
  updatedByNameAr?: string;
  timestamp: string;
  notes?: string;
}

export interface TransferAudit {
  createdAt: string;
  createdBy: number | string;
  createdByNameAr?: string;
  updatedAt?: string;
  updatedBy?: number | string;
  updatedByNameAr?: string;
}

export interface TransferSummary {
  id: number;
  txnType: TransferType;
  status: TransferStatus;
  fromNodeId: number;
  fromNodeNameAr?: string;
  toNodeId?: number | null;
  toNodeNameAr?: string;
  createdBy: number | string;
  createdByNameAr?: string;
  createdAt: string;
  updatedAt?: string;
  itemCount: number;
  totalCost?: number;
}

export interface TransferDetails extends TransferSummary {
  reason?: string;
  notes?: string;
  lines: TransferLine[];
  timeline: TransferWorkflow[];
  audit?: TransferAudit;
}

export interface CreateTransferLinePayload {
  itemCode: string;
  quantity: number;
  unitCode?: string | null;
  unitCost?: number;
  notes?: string | null;
}

export interface CreateTransferPayload {
  txnType: TransferType;
  fromNodeId: number;
  toNodeId?: number | null;
  notes?: string;
  reason?: string;
  lines: CreateTransferLinePayload[];
  submitForApproval?: boolean;
}

export interface TransferFilterParams {
  status?: string;
  txnType?: string;
  search?: string;
  nodeId?: number;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
}
