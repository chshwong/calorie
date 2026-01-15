import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getLocalISODate } from "@/lib/dates/getLocalISODate";

type TodaySummaryStatus = "idle" | "loading" | "empty" | "success" | "error";

type TodaySummaryData = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  entries?: number;
};

type TodaySummaryState = {
  status: TodaySummaryStatus;
  data?: TodaySummaryData;
  error: string | null;
};

const DEFAULT_STATE: TodaySummaryState = {
  status: "idle",
  data: undefined,
  error: null,
};

const normalizeNumber = (value: number | null | undefined) =>
  typeof value === "number" && !Number.isNaN(value) ? value : 0;

export function useTodaySummary(userId: string | null) {
  const [state, setState] = useState<TodaySummaryState>(DEFAULT_STATE);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadSummary = useCallback(
    async (cancelToken?: { value: boolean }) => {
      if (!userId) {
        setState({ status: "idle", data: undefined, error: null });
        return;
      }

      setState((prev) => ({ ...prev, status: "loading", error: null }));
      const dateKey = getLocalISODate();

      try {
        const { data, error } = await supabase
          .from("daily_sum_consumed")
          .select("calories, protein_g, carbs_g, fat_g, fibre_g")
          .eq("user_id", userId)
          .eq("entry_date", dateKey)
          .single();

        if (cancelToken?.value || !mountedRef.current) return;

        if (error) {
          if (error.code === "PGRST116" || error.message.includes("No rows")) {
            setState({ status: "empty", data: undefined, error: null });
            return;
          }
          throw error;
        }

        const { count, error: countError } = await supabase
          .from("calorie_entries")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("entry_date", dateKey);

        if (cancelToken?.value || !mountedRef.current) return;

        setState({
          status: "success",
          data: {
            calories: normalizeNumber(data?.calories),
            protein: normalizeNumber(data?.protein_g),
            carbs: normalizeNumber(data?.carbs_g),
            fat: normalizeNumber(data?.fat_g),
            fiber: normalizeNumber(data?.fibre_g),
            entries: countError ? undefined : count ?? 0,
          },
          error: null,
        });
      } catch (err: any) {
        if (cancelToken?.value || !mountedRef.current) return;

        setState({
          status: "error",
          data: undefined,
          error: err?.message || "Failed to load today summary.",
        });
      }
    },
    [userId]
  );

  useEffect(() => {
    const cancelled = { value: false };
    void loadSummary(cancelled);
    return () => {
      cancelled.value = true;
    };
  }, [loadSummary]);

  const refresh = useCallback(async () => {
    await loadSummary();
  }, [loadSummary]);

  return {
    status: state.status,
    data: state.data,
    error: state.error,
    refresh,
  };
}
