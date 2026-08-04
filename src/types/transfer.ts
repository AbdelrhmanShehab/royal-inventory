export type TxnType = 
  | 'internal_transfer' 
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

export interface CreateTransferLinePayload {
  itemCode: string;
  quantity: number;
  unitCode?: string | null;
  unitCost?: number;
  notes?: string | null;
}

export interface CreateTransferPayload {
  txnType: TxnType;
  fromNodeId: number;
  toNodeId?: number | null;
  notes?: string;
  reason?: string;
  lines: CreateTransferLinePayload[];
}

export interface TransferRecord {
  id: number;
  txnType: TxnType;
  status: TransferStatus;
  fromNodeId: number;
  fromNodeNameAr?: string;
  toNodeId?: number | null;
  toNodeNameAr?: string;
  createdBy: number | string;
  createdByNameAr?: string;
  createdAt: string;
  updatedAt?: string;
  notes?: string;
  reason?: string;
  lines: TransferLine[];
  timeline?: {
    status: TransferStatus;
    updatedBy: string;
    timestamp: string;
    notes?: string;
  }[];
}

export interface MasterItem {
  id?: number | string;
  itemCode: string;
  itemNameAr: string;
  itemNameEn?: string;
  categoryCode?: string;
  unitCode?: string;
  unitNameAr?: string;
  itemType?: string;
  avgCost?: number;
  division?: string;
  isActive?: boolean;
}
