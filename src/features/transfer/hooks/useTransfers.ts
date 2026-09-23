import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transferApi } from '../api/transfer.api';
import { transferKeys } from '../queries/transferKeys';
import { useWarehouseScope } from '../../../hooks/useWarehouseScope';
import type { TransferFilterParams, CreateTransferPayload } from '../types/transfer.types';

export const useTransfersList = (filters: TransferFilterParams = {}) => {
  const { currentNodeId } = useWarehouseScope();

  return useQuery({
    queryKey: transferKeys.list(filters, currentNodeId),
    queryFn: () => transferApi.getTransfers(filters)
  });
};

export const useTransferDetails = (id: number | string | null, enabled = true) => {
  return useQuery({
    queryKey: transferKeys.detail(id!),
    queryFn: () => transferApi.getTransferById(id!),
    enabled: !!id && enabled
  });
};

export const useCreateTransfer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTransferPayload) => transferApi.createTransferDraft(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transferKeys.all });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
    }
  });
};

export const useSubmitTransfer = (id: number | string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => transferApi.submitForApproval(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transferKeys.all });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
    }
  });
};

export const useApproveTransfer = (id: number | string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => transferApi.approveTransfer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transferKeys.all });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
    }
  });
};

export const useDispatchTransfer = (id: number | string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => transferApi.dispatchTransfer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transferKeys.all });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
    }
  });
};

export const useReceiveTransfer = (id: number | string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => transferApi.receiveTransfer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transferKeys.all });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
    }
  });
};

export const useCancelTransfer = (id: number | string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => transferApi.cancelTransfer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transferKeys.all });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
    }
  });
};

export const useConfirmTransfer = (id: number | string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => transferApi.confirmTransfer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transferKeys.all });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
    }
  });
};
