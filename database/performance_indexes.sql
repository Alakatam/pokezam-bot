-- PostgreSQL Performance Optimization Indexes
-- Add these indexes to improve query performance for common operations

-- Card filtering and selection optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_rarity_unlock ON cards(rarity, unlock_level);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_set_rarity ON cards(set_id, rarity);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_level_available ON cards(unlock_level) WHERE api_id IS NOT NULL;

-- User card collection optimization  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_cards_compound ON user_cards(user_id, card_id, variant);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_cards_collection ON user_cards(user_id, collected_at);

-- Active effects performance (for /zam command optimization)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_active_effects_valid ON active_effects(user_id, category) 
WHERE (expires_at IS NULL OR expires_at > EXTRACT(EPOCH FROM NOW())) 
AND (uses_remaining IS NULL OR uses_remaining > 0);

-- Quest system optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_quests_active ON user_quests(user_id, quest_id) WHERE completed = FALSE;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_quests_progress ON user_quests(user_id, progress, completed);

-- Shop and item system optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_items_item ON user_items(user_id, item_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shop_items_available ON shop_items(is_available, price);

-- Set completion tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_set_completion_tracking ON set_completion(user_id, set_id, is_completed);

-- Cleanup and maintenance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cooldowns_cleanup ON cooldowns(expires_at) WHERE expires_at < EXTRACT(EPOCH FROM NOW());
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_active_effects_cleanup ON active_effects(expires_at, uses_remaining) 
WHERE expires_at IS NOT NULL AND expires_at < EXTRACT(EPOCH FROM NOW());

-- Statistics and leaderboard optimization  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_level_gold ON users(level DESC, gold DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_draws_xp ON users(total_draws DESC, total_xp DESC);

-- TCG API performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_api_cached ON cards(api_id, is_cached) WHERE api_id IS NOT NULL;

ANALYZE;