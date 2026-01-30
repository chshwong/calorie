-- Fitbit Steps Sync: last steps sync timestamp
-- Adds fitbit_connections_public.last_steps_sync_at for "last synced" parity with weight.
-- Idempotent; safe to run multiple times.

ALTER TABLE public.fitbit_connections_public
  ADD COLUMN IF NOT EXISTS last_steps_sync_at timestamptz NULL;

COMMENT ON COLUMN public.fitbit_connections_public.last_steps_sync_at IS 'Last successful Fitbit steps sync timestamp (independent of activity sync).';
