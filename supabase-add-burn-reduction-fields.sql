-- Add burn reduction support to daily_sum_burned
-- Phase 1: introduce new columns without changing existing final field semantics.
--
-- Final fields (used across the app) remain:
-- - active_cal (final burn)
-- - tdee_cal (final tdee)
-- - bmr_cal (existing)
--
-- New fields are used ONLY by the Burn/TDEE pencil modal:
-- - burn_reduction_pct_int (0..50 integer, default 0)
-- - raw_burn (nullable; required when pct > 0)
-- - raw_tdee (nullable; optional even when pct > 0)
-- - raw_burn_source (nullable; required when pct=0 AND raw_burn is present)
-- - raw_last_synced_at (nullable; required when pct=0 AND raw_burn is present)

ALTER TABLE public.daily_sum_burned
  ADD COLUMN IF NOT EXISTS burn_reduction_pct_int integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS raw_burn numeric NULL,
  ADD COLUMN IF NOT EXISTS raw_tdee numeric NULL,
  ADD COLUMN IF NOT EXISTS raw_burn_source text NULL,
  ADD COLUMN IF NOT EXISTS raw_last_synced_at timestamptz NULL;

-- Range constraint for reduction percent (integer 0..50)
ALTER TABLE public.daily_sum_burned
  DROP CONSTRAINT IF EXISTS daily_sum_burned_reduction_pct_range,
  ADD CONSTRAINT daily_sum_burned_reduction_pct_range
    CHECK (burn_reduction_pct_int >= 0 AND burn_reduction_pct_int <= 50);

-- Non-negative constraints for raw numeric fields (when present)
ALTER TABLE public.daily_sum_burned
  DROP CONSTRAINT IF EXISTS daily_sum_burned_raw_non_negative,
  ADD CONSTRAINT daily_sum_burned_raw_non_negative
    CHECK (
      (raw_burn IS NULL OR raw_burn >= 0)
      AND
      (raw_tdee IS NULL OR raw_tdee >= 0)
    );

-- Invariant:
-- 3-state model:
-- - STATE 1 (Legacy/manual): pct = 0 AND all raw/provenance fields are NULL
-- - STATE 2 (Synced-only, reduction disabled): pct = 0 AND raw_burn present WITH provenance
-- - STATE 3 (Reduction enabled): pct > 0 AND raw_burn present (provenance optional)
ALTER TABLE public.daily_sum_burned
  DROP CONSTRAINT IF EXISTS daily_sum_burned_reduction_raw_invariant,
  ADD CONSTRAINT daily_sum_burned_reduction_raw_invariant
    CHECK (
      -- STATE 1
      (burn_reduction_pct_int = 0 AND raw_burn IS NULL AND raw_tdee IS NULL AND raw_burn_source IS NULL AND raw_last_synced_at IS NULL)
      OR
      -- STATE 2 (raw_tdee optional)
      (burn_reduction_pct_int = 0 AND raw_burn IS NOT NULL AND raw_burn_source IS NOT NULL AND raw_last_synced_at IS NOT NULL)
      OR
      -- STATE 3 (raw_tdee optional; provenance optional)
      (burn_reduction_pct_int > 0 AND raw_burn IS NOT NULL)
    );

