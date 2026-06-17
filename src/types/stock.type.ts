export interface NodeStockItem {
  stock_id: number;

  node_id: number;

  item_code: string;

  qty_received: number;

  qty_internal_in: number;

  qty_returned_in: number;

  qty_consumed: number;

  qty_damaged: number;

  qty_wasted: number;

  qty_disposed: number;

  qty_transferred_out: number;

  qty_operational: number;

  last_updated: string;
}