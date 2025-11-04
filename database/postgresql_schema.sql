-- PostgreSQL Database Schema for Pokezam Bot
-- Converted from SQLite to PostgreSQL for persistent Render deployment

-- Enable UUID extension for better ID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table - Trainer profiles and progress
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(20) PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    gold INTEGER DEFAULT 1000,
    total_draws INTEGER DEFAULT 0,
    has_started BOOLEAN DEFAULT FALSE,
    created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()),
    last_daily_claim BIGINT DEFAULT 0
);

-- Cards table - Pokemon TCG card database
CREATE TABLE IF NOT EXISTS cards (
    id SERIAL PRIMARY KEY,
    api_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    set_id VARCHAR(50),
    set_name VARCHAR(200),
    set_series VARCHAR(100),
    number VARCHAR(20),
    rarity VARCHAR(50) DEFAULT 'Common',
    supertype VARCHAR(50),
    subtypes JSONB,
    hp INTEGER,
    types JSONB,
    attacks JSONB,
    weaknesses JSONB,
    resistances JSONB,
    retreat_cost JSONB,
    artist VARCHAR(200),
    flavor_text TEXT,
    national_pokedex_numbers JSONB,
    image_small VARCHAR(500),
    image_large VARCHAR(500),
    tcgplayer_url VARCHAR(500),
    cardmarket_url VARCHAR(500),
    release_date DATE,
    unlock_level INTEGER DEFAULT 1,
    holo_chance DECIMAL(3,2) DEFAULT 0.1,
    is_cached BOOLEAN DEFAULT TRUE,
    last_updated BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()),
    created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()),
    variant_normal BOOLEAN DEFAULT TRUE,
    variant_reverse BOOLEAN DEFAULT FALSE,
    variant_holo BOOLEAN DEFAULT FALSE,
    variant_first_edition BOOLEAN DEFAULT FALSE,
    variant_promo BOOLEAN DEFAULT FALSE
);

-- User card collections with variant ownership tracking
CREATE TABLE IF NOT EXISTS user_cards (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    card_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    is_holo BOOLEAN DEFAULT FALSE,
    obtained_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()),
    owns_normal BOOLEAN DEFAULT FALSE,
    owns_reverse BOOLEAN DEFAULT FALSE,
    owns_holo BOOLEAN DEFAULT FALSE,
    owns_first_edition BOOLEAN DEFAULT FALSE,
    owns_promo BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
    UNIQUE(user_id, card_id, is_holo)
);

-- Quest system
CREATE TABLE IF NOT EXISTS quests (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    quest_type VARCHAR(20) DEFAULT 'daily',
    target_type VARCHAR(50) NOT NULL,
    target_value INTEGER NOT NULL,
    reward_gold INTEGER DEFAULT 0,
    reward_xp INTEGER DEFAULT 0,
    reset_interval VARCHAR(20) DEFAULT 'daily'
);

CREATE TABLE IF NOT EXISTS user_quests (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    quest_id INTEGER NOT NULL,
    progress INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    assigned_date BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()),
    completed_date BIGINT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (quest_id) REFERENCES quests(id) ON DELETE CASCADE,
    UNIQUE(user_id, quest_id)
);

-- Active effects system (shop items, daily rewards, etc.)
CREATE TABLE IF NOT EXISTS active_effects (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    effect_name VARCHAR(100) NOT NULL,
    effect_type VARCHAR(100) NOT NULL,
    effect_value VARCHAR(100) DEFAULT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'unknown',
    multiplier DECIMAL(10,2) DEFAULT 1.0,
    expires_at BIGINT DEFAULT NULL,
    uses_remaining INTEGER DEFAULT NULL,
    created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, effect_type)
);

-- User inventory system
CREATE TABLE IF NOT EXISTS user_items (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    item_id VARCHAR(50) NOT NULL,
    quantity INTEGER DEFAULT 0,
    obtained_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, item_id)
);

-- Shop items catalog
CREATE TABLE IF NOT EXISTS shop_items (
    id SERIAL PRIMARY KEY,
    item_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    price INTEGER NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

-- Guild/Server settings
CREATE TABLE IF NOT EXISTS guilds (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(200),
    luck_bonus DECIMAL(3,2) DEFAULT 0.0,
    created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())
);

-- Set completion tracking
CREATE TABLE IF NOT EXISTS set_completion (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    set_id VARCHAR(50) NOT NULL,
    total_cards INTEGER NOT NULL,
    collected_cards INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    completion_date BIGINT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, set_id)
);

-- Set rewards
CREATE TABLE IF NOT EXISTS set_rewards (
    id SERIAL PRIMARY KEY,
    set_id VARCHAR(50) UNIQUE NOT NULL,
    set_name VARCHAR(200) NOT NULL,
    reward_gold INTEGER DEFAULT 0,
    reward_xp INTEGER DEFAULT 0,
    reward_description TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

-- Achievements system
CREATE TABLE IF NOT EXISTS achievements (
    id SERIAL PRIMARY KEY,
    achievement_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    target_value INTEGER NOT NULL,
    reward_gold INTEGER DEFAULT 0,
    reward_xp INTEGER DEFAULT 0,
    is_hidden BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_achievements (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    achievement_id VARCHAR(100) NOT NULL,
    progress INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at BIGINT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, achievement_id)
);

-- Market/Trading system (if used)
CREATE TABLE IF NOT EXISTS market_listings (
    id SERIAL PRIMARY KEY,
    seller_id VARCHAR(20) NOT NULL,
    card_id INTEGER NOT NULL,
    variant_type VARCHAR(20) DEFAULT 'normal',
    price INTEGER NOT NULL,
    created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()),
    expires_at BIGINT,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_level ON users(level);
CREATE INDEX IF NOT EXISTS idx_cards_set_id ON cards(set_id);
CREATE INDEX IF NOT EXISTS idx_cards_api_id ON cards(api_id);
CREATE INDEX IF NOT EXISTS idx_cards_unlock_level ON cards(unlock_level);
CREATE INDEX IF NOT EXISTS idx_user_cards_user_id ON user_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cards_card_id ON user_cards(card_id);
CREATE INDEX IF NOT EXISTS idx_user_quests_user_id ON user_quests(user_id);
CREATE INDEX IF NOT EXISTS idx_active_effects_user_id ON active_effects(user_id);
CREATE INDEX IF NOT EXISTS idx_active_effects_expires_at ON active_effects(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_items_user_id ON user_items(user_id);
CREATE INDEX IF NOT EXISTS idx_set_completion_user_id ON set_completion(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);