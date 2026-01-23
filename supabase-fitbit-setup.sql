-- Fitbit integration setup (web-first, OAuth2 + PKCE)
--
-- SECURITY MODEL (CRITICAL):
-- - fitbit_connections_public: user-readable (NO tokens stored here)
-- - fitbit_connections_tokens: service-role only (tokens stored here; RLS enabled with NO user policies)
-- - fitbit_oauth_sessions: short-lived PKCE + CSRF state sessions used during OAuth

-- ============================================================================
-- 1) PKCE + CSRF sessions for OAuth start/callback
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.fitbit_oauth_sessions (
  state text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_verifier text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fitbit_oauth_sessions_user_id_idx
  ON public.fitbit_oauth_sessions (user_id);

ALTER TABLE public.fitbit_oauth_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own fitbit oauth sessions" ON public.fitbit_oauth_sessions;
CREATE POLICY "Users can manage their own fitbit oauth sessions"
  ON public.fitbit_oauth_sessions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 2) Public connection status (user-readable)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.fitbit_connections_public (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  fitbit_user_id text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'active', -- active | revoked | error
  last_sync_at timestamptz NULL,
  last_error_code text NULL,
  last_error_message text NULL,
  last_error_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fitbit_connections_public ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select their own fitbit connection public" ON public.fitbit_connections_public;
CREATE POLICY "Users can select their own fitbit connection public"
  ON public.fitbit_connections_public
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own fitbit connection public" ON public.fitbit_connections_public;
CREATE POLICY "Users can insert their own fitbit connection public"
  ON public.fitbit_connections_public
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own fitbit connection public" ON public.fitbit_connections_public;
CREATE POLICY "Users can update their own fitbit connection public"
  ON public.fitbit_connections_public
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own fitbit connection public" ON public.fitbit_connections_public;
CREATE POLICY "Users can delete their own fitbit connection public"
  ON public.fitbit_connections_public
  FOR DELETE
  USING (auth.uid() = user_id);

-- Maintain updated_at automatically
CREATE OR REPLACE FUNCTION public.update_fitbit_connections_public_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fitbit_connections_public_updated_at_trigger ON public.fitbit_connections_public;
CREATE TRIGGER fitbit_connections_public_updated_at_trigger
  BEFORE UPDATE ON public.fitbit_connections_public
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fitbit_connections_public_updated_at();

-- ============================================================================
-- 3) Token storage (service-role only)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.fitbit_connections_tokens (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fitbit_connections_tokens ENABLE ROW LEVEL SECURITY;

-- NO user policies on purpose:
-- - authenticated/anon users cannot SELECT/INSERT/UPDATE/DELETE any rows
-- - Edge Functions use the service role key and bypass RLS

CREATE OR REPLACE FUNCTION public.update_fitbit_connections_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fitbit_connections_tokens_updated_at_trigger ON public.fitbit_connections_tokens;
CREATE TRIGGER fitbit_connections_tokens_updated_at_trigger
  BEFORE UPDATE ON public.fitbit_connections_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fitbit_connections_tokens_updated_at();

