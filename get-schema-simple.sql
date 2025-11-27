-- Simplified schema query - Run this in Supabase SQL Editor
-- This gives you a comprehensive view of your database structure

SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    CASE 
        WHEN c.character_maximum_length IS NOT NULL 
        THEN c.data_type || '(' || c.character_maximum_length || ')'
        ELSE c.data_type
    END AS full_data_type,
    c.is_nullable,
    c.column_default,
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
FROM information_schema.tables t
JOIN information_schema.columns c 
    ON t.table_name = c.table_name
LEFT JOIN (
    SELECT kc.table_name, kc.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kc 
        ON tc.constraint_name = kc.constraint_name
    WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
) pk ON t.table_name = pk.table_name AND c.column_name = pk.column_name
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
) fk ON t.table_name = fk.table_name AND c.column_name = fk.column_name
WHERE t.table_schema = 'public'
    AND c.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;

