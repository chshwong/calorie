-- Fitbit Activity Burn Sync: persisted toggle for "Sync activity burn with Fitbit"
-- Adds profiles.sync_activity_burn (boolean, default true).
-- Idempotent; safe to run multiple times.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sync_activity_burn boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.sync_activity_burn IS 'When true, Sync Now will fetch and apply activity calories from Fitbit.';
