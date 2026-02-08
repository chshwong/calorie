-- Returns entries and day-level log_status in one call.
-- SECURITY INVOKER so RLS applies to underlying tables.
CREATE OR REPLACE FUNCTION public.get_entries_with_log_status(p_entry_date date)
RETURNS TABLE (entries jsonb, log_status public.daily_log_status)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH day_status AS (
    SELECT log_status
    FROM public.daily_sum_consumed
    WHERE user_id = auth.uid()
      AND entry_date = p_entry_date
  )
  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'user_id', e.user_id,
          'entry_date', e.entry_date,
          'eaten_at', e.eaten_at,
          'meal_type', e.meal_type,
          'item_name', e.item_name,
          'food_id', e.food_id,
          'serving_id', e.serving_id,
          'quantity', e.quantity,
          'unit', e.unit,
          'calories_kcal', e.calories_kcal,
          'protein_g', e.protein_g,
          'carbs_g', e.carbs_g,
          'fat_g', e.fat_g,
          'fiber_g', e.fiber_g,
          'saturated_fat_g', e.saturated_fat_g,
          'trans_fat_g', e.trans_fat_g,
          'sugar_g', e.sugar_g,
          'sodium_mg', e.sodium_mg,
          'notes', e.notes,
          'source', e.source,
          'ai_raw_text', e.ai_raw_text,
          'ai_confidence', e.ai_confidence,
          'created_at', e.created_at,
          'updated_at', e.updated_at
        )
        ORDER BY e.created_at ASC
      ) FILTER (WHERE e.id IS NOT NULL),
      '[]'::jsonb
    ) AS entries,
    day_status.log_status
  FROM (SELECT 1) base
  LEFT JOIN day_status ON TRUE
  LEFT JOIN public.calorie_entries e
    ON e.user_id = auth.uid()
   AND e.entry_date = p_entry_date
  GROUP BY day_status.log_status;
$$;

REVOKE ALL ON FUNCTION public.get_entries_with_log_status(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_entries_with_log_status(date) TO authenticated;
