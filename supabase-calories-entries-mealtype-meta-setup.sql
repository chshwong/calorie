-- Create the calories_entries_mealtype_meta table
CREATE TABLE IF NOT EXISTS public.calories_entries_mealtype_meta (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entry_date date NOT NULL,
    meal_type text NOT NULL,
    quick_kcal numeric NULL,
    quick_protein_g numeric NULL,
    quick_carbs_g numeric NULL,
    quick_fat_g numeric NULL,
    note text NULL,
    inserted_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    CONSTRAINT calories_entries_mealtype_meta_user_date_meal_unique UNIQUE (user_id, entry_date, meal_type)
);

-- Add new columns if they don't exist (for existing tables)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'calories_entries_mealtype_meta' 
        AND column_name = 'quick_fiber_g'
    ) THEN
        ALTER TABLE public.calories_entries_mealtype_meta 
        ADD COLUMN quick_fiber_g numeric NULL;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'calories_entries_mealtype_meta' 
        AND column_name = 'quick_sodium_mg'
    ) THEN
        ALTER TABLE public.calories_entries_mealtype_meta 
        ADD COLUMN quick_sodium_mg numeric NULL;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'calories_entries_mealtype_meta' 
        AND column_name = 'quick_sugar_g'
    ) THEN
        ALTER TABLE public.calories_entries_mealtype_meta 
        ADD COLUMN quick_sugar_g numeric NULL;
    END IF;
END $$;

-- Index for quick per-day lookups
CREATE INDEX IF NOT EXISTS calories_entries_mealtype_meta_user_date_idx
    ON public.calories_entries_mealtype_meta (user_id, entry_date);

-- Enable Row Level Security
ALTER TABLE public.calories_entries_mealtype_meta ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can select their own mealtype meta" ON public.calories_entries_mealtype_meta;
DROP POLICY IF EXISTS "Users can insert their own mealtype meta" ON public.calories_entries_mealtype_meta;
DROP POLICY IF EXISTS "Users can update their own mealtype meta" ON public.calories_entries_mealtype_meta;
DROP POLICY IF EXISTS "Users can delete their own mealtype meta" ON public.calories_entries_mealtype_meta;

-- RLS Policies
-- Allow user to read their own meta
CREATE POLICY "Users can select their own mealtype meta"
    ON public.calories_entries_mealtype_meta FOR SELECT
    USING (auth.uid() = user_id);

-- Allow users to insert meta
CREATE POLICY "Users can insert their own mealtype meta"
    ON public.calories_entries_mealtype_meta FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Allow users to update their meta
CREATE POLICY "Users can update their own mealtype meta"
    ON public.calories_entries_mealtype_meta FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their meta
CREATE POLICY "Users can delete their own mealtype meta"
    ON public.calories_entries_mealtype_meta FOR DELETE
    USING (auth.uid() = user_id);

-- Create trigger function for updated_at (reuse if exists)
CREATE OR REPLACE FUNCTION update_calories_entries_mealtype_meta_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS calories_entries_mealtype_meta_updated_at_trigger ON public.calories_entries_mealtype_meta;

-- Create trigger
CREATE TRIGGER calories_entries_mealtype_meta_updated_at_trigger
    BEFORE UPDATE ON public.calories_entries_mealtype_meta
    FOR EACH ROW
    EXECUTE FUNCTION update_calories_entries_mealtype_meta_updated_at();
