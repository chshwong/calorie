-- Create the water_daily table
CREATE TABLE IF NOT EXISTS public.water_daily (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date date NOT NULL,
    total_ml integer NOT NULL DEFAULT 0,
    goal_ml integer,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),

    CONSTRAINT water_daily_user_date_unique UNIQUE (user_id, date),
    CONSTRAINT total_ml_non_negative CHECK (total_ml >= 0),
    CONSTRAINT goal_ml_positive CHECK (goal_ml IS NULL OR goal_ml > 0)
);

-- Index for quick per-day lookups
CREATE INDEX IF NOT EXISTS water_daily_user_date_idx
    ON public.water_daily (user_id, date);

-- Index for date range queries
CREATE INDEX IF NOT EXISTS water_daily_user_date_range_idx
    ON public.water_daily (user_id, date DESC);

-- Enable Row Level Security
ALTER TABLE public.water_daily ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow user to read their own water logs
CREATE POLICY "Users can select their own water logs"
    ON public.water_daily FOR SELECT
    USING (auth.uid() = user_id);

-- Allow users to insert water logs
CREATE POLICY "Users can insert their own water logs"
    ON public.water_daily FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Allow users to update their water logs
CREATE POLICY "Users can update their own water logs"
    ON public.water_daily FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their water logs
CREATE POLICY "Users can delete their own water logs"
    ON public.water_daily FOR DELETE
    USING (auth.uid() = user_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_water_daily_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER water_daily_updated_at_trigger
    BEFORE UPDATE ON public.water_daily
    FOR EACH ROW
    EXECUTE FUNCTION update_water_daily_updated_at();

-- Add water_unit_preference to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS water_unit_preference TEXT DEFAULT 'metric' CHECK (water_unit_preference IN ('metric', 'imperial'));

-- Add comment for documentation
COMMENT ON COLUMN profiles.water_unit_preference IS 'User preference for water display unit: metric (ml) or imperial (fl oz)';

