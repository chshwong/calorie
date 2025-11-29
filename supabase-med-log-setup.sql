-- Create the med_log table
CREATE TABLE IF NOT EXISTS public.med_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date date NOT NULL DEFAULT CURRENT_DATE,
    name text NOT NULL,
    type text NOT NULL,
    dose_amount int,
    dose_unit text,
    notes text,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT med_log_name_length CHECK (char_length(name) <= 30),
    CONSTRAINT med_log_type_valid CHECK (type IN ('med','supp','other')),
    CONSTRAINT med_log_dose_unit_length CHECK (dose_unit IS NULL OR char_length(dose_unit) <= 10),
    CONSTRAINT med_log_notes_length CHECK (notes IS NULL OR char_length(notes) <= 200),
    CONSTRAINT med_log_dose_amount_range CHECK (dose_amount IS NULL OR (dose_amount >= 0 AND dose_amount <= 9999))
);

-- Index for quick per-day lookups
CREATE INDEX IF NOT EXISTS med_log_user_date_idx
    ON public.med_log (user_id, date);

-- Enable Row Level Security
ALTER TABLE public.med_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can select their own med logs"
    ON public.med_log FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own med logs"
    ON public.med_log FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own med logs"
    ON public.med_log FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own med logs"
    ON public.med_log FOR DELETE
    USING (auth.uid() = user_id);

