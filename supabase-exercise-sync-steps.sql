-- Fitbit Steps Sync: persisted toggle for "Sync steps with Fitbit"
-- Adds profiles.exercise_sync_steps (boolean, default false).
-- Idempotent; safe to run multiple times.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS exercise_sync_steps boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.exercise_sync_steps IS 'When true, Sync Now will also sync steps from Fitbit (last 7 local dates).';
