-- Create the exercise_log table
CREATE TABLE IF NOT EXISTS public.exercise_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date date NOT NULL DEFAULT CURRENT_DATE,
    name text NOT NULL,
    minutes int,
    created_at timestamptz NOT NULL DEFAULT NOW(),

    CONSTRAINT name_length CHECK (char_length(name) <= 30),
    CONSTRAINT minutes_range CHECK (minutes IS NULL OR (minutes >= 0 AND minutes <= 999))
);

-- Index for quick per-day lookups
CREATE INDEX IF NOT EXISTS exercise_log_user_date_idx
    ON public.exercise_log (user_id, date);

-- Enable Row Level Security
ALTER TABLE public.exercise_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow user to read their own logs
CREATE POLICY "Users can select their own exercise logs"
    ON public.exercise_log FOR SELECT
    USING (auth.uid() = user_id);

-- Allow users to insert logs
CREATE POLICY "Users can insert their own exercise logs"
    ON public.exercise_log FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Allow users to update their logs
CREATE POLICY "Users can update their own exercise logs"
    ON public.exercise_log FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their logs
CREATE POLICY "Users can delete their own exercise logs"
    ON public.exercise_log FOR DELETE
    USING (auth.uid() = user_id);

