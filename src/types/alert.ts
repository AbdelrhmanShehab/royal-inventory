export interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  message: string;
  sku?: string;
  itemName?: string;
  timestamp: string;
  resolved: boolean;
}
