-- Migration: Change water_daily.total from INTEGER to NUMERIC
-- This allows storing decimal values for cup and floz units (e.g., 0.25 cup, 2.5 fl oz)

-- Change total column from INTEGER to NUMERIC
ALTER TABLE public.water_daily
ALTER COLUMN total TYPE NUMERIC(10, 2) USING total::NUMERIC(10, 2);

-- Change goal column from INTEGER to NUMERIC (if it exists)
ALTER TABLE public.water_daily
ALTER COLUMN goal TYPE NUMERIC(10, 2) USING goal::NUMERIC(10, 2);

-- Update comments
COMMENT ON COLUMN public.water_daily.total IS 'Total water amount in the row''s water_unit (supports decimals for cup/floz units)';
COMMENT ON COLUMN public.water_daily.goal IS 'Goal water amount in the row''s water_unit (supports decimals for cup/floz units)';

