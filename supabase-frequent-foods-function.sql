-- Function to get frequent foods (logged in last N months) for a user
-- This does all aggregation and joining in the database for better performance
-- Includes both custom foods and database foods (no filtering by is_custom)

CREATE OR REPLACE FUNCTION public.get_frequent_foods(
  p_user_id UUID,
  p_months_back INTEGER DEFAULT 14,
  p_limit_count INTEGER DEFAULT 30
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  brand TEXT,
  serving_size NUMERIC,
  serving_unit TEXT,
  calories_kcal NUMERIC,
  protein_g NUMERIC,
  carbs_g NUMERIC,
  fat_g NUMERIC,
  fiber_g NUMERIC,
  saturated_fat_g NUMERIC,
  unsaturated_fat_g NUMERIC,
  trans_fat_g NUMERIC,
  source TEXT,
  is_custom BOOLEAN,
  owner_user_id UUID,
  log_count BIGINT,
  last_logged_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH recent_entries AS (
    -- Get entries from last N months with food_id
    SELECT 
      food_id,
      COUNT(*) as entry_count,
      MAX(created_at) as most_recent
    FROM calorie_entries
    WHERE user_id = p_user_id
      AND food_id IS NOT NULL
      AND created_at >= NOW() - (p_months_back || ' months')::INTERVAL
    GROUP BY food_id
  ),
  ranked_foods AS (
    -- Join with food_master and rank by frequency
    -- Includes all foods: both custom (is_custom = true) and database foods (is_custom = false)
    SELECT 
      fm.*,
      re.entry_count as log_count,
      re.most_recent as last_logged_at,
      ROW_NUMBER() OVER (
        ORDER BY re.entry_count DESC, re.most_recent DESC
      ) as rank
    FROM recent_entries re
    INNER JOIN food_master fm ON fm.id = re.food_id
    -- No WHERE clause filtering by is_custom - includes all foods
  )
  SELECT 
    rf.id,
    rf.name,
    rf.brand,
    rf.serving_size,
    rf.serving_unit,
    rf.calories_kcal,
    rf.protein_g,
    rf.carbs_g,
    rf.fat_g,
    rf.fiber_g,
    rf.saturated_fat_g,
    rf.unsaturated_fat_g,
    rf.trans_fat_g,
    rf.source,
    rf.is_custom,
    rf.owner_user_id,
    rf.log_count,
    rf.last_logged_at
  FROM ranked_foods rf
  WHERE rf.rank <= p_limit_count
  ORDER BY rf.log_count DESC, rf.last_logged_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_frequent_foods TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.get_frequent_foods IS 'Returns foods logged by a user in the last N months, sorted by frequency and most recent. Optimized for performance with single database call.';

