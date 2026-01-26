-- Fitbit Weight Sync support
-- Adds:
-- - explicit opt-in provider for weight sync (profiles.weight_sync_provider)
-- - provenance/idempotency fields for synced weight logs (weight_log.source, weight_log.external_id)
-- - independent last sync timestamp for weight sync (fitbit_connections_public.last_weight_sync_at)

-- ---------------------------------------------------------------------------
-- 1) Explicit opt-in: weight sync provider (future-proof enum-like string)
-- ---------------------------------------------------------------------------
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS weight_sync_provider TEXT NOT NULL DEFAULT 'none'
CHECK (weight_sync_provider IN ('none', 'fitbit'));

COMMENT ON COLUMN profiles.weight_sync_provider IS 'Explicit weight sync provider (opt-in). Values: none|fitbit';

-- ---------------------------------------------------------------------------
-- 2) Weight log provenance + idempotency for Fitbit imports
-- ---------------------------------------------------------------------------
ALTER TABLE weight_log
ADD COLUMN IF NOT EXISTS source TEXT NULL,
ADD COLUMN IF NOT EXISTS external_id TEXT NULL;

COMMENT ON COLUMN weight_log.source IS 'Provenance/source of the weight log row (e.g., fitbit, manual, system).';
COMMENT ON COLUMN weight_log.external_id IS 'External provider log identifier (e.g., Fitbit logId) for idempotent sync.';

-- Partial unique index: only enforce for Fitbit-sourced rows with an external_id.
CREATE UNIQUE INDEX IF NOT EXISTS weight_log_fitbit_user_external_id_uniq
ON public.weight_log (user_id, external_id)
WHERE source = 'fitbit' AND external_id IS NOT NULL;

-- Helpful index for day-window lookups (used by sync caps).
CREATE INDEX IF NOT EXISTS weight_log_user_weighed_at_desc_idx
ON public.weight_log (user_id, weighed_at DESC);

-- ---------------------------------------------------------------------------
-- 3) Independent sync state for Fitbit weight sync
-- ---------------------------------------------------------------------------
ALTER TABLE fitbit_connections_public
ADD COLUMN IF NOT EXISTS last_weight_sync_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN fitbit_connections_public.last_weight_sync_at IS 'Last successful Fitbit weight/body sync timestamp (independent of activity sync).';

