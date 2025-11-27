-- Create bundles and bundle_items tables for food bundles feature
-- This allows users to save combinations of foods and add them all at once

-- 1. Create bundles table
CREATE TABLE IF NOT EXISTS public.bundles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(name) <= 40 AND char_length(name) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create bundle_items table
CREATE TABLE IF NOT EXISTS public.bundle_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bundle_id UUID NOT NULL REFERENCES public.bundles(id) ON DELETE CASCADE,
    food_id UUID REFERENCES public.food_master(id) ON DELETE SET NULL,
    item_name TEXT, -- For manual entries without food_id
    serving_id UUID REFERENCES public.food_servings(id) ON DELETE SET NULL,
    quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
    unit TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Ensure either food_id or item_name is provided
    CHECK (
        (food_id IS NOT NULL AND item_name IS NULL) OR
        (food_id IS NULL AND item_name IS NOT NULL)
    )
);

-- 3. Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bundles_user_id ON public.bundles(user_id);
CREATE INDEX IF NOT EXISTS idx_bundles_created_at ON public.bundles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bundle_items_bundle_id ON public.bundle_items(bundle_id);
CREATE INDEX IF NOT EXISTS idx_bundle_items_order_index ON public.bundle_items(bundle_id, order_index);

-- 4. Enable Row Level Security
ALTER TABLE public.bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundle_items ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for bundles table
-- Users can read their own bundles
CREATE POLICY "Users can read their own bundles"
ON public.bundles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own bundles
CREATE POLICY "Users can insert their own bundles"
ON public.bundles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own bundles
CREATE POLICY "Users can update their own bundles"
ON public.bundles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own bundles
CREATE POLICY "Users can delete their own bundles"
ON public.bundles
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 6. Create RLS policies for bundle_items table
-- Users can read bundle items for their own bundles
CREATE POLICY "Users can read their own bundle items"
ON public.bundle_items
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.bundles
        WHERE bundles.id = bundle_items.bundle_id
        AND bundles.user_id = auth.uid()
    )
);

-- Users can insert bundle items for their own bundles
CREATE POLICY "Users can insert their own bundle items"
ON public.bundle_items
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.bundles
        WHERE bundles.id = bundle_items.bundle_id
        AND bundles.user_id = auth.uid()
    )
);

-- Users can update bundle items for their own bundles
CREATE POLICY "Users can update their own bundle items"
ON public.bundle_items
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.bundles
        WHERE bundles.id = bundle_items.bundle_id
        AND bundles.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.bundles
        WHERE bundles.id = bundle_items.bundle_id
        AND bundles.user_id = auth.uid()
    )
);

-- Users can delete bundle items for their own bundles
CREATE POLICY "Users can delete their own bundle items"
ON public.bundle_items
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.bundles
        WHERE bundles.id = bundle_items.bundle_id
        AND bundles.user_id = auth.uid()
    )
);

-- 7. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Create triggers to automatically update updated_at
DROP TRIGGER IF EXISTS update_bundles_updated_at ON public.bundles;
CREATE TRIGGER update_bundles_updated_at
    BEFORE UPDATE ON public.bundles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_bundle_items_updated_at ON public.bundle_items;
CREATE TRIGGER update_bundle_items_updated_at
    BEFORE UPDATE ON public.bundle_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

