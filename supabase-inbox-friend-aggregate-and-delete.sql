-- Inbox: aggregate friend request notifications + auto-delete friend_request_accepted
-- Run after supabase-announcements-notifications, supabase-friend-cards-rpc, supabase-friends-accepted-notification
-- Idempotent.

-- ============================================================================
-- A) SCHEMA: dedupe_key, is_deleted
-- ============================================================================

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS dedupe_key text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

-- One active aggregate per (user_id, dedupe_key)
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe_unique
  ON public.notifications (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL AND is_deleted = false;

-- Filter out soft-deleted from inbox
CREATE INDEX IF NOT EXISTS idx_notifications_inbox_active
  ON public.notifications (user_id, created_at DESC, id DESC)
  WHERE is_deleted = false;

-- ============================================================================
-- B) TRIGGER: aggregate friend_request notifications (upsert, one card per user)
-- ============================================================================

DROP TRIGGER IF EXISTS trg_friend_request_notify ON public.friend_requests;

CREATE OR REPLACE FUNCTION public.trg_friend_request_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target uuid;
  v_pending_count int;
  v_created timestamptz;
BEGIN
  -- INSERT: new pending request for resolved target (skip if target has blocked requester)
  IF TG_OP = 'INSERT' AND new.status = 'pending' AND new.target_user_id IS NOT NULL THEN
    IF public.is_blocked(new.requester_user_id, new.target_user_id) THEN
      RETURN new;
    END IF;
    v_target := new.target_user_id;
    SELECT count(*)::int INTO v_pending_count
      FROM public.friend_requests
      WHERE target_user_id = v_target AND status = 'pending';

    INSERT INTO public.notifications (user_id, type, link_path, dedupe_key, meta)
    VALUES (
      v_target,
      'friend_request',
      '/friends',
      'friend_request_incoming_aggregate',
      jsonb_build_object(
        'pending_count', v_pending_count,
        'latest_created_at', now()
      )
    )
    ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL AND is_deleted = false
    DO UPDATE SET
      read_at = null,
      meta = jsonb_build_object(
        'pending_count', (SELECT count(*)::int FROM public.friend_requests WHERE target_user_id = v_target AND status = 'pending'),
        'latest_created_at', now()
      );
    RETURN new;
  END IF;

  -- UPDATE: status changed from pending (accepted/declined/cancelled)
  IF TG_OP = 'UPDATE' AND old.status = 'pending' AND new.status != 'pending' AND old.target_user_id IS NOT NULL THEN
    v_target := old.target_user_id;
    SELECT count(*)::int INTO v_pending_count
      FROM public.friend_requests
      WHERE target_user_id = v_target AND status = 'pending';

    IF v_pending_count = 0 THEN
      DELETE FROM public.notifications
      WHERE user_id = v_target
        AND type = 'friend_request'
        AND dedupe_key = 'friend_request_incoming_aggregate';
    ELSE
      UPDATE public.notifications
      SET meta = jsonb_build_object(
        'pending_count', v_pending_count,
        'latest_created_at', coalesce(meta->>'latest_created_at', created_at::text)
      )
      WHERE user_id = v_target
        AND type = 'friend_request'
        AND dedupe_key = 'friend_request_incoming_aggregate';
    END IF;
    RETURN new;
  END IF;

  RETURN new;
END;
$$;

CREATE TRIGGER trg_friend_request_notify
  AFTER INSERT OR UPDATE ON public.friend_requests
  FOR EACH ROW EXECUTE FUNCTION public.trg_friend_request_notify();

-- ============================================================================
-- C) ONE-TIME: consolidate existing friend_request rows into aggregates
-- ============================================================================

-- Delete old per-request friend_request notifications
DELETE FROM public.notifications
WHERE type = 'friend_request' AND (dedupe_key IS NULL OR dedupe_key != 'friend_request_incoming_aggregate');

-- Rebuild aggregates for users with pending requests
INSERT INTO public.notifications (user_id, type, link_path, dedupe_key, meta)
SELECT
  target_user_id,
  'friend_request',
  '/friends',
  'friend_request_incoming_aggregate',
  jsonb_build_object(
    'pending_count', cnt,
    'latest_created_at', latest_ts
  )
FROM (
  SELECT
    target_user_id,
    count(*)::int AS cnt,
    max(created_at)::text AS latest_ts
  FROM public.friend_requests
  WHERE status = 'pending' AND target_user_id IS NOT NULL
  GROUP BY target_user_id
) sub
ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL AND is_deleted = false
DO UPDATE SET
  meta = jsonb_build_object(
    'pending_count', excluded.meta->'pending_count',
    'latest_created_at', excluded.meta->>'latest_created_at'
  );

-- ============================================================================
-- D) RPC: mark_notification_read — delete friend_request_accepted on read
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_notification_read(notification_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_type text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT type INTO v_type
  FROM public.notifications
  WHERE id = notification_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF v_type = 'friend_request_accepted' THEN
    UPDATE public.notifications
    SET is_deleted = true, read_at = coalesce(read_at, now())
    WHERE id = notification_id AND user_id = v_user_id;
  ELSE
    UPDATE public.notifications
    SET read_at = now()
    WHERE id = notification_id AND user_id = v_user_id AND read_at IS NULL;
  END IF;
END;
$$;

-- ============================================================================
-- E) RPC: mark_all_inbox_notifications_read — delete friend_request_accepted
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_all_inbox_notifications_read()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.notifications
  SET
    read_at = CASE WHEN type = 'friend_request_accepted' THEN coalesce(read_at, now()) ELSE now() END,
    is_deleted = CASE WHEN type = 'friend_request_accepted' THEN true ELSE is_deleted END
  WHERE user_id = auth.uid()
    AND is_deleted = false
    AND (read_at IS NULL OR type = 'friend_request_accepted');
$$;

GRANT EXECUTE ON FUNCTION public.mark_all_inbox_notifications_read() TO authenticated;
