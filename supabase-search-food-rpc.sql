-- Multi-word food search RPC function
-- Implements token-based matching where all query tokens must appear in name or brand
-- Example: "egg soup" matches "egg drop soup" because both "egg" and "soup" appear

CREATE OR REPLACE FUNCTION public.search_food_master(
  p_query TEXT,
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  brand TEXT,
  calories_kcal NUMERIC,
  protein_g NUMERIC,
  carbs_g NUMERIC,
  fat_g NUMERIC,
  fiber_g NUMERIC,
  sugar_g NUMERIC,
  sodium_mg NUMERIC,
  trans_fat_g NUMERIC,
  serving_size NUMERIC,
  serving_unit TEXT,
  is_custom BOOLEAN,
  owner_user_id UUID,
  is_base_food BOOLEAN,
  is_quality_data BOOLEAN,
  order_index INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_with_spaces TEXT;
  tokens TEXT[];
  token TEXT;
  normalized_token TEXT;
  where_clause TEXT;
  i INTEGER;
BEGIN
  -- Step 1: Normalize the query exactly the same way as before
  -- (lowercase, remove punctuation, unaccent, etc.) but KEEP spaces for splitting
  normalized_with_spaces := lower(trim(p_query));
  
  -- Remove common punctuation (replace with spaces to preserve word boundaries)
  normalized_with_spaces := regexp_replace(normalized_with_spaces, '[%(),''"]', ' ', 'g');
  
  -- Normalize whitespace to single spaces
  normalized_with_spaces := regexp_replace(normalized_with_spaces, '\s+', ' ', 'g');
  
  -- Remove accents (unaccent) - requires unaccent extension
  -- If unaccent extension is not available, comment this out
  -- normalized_with_spaces := unaccent(normalized_with_spaces);
  
  -- Step 2: Before removing spaces, construct token array by splitting on whitespace
  tokens := string_to_array(trim(normalized_with_spaces), ' ');
  
  -- Remove empty tokens and normalize each token (trim)
  -- The tokens will be used to match against name_search_normalized and brand_search_normalized
  -- which presumably have spaces removed
  FOR i IN 1..array_length(tokens, 1) LOOP
    IF tokens[i] IS NOT NULL AND length(trim(tokens[i])) > 0 THEN
      tokens[i] := trim(tokens[i]);
    ELSE
      tokens[i] := NULL;
    END IF;
  END LOOP;
  
  -- Remove NULL tokens
  tokens := array_remove(tokens, NULL);
  
  -- If no tokens, return empty result
  IF array_length(tokens, 1) IS NULL OR array_length(tokens, 1) = 0 THEN
    RETURN;
  END IF;
  
  -- Step 3: Build WHERE clause with token matching
  -- Each token must appear in name_search_normalized OR brand_search_normalized
  -- SQL pseudocode: WHERE (name_search_normalized LIKE '%token1%' OR brand_search_normalized LIKE '%token1%') 
  --                 AND (name_search_normalized LIKE '%token2%' OR brand_search_normalized LIKE '%token2%')
  where_clause := '';
  FOR i IN 1..array_length(tokens, 1) LOOP
    token := tokens[i];
    IF token IS NOT NULL AND length(token) > 0 THEN
      IF where_clause != '' THEN
        where_clause := where_clause || ' AND ';
      END IF;
      -- Escape special LIKE characters in token
      normalized_token := replace(replace(replace(token, '%', '\%'), '_', '\_'), '\', '\\');
      where_clause := where_clause || format(
        '(name_search_normalized LIKE %L OR brand_search_normalized LIKE %L)',
        '%' || normalized_token || '%',
        '%' || normalized_token || '%'
      );
    END IF;
  END LOOP;
  
  -- Ensure where_clause is not empty
  IF where_clause = '' THEN
    RETURN;
  END IF;
  
  -- Step 4: Build and execute query
  -- Security: Only include custom foods that belong to this user, or base foods (is_custom = false/null)
  RETURN QUERY
  EXECUTE format('
    SELECT 
      fm.id,
      fm.name,
      fm.brand,
      fm.calories_kcal,
      fm.protein_g,
      fm.carbs_g,
      fm.fat_g,
      fm.fiber_g,
      fm.sugar_g,
      fm.sodium_mg,
      fm.trans_fat_g,
      fm.serving_size,
      fm.serving_unit,
      fm.is_custom,
      fm.owner_user_id,
      fm.is_base_food,
      fm.is_quality_data,
      fm.order_index,
      fm.created_at,
      fm.updated_at
    FROM food_master fm
    WHERE (%s)
      AND (
        (fm.is_custom = false OR fm.is_custom IS NULL)
        OR (fm.is_custom = true AND fm.owner_user_id = %L)
      )
    ORDER BY
      CASE WHEN fm.is_base_food = true THEN 0 ELSE 1 END,
      CASE WHEN fm.is_quality_data = true THEN 0 ELSE 1 END,
      COALESCE(fm.order_index, 0) ASC,
      fm.name ASC
    LIMIT %s
  ', where_clause, p_user_id, p_limit);
  
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.search_food_master TO authenticated;

-- Grant execute permission to anon users (if needed for public search)
GRANT EXECUTE ON FUNCTION public.search_food_master TO anon;

