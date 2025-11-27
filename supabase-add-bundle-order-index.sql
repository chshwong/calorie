-- Add order_index column to bundles table for custom ordering
-- This allows users to reorder their bundles in the list

-- Add order_index column (defaults to 0, which will maintain existing order)
ALTER TABLE public.bundles 
ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 0;

-- Create index for efficient ordering queries
CREATE INDEX IF NOT EXISTS idx_bundles_order_index ON public.bundles(user_id, order_index);

-- Update existing bundles to have sequential order_index based on created_at
-- This ensures existing bundles maintain their current order
UPDATE public.bundles
SET order_index = subquery.row_number - 1
FROM (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as row_number
  FROM public.bundles
) AS subquery
WHERE bundles.id = subquery.id;

