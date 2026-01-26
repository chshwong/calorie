-- Add initiating app origin to Fitbit OAuth sessions.
-- This allows the callback to redirect back to the same origin that started the OAuth flow
-- (e.g. localhost in dev, production domain in prod), while still enforcing an allowlist.

ALTER TABLE IF EXISTS public.fitbit_oauth_sessions
  ADD COLUMN IF NOT EXISTS app_origin text NULL;

