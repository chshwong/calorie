import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import type { DailySumBurned } from '@/utils/types';
import type { BurnReductionEdits, BurnedEditedValues, BurnedTouchedFields } from '@/lib/services/burned/saveDailySumBurned';
import { saveDailySumBurned } from '@/lib/services/burned/saveDailySumBurned';
import { applyRawToFinals } from '@/lib/services/burned/applyRawToFinals';
import { resetDailySumBurned } from '@/lib/services/burned/resetDailySumBurned';
import { toDateKey } from '@/utils/dateKey';

export function useSaveDailySumBurned() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      entryDate: string | Date;
      touched: BurnedTouchedFields;
      values: BurnedEditedValues;
      reduction?: BurnReductionEdits;
    }) => {
      if (!userId) throw new Error('User not authenticated');
      return saveDailySumBurned({
        userId,
        dateInput: input.entryDate,
        touched: input.touched,
        values: input.values,
        reduction: input.reduction,
      });
    },
    onSuccess: (row, variables) => {
      const dateKey = toDateKey(variables.entryDate);
      queryClient.setQueryData(['dailySumBurned', userId, dateKey], row);
      queryClient.invalidateQueries({ queryKey: ['dailySumBurned', userId, dateKey] });
      queryClient.invalidateQueries({ queryKey: ['dailySumBurnedRange', userId] });
    },
  });
}

export function useResetDailySumBurned() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { entryDate: string | Date }) => {
      if (!userId) throw new Error('User not authenticated');
      return resetDailySumBurned(userId, input.entryDate);
    },
    onSuccess: (row, variables) => {
      const dateKey = toDateKey(variables.entryDate);
      queryClient.setQueryData(['dailySumBurned', userId, dateKey], row);
      queryClient.invalidateQueries({ queryKey: ['dailySumBurned', userId, dateKey] });
      queryClient.invalidateQueries({ queryKey: ['dailySumBurnedRange', userId] });
    },
  });
}

export function useApplyRawToFinals() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { entryDate: string | Date }) => {
      if (!userId) throw new Error('User not authenticated');
      return applyRawToFinals({ userId, dateInput: input.entryDate });
    },
    onSuccess: (row, variables) => {
      const dateKey = toDateKey(variables.entryDate);
      queryClient.setQueryData(['dailySumBurned', userId, dateKey], row);
      queryClient.invalidateQueries({ queryKey: ['dailySumBurned', userId, dateKey] });
      queryClient.invalidateQueries({ queryKey: ['dailySumBurnedRange', userId] });
    },
  });
}


