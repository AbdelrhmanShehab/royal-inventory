export interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  message: string;
  sku?: string;
  itemName?: string;
  timestamp: string;
  resolved: boolean;
}

export interface StockAlertItem {
  id: string;
  itemCode: string;
  itemNameAr: string;
  itemNameEn?: string;
  category: string;
  unit: string;
  nodeId: string;
  nodeName: string;
  qtyOperational: number;
  reorderLevel: number;
  deficitQty: number;
  suggestedReorderQty: number;
  status: 'out_of_stock' | 'about_to_finish' | 'healthy';
  severity: 'critical' | 'warning' | 'info';
  timestamp: string;
}

