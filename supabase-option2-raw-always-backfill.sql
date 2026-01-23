-- Option 2: RAW burn is always present; finals remain the app contract.
--
-- Migration goals:
-- - Preserve historical finals: do NOT change active_cal or tdee_cal during backfill.
-- - Backfill raw fields so future sync/reduction logic can operate consistently.
-- - Apply constraints only AFTER backfill succeeds.
--
-- Notes:
-- - raw_last_synced_at remains best-effort metadata; keep it nullable.
-- - This file assumes burn_reduction fields may already exist; all ALTERs are IF NOT EXISTS / safe drops.

BEGIN;

-- Ensure columns exist (idempotent).
ALTER TABLE public.daily_sum_burned
  ADD COLUMN IF NOT EXISTS burn_reduction_pct_int integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS raw_burn numeric NULL,
  ADD COLUMN IF NOT EXISTS raw_tdee numeric NULL,
  ADD COLUMN IF NOT EXISTS raw_burn_source text NULL,
  ADD COLUMN IF NOT EXISTS raw_last_synced_at timestamptz NULL;

-- Backfill: do NOT modify active_cal or tdee_cal.
UPDATE public.daily_sum_burned
SET
  burn_reduction_pct_int = COALESCE(burn_reduction_pct_int, 0),
  raw_burn = COALESCE(
    raw_burn,
    active_cal,
    system_active_cal,
    0 -- fallback to keep invariant even for rare legacy rows missing both
  ),
  raw_burn_source = COALESCE(
    raw_burn_source,
    CASE
      WHEN raw_burn IS NULL AND active_cal IS NOT NULL THEN 'legacy_backfill'
      WHEN raw_burn IS NULL AND active_cal IS NULL AND system_active_cal IS NOT NULL THEN 'system'
      WHEN raw_burn IS NULL AND active_cal IS NULL AND system_active_cal IS NULL THEN 'legacy_backfill'
      -- If raw_burn was already present but source missing, mark as legacy_backfill (unknown legacy source).
      ELSE 'legacy_backfill'
    END
  );

-- Constraints (apply only after backfill succeeds):

-- Range constraint for reduction percent (integer 0..50).
ALTER TABLE public.daily_sum_burned
  DROP CONSTRAINT IF EXISTS daily_sum_burned_reduction_pct_range,
  ADD CONSTRAINT daily_sum_burned_reduction_pct_range
    CHECK (burn_reduction_pct_int >= 0 AND burn_reduction_pct_int <= 50);

-- Non-negative constraints for raw numeric fields (when present).
ALTER TABLE public.daily_sum_burned
  DROP CONSTRAINT IF EXISTS daily_sum_burned_raw_non_negative,
  ADD CONSTRAINT daily_sum_burned_raw_non_negative
    CHECK (
      (raw_burn IS NULL OR raw_burn >= 0)
      AND
      (raw_tdee IS NULL OR raw_tdee >= 0)
    );

-- Replace old 3-state invariant with Option 2 invariants.
ALTER TABLE public.daily_sum_burned
  DROP CONSTRAINT IF EXISTS daily_sum_burned_reduction_raw_invariant,
  ADD CONSTRAINT daily_sum_burned_reduction_raw_invariant
    CHECK (
      raw_burn IS NOT NULL
      AND raw_burn_source IS NOT NULL
      AND raw_burn_source IN ('system', 'manual', 'fitbit', 'legacy_backfill')
    );

COMMIT;

