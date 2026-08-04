/**
 * @deprecated Legacy file retained for backward compatibility.
 * All enterprise transfer requests MUST use src/features/transfer/api/transfer.api.ts
 */
import { transferApi } from '../features/transfer/api/transfer.api';

export const requestsApi = {
  getRequests: () => transferApi.getTransfers(),
  createRequest: (payload: any) => transferApi.createTransferDraft({
    txnType: payload.type || 'internal_transfer',
    fromNodeId: payload.requestingNodeId || 11,
    reason: payload.requestingNodeName,
    lines: (payload.items || []).map((i: any) => ({
      itemCode: i.itemCode,
      quantity: i.requestedQty,
      unitCode: i.unit
    }))
  })
};
