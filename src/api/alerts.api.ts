import type { Alert, StockAlertItem } from '../types/alert';
import { hierarchyApi } from './hierarchy.api';
import type { StockItem } from '../types/inventory';
import type { OrganizationNode } from '../types/hierarchy';

export const alertsApi = {
  getAlerts: async (selectedNodeId?: string): Promise<Alert[]> => {
    try {
      const stockAlerts = await alertsApi.getStockAlerts(selectedNodeId);
      return stockAlerts.map(s => ({
        id: s.id,
        type: s.severity,
        message: s.status === 'out_of_stock'
          ? `نفاد كامل للمخزون لصنف (${s.itemNameAr}) في ${s.nodeName}`
          : `مستوى المخزون وشيك على النفاد لصنف (${s.itemNameAr}) في ${s.nodeName} (المتبقي: ${s.qtyOperational} ${s.unit})`,
        sku: s.itemCode,
        itemName: s.itemNameAr,
        timestamp: s.timestamp,
        resolved: false
      }));
    } catch {
      return [];
    }
  },

  getStockAlerts: async (selectedNodeId?: string): Promise<StockAlertItem[]> => {
    try {
      let alerts: StockAlertItem[] = [];

      if (selectedNodeId) {
        const stockItems = await hierarchyApi.getNodeStock(selectedNodeId);
        alerts = processStockAlerts(stockItems, selectedNodeId, 'الوحدة التشغيلية');
      } else {
        const tree = await hierarchyApi.getTree();
        const flatNodes: OrganizationNode[] = [];
        const recurse = (list: OrganizationNode[]) => {
          for (const n of list) {
            flatNodes.push(n);
            if (n.children && n.children.length > 0) recurse(n.children);
          }
        };
        recurse(tree);

        for (const node of flatNodes) {
          if (node.id.startsWith('group-')) continue;
          try {
            const stockItems = await hierarchyApi.getNodeStock(node.id);
            const nodeAlerts = processStockAlerts(stockItems, node.id, node.name);
            alerts.push(...nodeAlerts);
          } catch {
            // continue
          }
        }
      }

      return alerts;
    } catch (err) {
      console.warn('Error fetching stock alerts:', err);
      return [];
    }
  }
};

function processStockAlerts(items: StockItem[], nodeId: string, nodeName: string): StockAlertItem[] {
  const result: StockAlertItem[] = [];
  const now = new Date().toISOString();

  items.forEach((item, index) => {
    const reorder = (item.reorder_level && item.reorder_level > 0) ? item.reorder_level : 10;
    const current = item.qty_operational ?? 0;

    const isOutOfStock = current === 0;
    const isBelowReorder = current <= reorder;

    if (isOutOfStock || isBelowReorder) {
      const deficit = Math.max(0, reorder - current);
      const suggested = Math.max(reorder * 2 - current, reorder);

      result.push({
        id: `alert-${nodeId}-${item.item_code}-${index}`,
        itemCode: item.item_code,
        itemNameAr: item.item_name_ar,
        itemNameEn: item.item_name_en || '',
        category: item.category || 'عام',
        unit: item.unit || 'وحدة',
        nodeId: String(nodeId),
        nodeName: nodeName,
        qtyOperational: current,
        reorderLevel: reorder,
        deficitQty: deficit,
        suggestedReorderQty: suggested,
        status: isOutOfStock ? 'out_of_stock' : 'about_to_finish',
        severity: isOutOfStock ? 'critical' : 'warning',
        timestamp: now
      });
    }
  });

  return result;
}

export default alertsApi;
