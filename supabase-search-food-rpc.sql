-- Improved food search RPC function with intrinsic ranking
-- Uses trigram similarity and token matching for better fuzzy search
-- Returns setof food_master (no extra columns)

-- Helper function to normalize search text (lowercase, remove punctuation, normalize whitespace)
-- Drop existing function first if it exists with different parameter name
DROP FUNCTION IF EXISTS public.normalize_search_text(text);

CREATE OR REPLACE FUNCTION public.normalize_search_text(input_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(regexp_replace(regexp_replace(trim(input_text), '[%(),''"]', ' ', 'g'), '\s+', ' ', 'g'));
$$;

-- Main search function
-- Drop old function with different signature first
DROP FUNCTION IF EXISTS public.search_food_master(p_query TEXT, p_user_id UUID, p_limit INTEGER);

CREATE OR REPLACE FUNCTION public.search_food_master(
    search_term text,
    limit_rows int default 50
)
RETURNS setof public.food_master
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    /*
      Improved looser search with intrinsic ranking.

      Behavior:

      - Normalize search_term with normalize_search_text().

      - Split into tokens: "fried tofu" → ["fried","tofu"].

      - A row is included if EITHER:

          * at least one token appears in name_search_normalized

        OR

          * trigram similarity with the full normalized term is above a small threshold.

      - Rows are ranked by:

          1) trigram similarity (full phrase)

          2) token_match_count (how many distinct tokens matched)

          3) is_base_food

          4) is_quality_data

          5) order_index

          6) name A–Z

      NOTE:

      - We compute token_match_count and similarity only in WHERE/ORDER BY,

        not in SELECT, so the function still returns exactly food_master columns.
    */
    WITH q AS (
        SELECT
            normalize_search_text(search_term) AS term,
            regexp_split_to_array(normalize_search_text(search_term), ' +') AS tokens
    )
    SELECT fm.*
    FROM public.food_master fm
    CROSS JOIN q
    WHERE
        q.term <> ''
        AND (
            -- at least one token appears in normalized name/brand
            (
                SELECT count(DISTINCT t)
                FROM unnest(q.tokens) AS t
                WHERE t <> ''
                  AND fm.name_search_normalized LIKE '%' || t || '%'
            ) > 0
            -- OR trigram similarity on the full phrase is decent
            OR similarity(fm.name_search_normalized, q.term) >= 0.15
        )
    ORDER BY
        -- 1) fuzzy similarity on full phrase first (handles "fried" vs "deep-fried")
        similarity(fm.name_search_normalized, q.term) DESC,
        -- 2) rows matching more distinct query tokens next
        (
            SELECT count(DISTINCT t)
            FROM unnest(q.tokens) AS t
            WHERE t <> ''
              AND fm.name_search_normalized LIKE '%' || t || '%'
        ) DESC,
        -- 3) curated flags
        coalesce(fm.is_base_food, false) DESC,
        coalesce(fm.is_quality_data, false) DESC,
        -- 4) curated order_index (lower comes first)
        coalesce(fm.order_index, 999999) ASC,
        -- 5) final tie-breaker
        fm.name ASC
    LIMIT limit_rows;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.search_food_master(text, int) TO authenticated;

-- Grant execute permission to anon users (if needed for public search)
GRANT EXECUTE ON FUNCTION public.search_food_master(text, int) TO anon;

-- Grant execute permission for the helper function
GRANT EXECUTE ON FUNCTION public.normalize_search_text TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_search_text TO anon;

