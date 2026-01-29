-- Steps columns on daily_sum_exercises (idempotent; safe to run multiple times).
-- One integer per (user_id, date); no exercise_log entries for steps.

ALTER TABLE public.daily_sum_exercises
  ADD COLUMN IF NOT EXISTS steps integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS steps_source text,
  ADD COLUMN IF NOT EXISTS steps_updated_at timestamptz;

DO $$
BEGIN
  ALTER TABLE public.daily_sum_exercises
    ADD CONSTRAINT daily_sum_exercises_steps_source_chk
    CHECK (steps_source IS NULL OR steps_source IN ('manual','fitbit','apple_health','google_fit'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
