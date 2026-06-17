export interface TransactionHeader {
  txn_id: number;

  txn_type:
    | "consumption"
    | "internal_transfer"
    | "return"
    | "damage"
    | "waste"
    | "disposal";

  node_id: number;

  created_by: number;

  txn_date: string;

  reference_no: string | null;

  notes: string | null;

  status:
    | "draft"
    | "confirmed"
    | "cancelled";

  created_at: string;
}

export interface TransferTransaction {
  txnId: number;

  txnType: string;

  sku?: string;

  quantity?: number;

  unit?: string;

  fromNodeId?: number | string;
  fromNodeName?: string;

  toNodeId?: number | string;
  toNodeName?: string;

  createdAt: string;
  createdBy: string;

  status: string;

  referenceNo?: string;

  notes?: string;
}