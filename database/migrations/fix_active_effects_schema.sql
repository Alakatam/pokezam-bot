-- Fix active_effects table schema for PostgreSQL
-- Ensures effect_name column exists and handles NULL values

-- Step 1: Add effect_name column if it doesn't exist (PostgreSQL syntax)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'active_effects' 
        AND column_name = 'effect_name'
    ) THEN
        ALTER TABLE active_effects 
        ADD COLUMN effect_name VARCHAR(100);
    END IF;
END $$;

-- Step 2: Backfill existing rows where effect_name is NULL
UPDATE active_effects 
SET effect_name = effect_type 
WHERE effect_name IS NULL;

-- Step 3: Make effect_name NOT NULL after backfill
ALTER TABLE active_effects 
ALTER COLUMN effect_name SET NOT NULL;

-- Step 4: Verify schema
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'active_effects'
ORDER BY ordinal_position;
