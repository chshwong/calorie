/**
 * React Query hooks for daily steps on daily_sum_exercises.
 *
 * Query key: ['dailySumExercises', 'steps', userId, date]
 * - placeholderData: keepPreviousData (no flicker when switching dates)
 * - staleTime: 2min, gcTime: 24h
 * Persistence: handled by app's existing React Query persistence; no new work here.
 */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export type DailySumExercisesStepsRow = {
  user_id: string;
  date: string;
  steps: number;
  steps_source: string | null;
  steps_updated_at: string | null;
};

export function dailySumExercisesStepsKey(userId: string | undefined, date: string) {
  return ['dailySumExercises', 'steps', userId, date] as const;
}

export function useDailySumExercisesStepsForDate(date: string) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: dailySumExercisesStepsKey(userId, date),
    enabled: !!userId && !!date,
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    queryFn: async (): Promise<DailySumExercisesStepsRow | null> => {
      const { data, error } = await supabase
        .from('daily_sum_exercises')
        .select('user_id,date,steps,steps_source,steps_updated_at')
        .eq('user_id', userId!)
        .eq('date', date)
        .maybeSingle();

      if (error) throw error;
      return data ?? null;
    },
  });
}

export function useUpsertDailySteps() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (args: { date: string; steps: number; steps_source: string | null }) => {
      if (!userId) throw new Error('Not authenticated');

      const payload = {
        user_id: userId,
        date: args.date,
        steps: args.steps,
        steps_source: args.steps_source,
        steps_updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('daily_sum_exercises')
        .upsert(payload, { onConflict: 'user_id,date' });

      if (error) throw error;
      return payload;
    },

    onMutate: async (vars) => {
      if (!userId) return;

      const key = dailySumExercisesStepsKey(userId, vars.date);

      await qc.cancelQueries({ queryKey: key });

      const previous = qc.getQueryData<DailySumExercisesStepsRow | null>(key);

      const next: DailySumExercisesStepsRow = {
        user_id: userId,
        date: vars.date,
        steps: vars.steps,
        steps_source: vars.steps_source,
        steps_updated_at: new Date().toISOString(),
      };
      qc.setQueryData(key, next);

      return { previous, key };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.key) {
        qc.setQueryData(ctx.key, ctx.previous ?? null);
      }
    },

    onSettled: (_data, _err, vars) => {
      if (!userId) return;
      qc.invalidateQueries({ queryKey: dailySumExercisesStepsKey(userId, vars.date) });
    },
  });
}
