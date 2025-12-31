-- Create the daily_sum_burned table
-- One row per user per local calendar day (entry_date aligned with food logs)
CREATE TABLE IF NOT EXISTS public.daily_sum_burned (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entry_date date NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Authoritative values used by the UI
    bmr_cal integer NOT NULL,
    active_cal integer NOT NULL,
    tdee_cal integer NOT NULL,

    -- System-calculated defaults (for reset and reproducibility)
    system_bmr_cal integer NOT NULL,
    system_active_cal integer NOT NULL,
    system_tdee_cal integer NOT NULL,

    -- Override tracking
    bmr_overridden boolean NOT NULL DEFAULT false,
    active_overridden boolean NOT NULL DEFAULT false,
    tdee_overridden boolean NOT NULL DEFAULT false,
    is_overridden boolean NOT NULL DEFAULT false,

    -- Provenance
    source text NOT NULL,

    -- Optional future-proofing fields
    vendor_external_id text NULL,
    vendor_payload_hash text NULL,
    synced_at timestamptz NULL,

    CONSTRAINT daily_sum_burned_user_date_unique UNIQUE (user_id, entry_date),
    CONSTRAINT daily_sum_burned_non_negative CHECK (
      bmr_cal >= 0 AND active_cal >= 0 AND tdee_cal >= 0 AND
      system_bmr_cal >= 0 AND system_active_cal >= 0 AND system_tdee_cal >= 0
    ),
    -- Keep totals consistent (enforced for both authoritative and system defaults)
    CONSTRAINT daily_sum_burned_tdee_consistency CHECK (
      tdee_cal = bmr_cal + active_cal AND system_tdee_cal = system_bmr_cal + system_active_cal
    )
);

-- Index for quick per-day lookups (and descending day navigation)
CREATE INDEX IF NOT EXISTS daily_sum_burned_user_date_idx
    ON public.daily_sum_burned (user_id, entry_date DESC);

-- Enable Row Level Security
ALTER TABLE public.daily_sum_burned ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can select their own daily burned" ON public.daily_sum_burned;
DROP POLICY IF EXISTS "Users can insert their own daily burned" ON public.daily_sum_burned;
DROP POLICY IF EXISTS "Users can update their own daily burned" ON public.daily_sum_burned;
DROP POLICY IF EXISTS "Users can delete their own daily burned" ON public.daily_sum_burned;

-- RLS Policies
CREATE POLICY "Users can select their own daily burned"
    ON public.daily_sum_burned FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily burned"
    ON public.daily_sum_burned FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily burned"
    ON public.daily_sum_burned FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own daily burned"
    ON public.daily_sum_burned FOR DELETE
    USING (auth.uid() = user_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_daily_sum_burned_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS daily_sum_burned_updated_at_trigger ON public.daily_sum_burned;

CREATE TRIGGER daily_sum_burned_updated_at_trigger
    BEFORE UPDATE ON public.daily_sum_burned
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_sum_burned_updated_at();


