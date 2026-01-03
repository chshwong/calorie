-- Migration: Remove dead columns from water_daily table
-- Removes: goal, goal_floz, goal_cup, total_ml
-- Keeps: total, goal_ml, water_unit

-- Drop dead columns
ALTER TABLE public.water_daily
DROP COLUMN IF EXISTS goal,
DROP COLUMN IF EXISTS goal_floz,
DROP COLUMN IF EXISTS goal_cup,
DROP COLUMN IF EXISTS total_ml;

-- Add comment documenting the simplified schema
COMMENT ON COLUMN public.water_daily.total IS 'Total water consumed in the row''s water_unit';
COMMENT ON COLUMN public.water_daily.goal_ml IS 'Canonical goal in milliliters (480-5000ml). This is the single source of truth for goals.';
COMMENT ON COLUMN public.water_daily.water_unit IS 'Unit used for this date: ml, floz, or cup';

