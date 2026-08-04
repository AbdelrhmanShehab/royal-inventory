import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { warehousesApi } from '../api/warehouses.api';
import type { Warehouse } from '../types/warehouse';

export interface WarehouseScope {
  currentNodeId: number | null;
  isGlobalAdmin: boolean;
  currentNodeName: string;
  assignedWarehouse: Warehouse | null;
  canAccessNode: (nodeId: number | string | null | undefined) => boolean;
  getScopedNodeId: (requestedNodeId?: number | string | null) => number | undefined;
}

export const useWarehouseScope = (): WarehouseScope => {
  const { user, isAdmin } = useAuth();
  const [currentNodeName, setCurrentNodeName] = useState<string>('المستودع الرئيسي');
  const [assignedWarehouse, setAssignedWarehouse] = useState<Warehouse | null>(null);

  const rawNodeId = user?.nodeId ?? user?.node_id ?? null;
  const currentNodeId = rawNodeId !== null ? Number(rawNodeId) : null;
  const isGlobalAdmin = isAdmin();

  useEffect(() => {
    let isMounted = true;
    const resolveWarehouseDetails = async () => {
      if (isGlobalAdmin && !currentNodeId) {
        if (isMounted) {
          setCurrentNodeName('جميع المستودعات (مدير النظام)');
          setAssignedWarehouse(null);
        }
        return;
      }

      if (currentNodeId) {
        try {
          const list = await warehousesApi.getWarehouses();
          const match = list.find(w => Number(w.id) === currentNodeId || String(w.id) === String(currentNodeId));
          if (isMounted) {
            if (match) {
              setCurrentNodeName(match.name);
              setAssignedWarehouse(match);
            } else {
              setCurrentNodeName(`مستودع #${currentNodeId}`);
            }
          }
        } catch {
          if (isMounted) {
            setCurrentNodeName(`مستودع #${currentNodeId}`);
          }
        }
      }
    };

    resolveWarehouseDetails();

    return () => {
      isMounted = false;
    };
  }, [currentNodeId, isGlobalAdmin]);

  const canAccessNode = (targetNodeId: number | string | null | undefined): boolean => {
    if (isGlobalAdmin) return true;
    if (!targetNodeId || !currentNodeId) return true;
    return Number(targetNodeId) === currentNodeId;
  };

  const getScopedNodeId = (requestedNodeId?: number | string | null): number | undefined => {
    if (isGlobalAdmin) {
      return requestedNodeId !== undefined && requestedNodeId !== null ? Number(requestedNodeId) : undefined;
    }
    return currentNodeId !== null ? currentNodeId : undefined;
  };

  return {
    currentNodeId,
    isGlobalAdmin,
    currentNodeName,
    assignedWarehouse,
    canAccessNode,
    getScopedNodeId,
  };
};

export default useWarehouseScope;
