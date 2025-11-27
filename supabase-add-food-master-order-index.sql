-- Add order_index column to food_master table for custom food ordering
-- This allows users to reorder their custom foods in the list

-- Add order_index column (defaults to 0, which will maintain existing order)
ALTER TABLE public.food_master 
ADD COLUMN IF NOT EXISTS order_index INTEGER;

-- Create index for efficient ordering queries (only for custom foods)
CREATE INDEX IF NOT EXISTS idx_food_master_order_index ON public.food_master(owner_user_id, order_index) 
WHERE is_custom = true;

-- Update existing custom foods to have sequential order_index based on alphabetical order
-- This ensures existing custom foods maintain their current alphabetical order
UPDATE public.food_master
SET order_index = subquery.row_number - 1
FROM (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY owner_user_id ORDER BY name ASC) as row_number
  FROM public.food_master
  WHERE is_custom = true
) AS subquery
WHERE food_master.id = subquery.id
  AND food_master.is_custom = true;

