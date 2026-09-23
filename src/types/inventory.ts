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

  qty_operational: number; // الرصيد الفعلي / التشغيلي المتاح
  qty_received: number;    // إجمالي المستلم (مستلم خارجي + تحويل داخلي وارد)
  qty_transfers: number;   // تحويلات (محول لمستودعات أخرى)
  qty_laundry: number;     // مغسلة (قيد الغسيل حالياً بالمغسلة)
  qty_consumed: number;    // استهلاك تشغيلي
  qty_returned: number;    // مرتجع للمخزن الرئيسي
  qty_wasted: number;      // تالف / هدر / استبعاد

  avg_cost?: number;
  total_value?: number;
  
  reorder_level?: number; // حد التنبيه / الأمان
}
