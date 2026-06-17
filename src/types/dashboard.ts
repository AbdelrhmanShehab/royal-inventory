export interface DashboardStats {
  totalProducts: number;
  totalValue: number;
  lowStockAlerts: number;
  activeWarehouses: number;
}

export interface InventoryStatusDistribution {
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
  count: number;
  percentage: number;
}
