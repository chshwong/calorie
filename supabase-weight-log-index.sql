-- Index for efficient weight_log range queries
-- Supports queries: WHERE user_id = ? AND weighed_at BETWEEN start AND end ORDER BY weighed_at

CREATE INDEX IF NOT EXISTS weight_log_user_weighed_at_idx
ON public.weight_log (user_id, weighed_at);

