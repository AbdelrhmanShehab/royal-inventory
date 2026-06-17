export interface RequestItem {
  itemCode: string;
  itemName: string;

  requestedQty: number;
  approvedQty?: number;
  issuedQty?: number;

  unit?: string;
}

export interface TimelineEvent {
  status: 'pending' | 'approved' | 'issued' | 'rejected';
  user: string;
  timestamp: string;
  notes?: string;
}

export interface OperationsRequest {
  id: number;

  requestingNodeId: number;
  requestingNodeName: string;

  createdBy: string;
  createdAt: string;

  status:
    | 'pending'
    | 'approved'
    | 'issued'
    | 'rejected';

  notes?: string;

  items: RequestItem[];
  timeline?: TimelineEvent[]; // Added for UI compatibility
}
