-- PostgreSQL Schema Migration Fix
-- Add missing columns to existing tables for compatibility

-- Fix active_effects table structure
DO $$ 
BEGIN
    -- Add created_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'active_effects' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE active_effects ADD COLUMN created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW());
    END IF;
    
    -- Add category column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'active_effects' AND column_name = 'category'
    ) THEN
        ALTER TABLE active_effects ADD COLUMN category VARCHAR(50) DEFAULT 'unknown';
    END IF;
    
    -- Add multiplier column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'active_effects' AND column_name = 'multiplier'
    ) THEN
        ALTER TABLE active_effects ADD COLUMN multiplier DECIMAL(10,2) DEFAULT 1.0;
    END IF;
    
    -- Add uses_remaining column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'active_effects' AND column_name = 'uses_remaining'
    ) THEN
        ALTER TABLE active_effects ADD COLUMN uses_remaining INTEGER DEFAULT NULL;
    END IF;
END $$;

-- Fix user_items table structure
DO $$ 
BEGIN
    -- Add obtained_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_items' AND column_name = 'obtained_at'
    ) THEN
        ALTER TABLE user_items ADD COLUMN obtained_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW());
    END IF;
END $$;

-- Fix users table structure for any missing columns
DO $$ 
BEGIN
    -- Add created_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE users ADD COLUMN created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW());
    END IF;
    
    -- Add last_daily_claim column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'last_daily_claim'
    ) THEN
        ALTER TABLE users ADD COLUMN last_daily_claim BIGINT DEFAULT 0;
    END IF;
    
    -- Add total_xp column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'total_xp'
    ) THEN
        ALTER TABLE users ADD COLUMN total_xp INTEGER DEFAULT 0;
    END IF;
END $$;

-- Create indexes for performance after ensuring columns exist
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_active_effects_user_created ON active_effects(user_id, created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_active_effects_expires ON active_effects(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_items_user_item ON user_items(user_id, item_id);

-- Update any existing active_effects records that might have NULL values
UPDATE active_effects SET 
    created_at = EXTRACT(EPOCH FROM NOW()) 
WHERE created_at IS NULL;

UPDATE active_effects SET 
    category = 'legacy' 
WHERE category IS NULL OR category = '';

UPDATE active_effects SET 
    multiplier = 1.0 
WHERE multiplier IS NULL;

ANALYZE;