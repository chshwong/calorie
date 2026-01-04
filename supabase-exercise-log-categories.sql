-- Add category and new optional fields to exercise_log table
-- This migration extends the exercise_log schema to support two categories:
-- 1. Cardio / Mind-Body (default) - tracks minutes and optional distance
-- 2. Strength - tracks sets, reps range, and intensity

ALTER TABLE public.exercise_log
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'cardio_mind_body',
  ADD COLUMN IF NOT EXISTS intensity text NULL,
  ADD COLUMN IF NOT EXISTS distance_km numeric NULL,
  ADD COLUMN IF NOT EXISTS sets integer NULL,
  ADD COLUMN IF NOT EXISTS reps_min integer NULL,
  ADD COLUMN IF NOT EXISTS reps_max integer NULL;

-- Backfill existing rows explicitly (safety)
UPDATE public.exercise_log
SET category = 'cardio_mind_body'
WHERE category IS NULL;

-- Constraints
DO $$
BEGIN
  -- category constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exercise_log_category_check'
  ) THEN
    ALTER TABLE public.exercise_log
      ADD CONSTRAINT exercise_log_category_check
      CHECK (category IN ('cardio_mind_body', 'strength'));
  END IF;

  -- intensity constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exercise_log_intensity_check'
  ) THEN
    ALTER TABLE public.exercise_log
      ADD CONSTRAINT exercise_log_intensity_check
      CHECK (intensity IS NULL OR intensity IN ('low', 'medium', 'high', 'max'));
  END IF;

  -- distance constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exercise_log_distance_km_check'
  ) THEN
    ALTER TABLE public.exercise_log
      ADD CONSTRAINT exercise_log_distance_km_check
      CHECK (distance_km IS NULL OR distance_km >= 0);
  END IF;

  -- sets constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exercise_log_sets_check'
  ) THEN
    ALTER TABLE public.exercise_log
      ADD CONSTRAINT exercise_log_sets_check
      CHECK (sets IS NULL OR (sets >= 0 AND sets <= 999));
  END IF;

  -- reps constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exercise_log_reps_range_check'
  ) THEN
    ALTER TABLE public.exercise_log
      ADD CONSTRAINT exercise_log_reps_range_check
      CHECK (
        (reps_min IS NULL OR (reps_min >= 1 AND reps_min <= 100))
        AND
        (reps_max IS NULL OR (reps_max >= 1 AND reps_max <= 100))
        AND
        (reps_min IS NULL OR reps_max IS NULL OR reps_min <= reps_max)
      );
  END IF;
END $$;

