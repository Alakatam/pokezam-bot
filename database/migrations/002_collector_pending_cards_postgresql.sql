-- Migration: Add pending cards table for Collector Shop (PostgreSQL)
-- This stores pre-generated cards to avoid lag spikes during collection

CREATE TABLE IF NOT EXISTS collector_pending_cards (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    card_id INTEGER NOT NULL,
    generated_at BIGINT NOT NULL,
    FOREIGN KEY (card_id) REFERENCES cards(id)
);

-- Index for fast retrieval by user
CREATE INDEX IF NOT EXISTS idx_collector_pending_user ON collector_pending_cards(user_id);

-- Index for cleanup of old pending cards
CREATE INDEX IF NOT EXISTS idx_collector_pending_generated ON collector_pending_cards(generated_at);
