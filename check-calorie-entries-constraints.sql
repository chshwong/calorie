-- Check constraints and column definitions for calorie_entries table
-- Run this in Supabase SQL Editor

-- 1. Get column information including data types, nullability, and defaults
SELECT 
    column_name,
    data_type,
    CASE 
        WHEN numeric_precision IS NOT NULL 
        THEN data_type || '(' || numeric_precision || ',' || numeric_scale || ')'
        WHEN character_maximum_length IS NOT NULL 
        THEN data_type || '(' || character_maximum_length || ')'
        ELSE data_type
    END AS full_data_type,
    is_nullable,
    column_default,
    character_maximum_length,
    numeric_precision,
    numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'calorie_entries'
ORDER BY ordinal_position;

-- 2. Get all check constraints on the table
SELECT
    tc.constraint_name,
    cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc 
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public' 
    AND tc.table_name = 'calorie_entries'
    AND tc.constraint_type = 'CHECK'
ORDER BY tc.constraint_name;

-- 3. Get all constraints (including primary keys, foreign keys, unique, check)
SELECT
    tc.constraint_type,
    tc.constraint_name,
    kc.column_name,
    cc.check_clause,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kc 
    ON tc.constraint_name = kc.constraint_name
    AND tc.table_schema = kc.table_schema
LEFT JOIN information_schema.check_constraints cc 
    ON tc.constraint_name = cc.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu 
    ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_schema = 'public' 
    AND tc.table_name = 'calorie_entries'
ORDER BY tc.constraint_type, tc.constraint_name;

-- 4. Get table structure with all details (comprehensive view)
SELECT 
    c.column_name,
    c.data_type,
    CASE 
        WHEN c.numeric_precision IS NOT NULL 
        THEN c.data_type || '(' || c.numeric_precision || ',' || c.numeric_scale || ')'
        WHEN c.character_maximum_length IS NOT NULL 
        THEN c.data_type || '(' || c.character_maximum_length || ')'
        ELSE c.data_type
    END AS full_data_type,
    c.is_nullable,
    c.column_default,
    c.numeric_precision,
    c.numeric_scale,
    CASE 
        WHEN pk.column_name IS NOT NULL THEN 'YES'
        ELSE 'NO'
    END AS is_primary_key,
    CASE 
        WHEN fk.column_name IS NOT NULL THEN 'YES'
        ELSE 'NO'
    END AS is_foreign_key,
    fk.foreign_table_name,
    fk.foreign_column_name
FROM information_schema.columns c
LEFT JOIN (
    SELECT kc.table_name, kc.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kc 
        ON tc.constraint_name = kc.constraint_name
    WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
LEFT JOIN (
    SELECT 
        kc.table_name,
        kc.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kc 
        ON tc.constraint_name = kc.constraint_name
    JOIN information_schema.constraint_column_usage ccu 
        ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
) fk ON c.table_name = fk.table_name AND c.column_name = fk.column_name
WHERE c.table_schema = 'public' 
    AND c.table_name = 'calorie_entries'
ORDER BY c.ordinal_position;

-- 5. Check for any triggers that might affect inserts/updates
SELECT
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'public'
    AND event_object_table = 'calorie_entries'
ORDER BY trigger_name;

