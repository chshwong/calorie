-- Friends Step 2: friend_requests, friends, friend_blocks tables + RPCs + RLS
-- Idempotent; safe if columns/tables/indexes already exist.

-- ============================================================================
-- 1) Alter profiles (avoid, email_discoverable)
-- ============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avoid text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_avoid_lower
  ON public.profiles (lower(avoid)) WHERE avoid IS NOT NULL;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_discoverable boolean NOT NULL DEFAULT true;

-- ============================================================================
-- 2) friend_requests table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_email text NULL,
  target_avoid text NULL,
  requested_via text NOT NULL CHECK (requested_via IN ('avoid','email','qr','invite')),
  note_key text NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friend_requests_target_exactly_one CHECK (
    (target_email IS NOT NULL AND target_avoid IS NULL) OR
    (target_email IS NULL AND target_avoid IS NOT NULL)
  ),
  CONSTRAINT friend_requests_no_self CHECK (
    target_user_id IS NULL OR requester_user_id != target_user_id
  )
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_target_user_pending
  ON public.friend_requests (target_user_id, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_friend_requests_requester_pending
  ON public.friend_requests (requester_user_id, created_at DESC)
  WHERE status = 'pending';

-- Unique partial indexes to prevent duplicate pending requests
CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_requests_uniq_pending_user
  ON public.friend_requests (requester_user_id, target_user_id)
  WHERE status = 'pending' AND target_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_requests_uniq_pending_email
  ON public.friend_requests (requester_user_id, lower(target_email))
  WHERE status = 'pending' AND target_email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_requests_uniq_pending_avoid
  ON public.friend_requests (requester_user_id, lower(target_avoid))
  WHERE status = 'pending' AND target_avoid IS NOT NULL;

-- Ensure set_updated_at exists (from announcements or support-cases migrations)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_friend_requests_updated_at ON public.friend_requests;
CREATE TRIGGER trg_friend_requests_updated_at
  BEFORE UPDATE ON public.friend_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 3) friends table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.friends (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, friend_user_id),
  CONSTRAINT friends_no_self CHECK (user_id != friend_user_id)
);

CREATE INDEX IF NOT EXISTS idx_friends_user_id ON public.friends (user_id);

-- ============================================================================
-- 4) friend_blocks table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.friend_blocks (
  blocker_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_user_id, blocked_user_id),
  CONSTRAINT friend_blocks_no_self CHECK (blocker_user_id != blocked_user_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_blocks_blocker ON public.friend_blocks (blocker_user_id);

-- ============================================================================
-- 5) RPCs (SECURITY DEFINER)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_send_friend_request(
  p_target_type text,
  p_target_value text,
  p_note_key text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_requester uuid;
  v_target_user_id uuid := NULL;
  v_target_email text := NULL;
  v_target_avoid text := NULL;
  v_val text;
  v_exists boolean;
BEGIN
  v_requester := auth.uid();
  IF v_requester IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = 'P0001';
  END IF;

  v_val := lower(btrim(p_target_value));
  IF v_val = '' THEN
    RAISE EXCEPTION 'target_value_required' USING errcode = 'P0002';
  END IF;

  IF p_target_type = 'avoid' THEN
    v_target_avoid := btrim(p_target_value);
    SELECT user_id INTO v_target_user_id
    FROM public.profiles
    WHERE lower(avoid) = lower(v_target_avoid);
    -- Self-check
    IF v_target_user_id = v_requester THEN
      RAISE EXCEPTION 'cannot_request_self' USING errcode = 'P0003';
    END IF;
    -- Anti-spam: existing pending
    IF v_target_user_id IS NOT NULL THEN
      SELECT EXISTS(
        SELECT 1 FROM public.friend_requests
        WHERE requester_user_id = v_requester AND target_user_id = v_target_user_id AND status = 'pending'
      ) INTO v_exists;
    ELSE
      SELECT EXISTS(
        SELECT 1 FROM public.friend_requests
        WHERE requester_user_id = v_requester AND lower(target_avoid) = lower(v_target_avoid) AND status = 'pending'
      ) INTO v_exists;
    END IF;
    IF v_exists THEN
      -- Silent success to avoid probing; duplicate treated as ok
      RETURN;
    END IF;
    INSERT INTO public.friend_requests (requester_user_id, target_user_id, target_avoid, requested_via, note_key)
    VALUES (v_requester, v_target_user_id, v_target_avoid, 'avoid', p_note_key);
    RETURN;

  ELSIF p_target_type = 'email' THEN
    v_target_email := btrim(p_target_value);
    -- Resolve if discoverable and not blocked (never reveal to caller)
    SELECT au.id INTO v_target_user_id
    FROM auth.users au
    JOIN public.profiles p ON p.user_id = au.id
    WHERE lower(au.email) = lower(v_target_email)
      AND p.email_discoverable = true
      AND NOT EXISTS (
        SELECT 1 FROM public.friend_blocks b
        WHERE b.blocker_user_id = au.id AND b.blocked_user_id = v_requester
      );
    -- Self-check
    IF v_target_user_id = v_requester THEN
      RAISE EXCEPTION 'cannot_request_self' USING errcode = 'P0003';
    END IF;
    -- Anti-spam
    IF v_target_user_id IS NOT NULL THEN
      SELECT EXISTS(
        SELECT 1 FROM public.friend_requests
        WHERE requester_user_id = v_requester AND target_user_id = v_target_user_id AND status = 'pending'
      ) INTO v_exists;
    ELSE
      SELECT EXISTS(
        SELECT 1 FROM public.friend_requests
        WHERE requester_user_id = v_requester AND lower(target_email) = lower(v_target_email) AND status = 'pending'
      ) INTO v_exists;
    END IF;
    IF v_exists THEN
      RETURN;
    END IF;
    INSERT INTO public.friend_requests (requester_user_id, target_user_id, target_email, requested_via, note_key)
    VALUES (v_requester, v_target_user_id, v_target_email, 'email', p_note_key);
    RETURN;

  ELSE
    RAISE EXCEPTION 'invalid_target_type' USING errcode = 'P0004';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_accept_friend_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester uuid;
  v_target uuid;
BEGIN
  SELECT requester_user_id, target_user_id INTO v_requester, v_target
  FROM public.friend_requests
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND OR v_target != auth.uid() THEN
    RAISE EXCEPTION 'request_not_found_or_unauthorized' USING errcode = 'P0001';
  END IF;

  UPDATE public.friend_requests SET status = 'accepted', updated_at = now() WHERE id = p_request_id;

  INSERT INTO public.friends (user_id, friend_user_id)
  VALUES (auth.uid(), v_requester), (v_requester, auth.uid())
  ON CONFLICT (user_id, friend_user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_decline_friend_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.friend_requests
    WHERE id = p_request_id AND target_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'request_not_found_or_unauthorized' USING errcode = 'P0001';
  END IF;
  UPDATE public.friend_requests SET status = 'declined', updated_at = now() WHERE id = p_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_cancel_friend_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.friend_requests
    WHERE id = p_request_id AND requester_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'request_not_found_or_unauthorized' USING errcode = 'P0001';
  END IF;
  UPDATE public.friend_requests SET status = 'cancelled', updated_at = now() WHERE id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_send_friend_request TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_accept_friend_request TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_decline_friend_request TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_cancel_friend_request TO authenticated;

-- ============================================================================
-- 5b) Read RPCs (with profile joins for display; RLS blocks direct profile read)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_incoming_friend_requests()
RETURNS TABLE (
  id uuid,
  requester_user_id uuid,
  requester_avoid text,
  requester_first_name text,
  note_key text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    fr.id,
    fr.requester_user_id,
    p.avoid AS requester_avoid,
    p.first_name AS requester_first_name,
    fr.note_key,
    fr.created_at
  FROM public.friend_requests fr
  LEFT JOIN public.profiles p ON p.user_id = fr.requester_user_id
  WHERE fr.target_user_id = auth.uid() AND fr.status = 'pending'
  ORDER BY fr.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_outgoing_friend_requests()
RETURNS TABLE (
  id uuid,
  target_user_id uuid,
  target_avoid text,
  target_email text,
  target_resolved_avoid text,
  requested_via text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    fr.id,
    fr.target_user_id,
    fr.target_avoid,
    fr.target_email,
    p.avoid AS target_resolved_avoid,
    fr.requested_via,
    fr.created_at
  FROM public.friend_requests fr
  LEFT JOIN public.profiles p ON p.user_id = fr.target_user_id
  WHERE fr.requester_user_id = auth.uid() AND fr.status = 'pending'
  ORDER BY fr.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_incoming_friend_requests TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_outgoing_friend_requests TO authenticated;

DROP FUNCTION IF EXISTS public.get_my_friends();
CREATE OR REPLACE FUNCTION public.get_my_friends()
RETURNS TABLE (
  friend_user_id uuid,
  friend_avoid text,
  friend_first_name text,
  friend_avatar_url text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.friend_user_id,
    p.avoid AS friend_avoid,
    p.first_name AS friend_first_name,
    p.avatar_url AS friend_avatar_url,
    f.created_at
  FROM public.friends f
  LEFT JOIN public.profiles p ON p.user_id = f.friend_user_id
  WHERE f.user_id = auth.uid()
  ORDER BY f.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_friends TO authenticated;

-- ============================================================================
-- 6) RLS Policies
-- ============================================================================

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_blocks ENABLE ROW LEVEL SECURITY;

-- friend_requests
DROP POLICY IF EXISTS "friend_requests_select" ON public.friend_requests;
CREATE POLICY "friend_requests_select" ON public.friend_requests
  FOR SELECT TO authenticated
  USING (
    requester_user_id = auth.uid() OR target_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "friend_requests_update" ON public.friend_requests;
CREATE POLICY "friend_requests_update" ON public.friend_requests
  FOR UPDATE TO authenticated
  USING (
    (requester_user_id = auth.uid() AND status = 'pending') OR
    (target_user_id = auth.uid() AND status = 'pending')
  )
  WITH CHECK (
    (requester_user_id = auth.uid() AND status = 'cancelled') OR
    (target_user_id = auth.uid() AND status IN ('accepted','declined'))
  );

-- No INSERT/DELETE from client; RPC handles insert

-- friends
DROP POLICY IF EXISTS "friends_select" ON public.friends;
CREATE POLICY "friends_select" ON public.friends
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- friend_blocks
DROP POLICY IF EXISTS "friend_blocks_select" ON public.friend_blocks;
CREATE POLICY "friend_blocks_select" ON public.friend_blocks
  FOR SELECT TO authenticated
  USING (blocker_user_id = auth.uid());

DROP POLICY IF EXISTS "friend_blocks_insert" ON public.friend_blocks;
CREATE POLICY "friend_blocks_insert" ON public.friend_blocks
  FOR INSERT TO authenticated
  WITH CHECK (blocker_user_id = auth.uid());

DROP POLICY IF EXISTS "friend_blocks_delete" ON public.friend_blocks;
CREATE POLICY "friend_blocks_delete" ON public.friend_blocks
  FOR DELETE TO authenticated
  USING (blocker_user_id = auth.uid());
