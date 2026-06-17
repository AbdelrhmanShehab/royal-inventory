export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  minLimit: number;
  unit: string; // e.g. "كجم", "حبة", "كرتون", "لتر"
  warehouseId: string;
  warehouseName: string;
  price: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
}

export interface StockItem {
  item_code: string;
  item_name_ar: string;
  item_name_en?: string;

  category?: string;
  unit?: string;

  qty_operational: number;
  qty_received: number;
  qty_consumed: number;
  qty_wasted: number;

  avg_cost?: number;
  total_value?: number;
  
  reorder_level?: number; // Optional reorder level threshold for dynamic low stock
}
