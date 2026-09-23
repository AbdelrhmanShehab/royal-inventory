import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { warehousesApi } from '../api/warehouses.api';
import { hierarchyApi } from '../api/hierarchy.api';
import type { Warehouse } from '../types/warehouse';

export interface WarehouseScope {
  currentNodeId: number | null;
  isGlobalAdmin: boolean;
  currentNodeName: string;
  assignedWarehouse: Warehouse | null;
  isParentScope: boolean;
  childWarehouses: Warehouse[];
  childNodeIds: number[];
  isFromNodeLocked: boolean;
  canAccessNode: (nodeId: number | string | null | undefined) => boolean;
  getScopedNodeId: (requestedNodeId?: number | string | null) => number | undefined;
}

export const useWarehouseScope = (): WarehouseScope => {
  const { user, isAdmin } = useAuth();
  const [currentNodeName, setCurrentNodeName] = useState<string>('المستودع الرئيسي');
  const [assignedWarehouse, setAssignedWarehouse] = useState<Warehouse | null>(null);
  const [childWarehouses, setChildWarehouses] = useState<Warehouse[]>([]);
  const [childNodeIds, setChildNodeIds] = useState<number[]>([]);
  const [isParentScope, setIsParentScope] = useState<boolean>(false);

  const rawNodeId = user?.nodeId ?? user?.node_id ?? null;
  const currentNodeId = rawNodeId !== null ? Number(rawNodeId) : null;
  const isGlobalAdmin = isAdmin() && !currentNodeId;

  useEffect(() => {
    let isMounted = true;
    const resolveWarehouseDetails = async () => {
      if (isGlobalAdmin && !currentNodeId) {
        if (isMounted) {
          setCurrentNodeName('جميع المستودعات (مدير النظام)');
          setAssignedWarehouse(null);
          setIsParentScope(false);
          setChildWarehouses([]);
          setChildNodeIds([]);
        }
        return;
      }

      if (currentNodeId) {
        try {
          const { allWarehouses, parentEntities } = await warehousesApi.getOperationalWarehouses(true);
          const match = allWarehouses.find(w => w.nodeId === currentNodeId);
          
          if (isMounted && match) {
            setCurrentNodeName(match.name);
            setAssignedWarehouse(match);

            // Detect if this is a parent warehouse / hotel entity
            const isParent = match.nodeType === 'parent' || match.parentNodeId === null || parentEntities.some(p => p.nodeId === currentNodeId);
            setIsParentScope(isParent);

            if (isParent) {
              // Collect child operational warehouses belonging to this parent entity or group
              const children = allWarehouses.filter(w => 
                w.nodeId !== currentNodeId && 
                (w.parentNodeId === currentNodeId || w.groupId === match.groupId) &&
                w.nodeType !== 'parent'
              );
              setChildWarehouses(children);
              setChildNodeIds(children.map(c => c.nodeId));
            } else {
              setChildWarehouses([]);
              setChildNodeIds([]);
            }
            return;
          }
        } catch {
          // continue to fallback
        }

        try {
          const node = await hierarchyApi.getNode(currentNodeId);
          if (isMounted && node && node.name) {
            const hasKids = Boolean(node.children && node.children.length > 0);
            const isParent = node.type === 'hotel' || node.type === 'group' || !node.parentId || hasKids;

            setCurrentNodeName(node.name);
            setIsParentScope(isParent);

            const fallbackWarehouse: Warehouse = {
              id: String(node.id),
              nodeId: Number(node.id),
              name: node.name,
              nodeType: isParent ? 'parent' : 'child',
              parentNodeId: node.parentId ? Number(node.parentId) : null,
              groupId: 1,
              division: 'fb',
              location: 'الفرع المخصص',
              capacity: 1000,
              currentStock: node.stats?.operationalInventory || 0,
              manager: node.manager || '—',
              managerName: node.manager || '—',
              hasLaundryAccess: false,
              isActive: node.status === 'active',
              status: node.status === 'active' ? 'active' : 'inactive'
            };
            setAssignedWarehouse(fallbackWarehouse);

            if (isParent && node.children) {
              const children: Warehouse[] = node.children.map(c => ({
                id: String(c.id),
                nodeId: Number(c.id),
                name: c.name,
                nodeType: 'child',
                parentNodeId: currentNodeId,
                groupId: 1,
                division: 'fb',
                location: 'فرع تشغيلي',
                capacity: 1000,
                currentStock: c.stats?.operationalInventory || 0,
                manager: c.manager || '—',
                managerName: c.manager || '—',
                hasLaundryAccess: false,
                isActive: c.status === 'active',
                status: c.status === 'active' ? 'active' : 'inactive'
              }));
              setChildWarehouses(children);
              setChildNodeIds(children.map(c => c.nodeId));
            } else {
              setChildWarehouses([]);
              setChildNodeIds([]);
            }
            return;
          }
        } catch {
          // ignore
        }

        if (isMounted) {
          setCurrentNodeName(`مستودع #${currentNodeId}`);
          setIsParentScope(false);
          setChildWarehouses([]);
          setChildNodeIds([]);
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
    const targetNum = Number(targetNodeId);
    if (targetNum === currentNodeId) return true;
    if (isParentScope && childNodeIds.includes(targetNum)) return true;
    return false;
  };

  const getScopedNodeId = (requestedNodeId?: number | string | null): number | undefined => {
    if (isGlobalAdmin || isParentScope) {
      return requestedNodeId !== undefined && requestedNodeId !== null ? Number(requestedNodeId) : undefined;
    }
    return currentNodeId !== null ? currentNodeId : undefined;
  };

  const isFromNodeLocked = !isGlobalAdmin && !!currentNodeId && !isParentScope;

  return {
    currentNodeId,
    isGlobalAdmin,
    currentNodeName,
    assignedWarehouse,
    isParentScope,
    childWarehouses,
    childNodeIds,
    isFromNodeLocked,
    canAccessNode,
    getScopedNodeId,
  };
};

export default useWarehouseScope;
