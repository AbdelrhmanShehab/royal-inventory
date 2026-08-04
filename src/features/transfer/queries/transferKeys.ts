import type { TransferFilterParams } from '../types/transfer.types';

export const transferKeys = {
  all: ['transfers'] as const,
  lists: (nodeId?: number | null) => [...transferKeys.all, 'list', nodeId ?? 'global'] as const,
  list: (filters: TransferFilterParams, nodeId?: number | null) => [...transferKeys.lists(nodeId), { filters }] as const,
  details: () => [...transferKeys.all, 'detail'] as const,
  detail: (id: number | string) => [...transferKeys.details(), id] as const,
  dashboard: (nodeId?: number | null) => [...transferKeys.all, 'dashboard', nodeId ?? 'global'] as const,
  statistics: (nodeId?: number | null) => [...transferKeys.all, 'statistics', nodeId ?? 'global'] as const,
};
