-- Friend Nudges: table, indexes, RLS, RPCs, inbox aggregation
-- Run after supabase-friends-enforce-blocks-and-duplicates, supabase-inbox-friend-aggregate-and-delete
-- Idempotent.
--
-- Features:
-- - One-tap emoji nudges (👋 💧 💪 🔥)
-- - 8h throttle per (sender, receiver)
-- - Single aggregated Inbox "Nudges" card
-- - Friends overlay for recent nudges
-- ============================================================================

-- ============================================================================
-- A) TABLE: friend_nudges
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.friend_nudges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (emoji IN ('👋','💧','💪','🔥')),
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz NULL,
  CONSTRAINT friend_nudges_no_self CHECK (sender_user_id <> receiver_user_id)
);

-- ============================================================================
-- B) INDEXES
-- ============================================================================

-- Receiver feed (overlay)
CREATE INDEX IF NOT EXISTS idx_friend_nudges_receiver_ack_created
  ON public.friend_nudges (receiver_user_id, acknowledged_at, created_at DESC);

-- Throttle lookup
CREATE INDEX IF NOT EXISTS idx_friend_nudges_sender_receiver_created
  ON public.friend_nudges (sender_user_id, receiver_user_id, created_at DESC);

-- ============================================================================
-- C) RLS
-- ============================================================================

ALTER TABLE public.friend_nudges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "friend_nudges_select" ON public.friend_nudges;
CREATE POLICY "friend_nudges_select"
  ON public.friend_nudges
  FOR SELECT
  TO authenticated
  USING (receiver_user_id = auth.uid() OR sender_user_id = auth.uid());

DROP POLICY IF EXISTS "friend_nudges_insert" ON public.friend_nudges;
CREATE POLICY "friend_nudges_insert"
  ON public.friend_nudges
  FOR INSERT
  TO authenticated
  WITH CHECK (sender_user_id = auth.uid());

DROP POLICY IF EXISTS "friend_nudges_update" ON public.friend_nudges;
CREATE POLICY "friend_nudges_update"
  ON public.friend_nudges
  FOR UPDATE
  TO authenticated
  USING (receiver_user_id = auth.uid())
  WITH CHECK (receiver_user_id = auth.uid());

-- ============================================================================
-- D) RPC: rpc_send_friend_nudge
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_send_friend_nudge(p_receiver_user_id uuid, p_emoji text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender uuid;
  v_count int;
BEGIN
  v_sender := auth.uid();
  IF v_sender IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING errcode = 'P0001';
  END IF;

  -- Validate emoji
  IF p_emoji IS NULL OR p_emoji NOT IN ('👋','💧','💪','🔥') THEN
    RAISE EXCEPTION 'invalid emoji' USING errcode = 'P0002';
  END IF;

  -- No self-nudge
  IF p_receiver_user_id = v_sender THEN
    RAISE EXCEPTION 'cannot nudge self' USING errcode = 'P0003';
  END IF;

  -- Must be friends (either direction)
  IF NOT EXISTS (
    SELECT 1 FROM public.friends f
    WHERE (f.user_id = v_sender AND f.friend_user_id = p_receiver_user_id)
       OR (f.user_id = p_receiver_user_id AND f.friend_user_id = v_sender)
  ) THEN
    RAISE EXCEPTION 'not friends' USING errcode = 'P0010';
  END IF;

  -- Must not be blocked
  IF public.is_blocked(v_sender, p_receiver_user_id) THEN
    RAISE EXCEPTION 'blocked' USING errcode = 'P0011';
  END IF;

  -- Throttle: max 1 nudge per (sender, receiver) per 8 hours
  IF EXISTS (
    SELECT 1 FROM public.friend_nudges n
    WHERE n.sender_user_id = v_sender
      AND n.receiver_user_id = p_receiver_user_id
      AND n.created_at > now() - interval '8 hours'
  ) THEN
    RAISE EXCEPTION 'nudge_throttled' USING errcode = 'P0020';
  END IF;

  INSERT INTO public.friend_nudges (sender_user_id, receiver_user_id, emoji)
  VALUES (v_sender, p_receiver_user_id, p_emoji);

  -- Upsert aggregated inbox notification
  SELECT count(*)::int INTO v_count
  FROM public.friend_nudges
  WHERE receiver_user_id = p_receiver_user_id AND acknowledged_at IS NULL;

  INSERT INTO public.notifications (user_id, type, link_path, dedupe_key, meta)
  VALUES (
    p_receiver_user_id,
    'nudges',
    '/friends',
    'nudges_aggregate',
    jsonb_build_object('unack_count', v_count, 'latest_created_at', now())
  )
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL AND is_deleted = false
  DO UPDATE SET
    read_at = NULL,
    meta = jsonb_build_object(
      'unack_count', (SELECT count(*)::int FROM public.friend_nudges WHERE receiver_user_id = p_receiver_user_id AND acknowledged_at IS NULL),
      'latest_created_at', now()
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_send_friend_nudge(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_send_friend_nudge(uuid, text) TO authenticated;

-- ============================================================================
-- E) RPC: rpc_get_recent_nudges
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_get_recent_nudges()
RETURNS TABLE (
  id uuid,
  sender_user_id uuid,
  sender_name text,
  sender_avatar_url text,
  emoji text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    n.id,
    n.sender_user_id,
    coalesce(p.first_name, p.avoid, '')::text AS sender_name,
    p.avatar_url::text AS sender_avatar_url,
    n.emoji,
    n.created_at
  FROM public.friend_nudges n
  JOIN public.profiles p ON p.user_id = n.sender_user_id
  WHERE n.receiver_user_id = auth.uid()
    AND n.acknowledged_at IS NULL
  ORDER BY n.created_at DESC
  LIMIT 50;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_recent_nudges() FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_get_recent_nudges() TO authenticated;

-- ============================================================================
-- F) RPC: rpc_ack_recent_nudges
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_ack_recent_nudges(p_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_remaining int;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING errcode = 'P0001';
  END IF;

  UPDATE public.friend_nudges
  SET acknowledged_at = now()
  WHERE receiver_user_id = v_user
    AND id = ANY(p_ids);

  SELECT count(*)::int INTO v_remaining
  FROM public.friend_nudges
  WHERE receiver_user_id = v_user AND acknowledged_at IS NULL;

  -- If no unacknowledged nudges left, delete or mark read the aggregated notification
  IF v_remaining = 0 THEN
    UPDATE public.notifications
    SET read_at = coalesce(read_at, now()), is_deleted = true
    WHERE user_id = v_user
      AND type = 'nudges'
      AND dedupe_key = 'nudges_aggregate';
  ELSE
    UPDATE public.notifications
    SET meta = jsonb_build_object(
      'unack_count', v_remaining,
      'latest_created_at', (SELECT max(created_at)::text FROM public.friend_nudges WHERE receiver_user_id = v_user AND acknowledged_at IS NULL)
    )
    WHERE user_id = v_user
      AND type = 'nudges'
      AND dedupe_key = 'nudges_aggregate';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_ack_recent_nudges(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_ack_recent_nudges(uuid[]) TO authenticated;
