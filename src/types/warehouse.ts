export interface Warehouse {
  id: string;
  name: string;
  location: string;
  capacity: number; // Max items it can store
  currentStock: number; // Current quantity of items
  manager: string;
  status: 'active' | 'inactive';
}
