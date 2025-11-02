const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.dbPath = path.join(__dirname, 'pokezam.db');
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Error opening database:', err);
                    reject(err);
                } else {
                    console.log('Connected to SQLite database');
                    resolve();
                }
            });
        });
    }

    async checkAndMigrateSchema() {
        // Check if we need to migrate the cards table
        try {
            const tableInfo = await this.all("PRAGMA table_info(cards)");
            const hasApiId = tableInfo.some(column => column.name === 'api_id');
            
            if (!hasApiId && tableInfo.length > 0) {
                console.log('Migrating cards table to add api_id column...');
                await this.run('ALTER TABLE cards ADD COLUMN api_id TEXT');
                
                // Add other missing columns that might be needed
                const columnNames = tableInfo.map(col => col.name);
                const newColumns = [
                    { name: 'set_series', type: 'TEXT' },
                    { name: 'supertype', type: 'TEXT' },
                    { name: 'subtypes', type: 'TEXT' },
                    { name: 'hp', type: 'INTEGER' },
                    { name: 'types', type: 'TEXT' },
                    { name: 'attacks', type: 'TEXT' },
                    { name: 'weaknesses', type: 'TEXT' },
                    { name: 'resistances', type: 'TEXT' },
                    { name: 'retreat_cost', type: 'INTEGER DEFAULT 0' },
                    { name: 'artist', type: 'TEXT' },
                    { name: 'flavor_text', type: 'TEXT' },
                    { name: 'national_pokedex_numbers', type: 'TEXT' },
                    { name: 'image_small', type: 'TEXT' },
                    { name: 'image_large', type: 'TEXT' },
                    { name: 'tcgplayer_url', type: 'TEXT' },
                    // Master Set variant columns
                    { name: 'variant_normal', type: 'BOOLEAN DEFAULT 1' },
                    { name: 'variant_reverse', type: 'BOOLEAN DEFAULT 0' },
                    { name: 'variant_holo', type: 'BOOLEAN DEFAULT 0' },
                    { name: 'variant_first_edition', type: 'BOOLEAN DEFAULT 0' },
                    { name: 'variant_promo', type: 'BOOLEAN DEFAULT 0' },
                    { name: 'cardmarket_url', type: 'TEXT' },
                    { name: 'release_date', type: 'TEXT' },
                    { name: 'is_cached', type: 'BOOLEAN DEFAULT FALSE' },
                    { name: 'last_updated', type: 'INTEGER DEFAULT (strftime(\'%s\', \'now\'))' }
                ];
                
                for (const column of newColumns) {
                    if (!columnNames.includes(column.name)) {
                        try {
                            await this.run(`ALTER TABLE cards ADD COLUMN ${column.name} ${column.type}`);
                            console.log(`Added column: ${column.name}`);
                        } catch (err) {
                            console.log(`Column ${column.name} may already exist or cannot be added`);
                        }
                    }
                }
                
                console.log('Migration completed successfully');
            }
        } catch (error) {
            // Table doesn't exist yet, will be created in initialize
            console.log('Cards table does not exist, will be created during initialization');
        }

        // Check and migrate users table for daily rewards
        try {
            const userTableInfo = await this.all("PRAGMA table_info(users)");
            const userColumnNames = userTableInfo.map(col => col.name);
            
            const dailyColumns = [
                { name: 'last_daily_claim', type: 'TEXT' },
                { name: 'daily_streak', type: 'INTEGER DEFAULT 0' },
                { name: 'coins', type: 'INTEGER DEFAULT 0' }
            ];
            
            for (const column of dailyColumns) {
                if (!userColumnNames.includes(column.name)) {
                    try {
                        await this.run(`ALTER TABLE users ADD COLUMN ${column.name} ${column.type}`);
                        console.log(`Added daily reward column: ${column.name}`);
                    } catch (err) {
                        console.log(`Column ${column.name} may already exist`);
                    }
                }
            }
        } catch (error) {
            console.log('Users table migration check failed, will be handled in initialization');
        }
    }

    async initialize() {
        // First check if we need to migrate existing schema
        await this.checkAndMigrateSchema();
        
        const queries = [
            // Users table
            `CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                level INTEGER DEFAULT 1,
                xp INTEGER DEFAULT 0,
                gold INTEGER DEFAULT 100,
                coins INTEGER DEFAULT 0,
                total_draws INTEGER DEFAULT 0,
                guild_id INTEGER DEFAULT NULL,
                scout_level INTEGER DEFAULT 1,
                scout_start_time INTEGER DEFAULT NULL,
                scout_duration INTEGER DEFAULT NULL,
                last_draw INTEGER DEFAULT 0,
                has_started BOOLEAN DEFAULT FALSE,
                last_daily_claim TEXT,
                daily_streak INTEGER DEFAULT 0,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            )`,

            // Cards table - master card definitions with real TCG data + Master Set variants
            `CREATE TABLE IF NOT EXISTS cards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                api_id TEXT UNIQUE,
                name TEXT NOT NULL,
                set_id TEXT,
                set_name TEXT NOT NULL,
                set_series TEXT,
                number TEXT,
                rarity TEXT NOT NULL,
                supertype TEXT,
                subtypes TEXT,
                hp INTEGER,
                types TEXT,
                attacks TEXT,
                weaknesses TEXT,
                resistances TEXT,
                retreat_cost INTEGER DEFAULT 0,
                artist TEXT,
                flavor_text TEXT,
                national_pokedex_numbers TEXT,
                image_small TEXT,
                image_large TEXT,
                tcgplayer_url TEXT,
                cardmarket_url TEXT,
                release_date TEXT,
                unlock_level INTEGER DEFAULT 1,
                holo_chance REAL DEFAULT 0.1,
                is_cached BOOLEAN DEFAULT FALSE,
                
                -- Master Set variant availability flags
                variant_normal BOOLEAN DEFAULT 1,
                variant_reverse BOOLEAN DEFAULT 0,
                variant_holo BOOLEAN DEFAULT 0,
                variant_first_edition BOOLEAN DEFAULT 0,
                variant_promo BOOLEAN DEFAULT 0,
                
                last_updated INTEGER DEFAULT (strftime('%s', 'now')),
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            )`,

            // User_cards table - cards owned by users with Master Set variant tracking
            `CREATE TABLE IF NOT EXISTS user_cards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                card_id INTEGER NOT NULL,
                star_level INTEGER DEFAULT 0,
                quantity INTEGER DEFAULT 1,
                
                -- Master Set variant ownership (track which variants user owns)
                owns_normal BOOLEAN DEFAULT 0,
                owns_reverse BOOLEAN DEFAULT 0,
                owns_holo BOOLEAN DEFAULT 0,
                owns_first_edition BOOLEAN DEFAULT 0,
                owns_promo BOOLEAN DEFAULT 0,
                
                obtained_at INTEGER DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (card_id) REFERENCES cards(id),
                UNIQUE(user_id, card_id)
            )`,

            // Guilds table
            `CREATE TABLE IF NOT EXISTS guilds (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                leader_id TEXT NOT NULL,
                bank_gold INTEGER DEFAULT 0,
                member_count INTEGER DEFAULT 1,
                max_members INTEGER DEFAULT 50,
                scouting_expertise INTEGER DEFAULT 0,
                luck_charm INTEGER DEFAULT 0,
                shared_knowledge INTEGER DEFAULT 0,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (leader_id) REFERENCES users(id)
            )`,

            // Guild_buffs table - active temporary buffs
            `CREATE TABLE IF NOT EXISTS guild_buffs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id INTEGER NOT NULL,
                buff_type TEXT NOT NULL,
                expires_at INTEGER NOT NULL,
                FOREIGN KEY (guild_id) REFERENCES guilds(id)
            )`,

            // Quests table - quest definitions
            `CREATE TABLE IF NOT EXISTS quests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                quest_type TEXT NOT NULL, -- 'daily', 'weekly', or 'monthly'
                target_value INTEGER NOT NULL,
                reward_gold INTEGER NOT NULL,
                reward_xp INTEGER DEFAULT 0,
                reset_interval INTEGER NOT NULL -- seconds
            )`,

            // User_quests table - quest progress tracking
            `CREATE TABLE IF NOT EXISTS user_quests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                quest_id INTEGER NOT NULL,
                progress INTEGER DEFAULT 0,
                completed BOOLEAN DEFAULT FALSE,
                last_reset INTEGER DEFAULT (strftime('%s', 'now')),
                completed_at INTEGER DEFAULT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (quest_id) REFERENCES quests(id)
            )`,

            // Market_listings table
            `CREATE TABLE IF NOT EXISTS market_listings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                seller_id TEXT NOT NULL,
                user_card_id INTEGER NOT NULL,
                price INTEGER NOT NULL,
                listed_at INTEGER DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (seller_id) REFERENCES users(id),
                FOREIGN KEY (user_card_id) REFERENCES user_cards(id)
            )`,

            // Trades table
            `CREATE TABLE IF NOT EXISTS trades (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                initiator_id TEXT NOT NULL,
                target_id TEXT NOT NULL,
                status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'cancelled', 'completed'
                initiator_confirmed BOOLEAN DEFAULT FALSE,
                target_confirmed BOOLEAN DEFAULT FALSE,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (initiator_id) REFERENCES users(id),
                FOREIGN KEY (target_id) REFERENCES users(id)
            )`,

            // Trade_items table
            `CREATE TABLE IF NOT EXISTS trade_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                trade_id INTEGER NOT NULL,
                user_id TEXT NOT NULL,
                user_card_id INTEGER DEFAULT NULL,
                gold_amount INTEGER DEFAULT 0,
                FOREIGN KEY (trade_id) REFERENCES trades(id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (user_card_id) REFERENCES user_cards(id)
            )`,

            // Cooldowns table
            `CREATE TABLE IF NOT EXISTS cooldowns (
                user_id TEXT NOT NULL,
                command_name TEXT NOT NULL,
                expires_at INTEGER NOT NULL,
                PRIMARY KEY (user_id, command_name),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`,

            // User_items table - item inventory system
            `CREATE TABLE IF NOT EXISTS user_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                item_id TEXT NOT NULL,
                quantity INTEGER DEFAULT 1,
                obtained_at INTEGER DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (user_id) REFERENCES users(id),
                UNIQUE(user_id, item_id)
            )`,

            // Active_effects table - track active item effects
            `CREATE TABLE IF NOT EXISTS active_effects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                effect_type TEXT NOT NULL,
                category TEXT NOT NULL,
                multiplier REAL DEFAULT 1.0,
                expires_at INTEGER DEFAULT NULL,
                uses_remaining INTEGER DEFAULT NULL,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`,

            // Shop_items table - define purchasable items
            `CREATE TABLE IF NOT EXISTS shop_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                category TEXT NOT NULL,
                price INTEGER NOT NULL,
                max_stock INTEGER DEFAULT NULL,
                current_stock INTEGER DEFAULT NULL,
                is_available BOOLEAN DEFAULT TRUE,
                sort_order INTEGER DEFAULT 0,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            )`,

            // Create indexes for better performance
            `CREATE INDEX IF NOT EXISTS idx_users_guild ON users(guild_id)`,
            `CREATE INDEX IF NOT EXISTS idx_user_cards_user ON user_cards(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_user_cards_card ON user_cards(card_id)`,
            `CREATE INDEX IF NOT EXISTS idx_cards_set ON cards(set_name)`,
            `CREATE INDEX IF NOT EXISTS idx_cards_set_id ON cards(set_id)`,
            `CREATE INDEX IF NOT EXISTS idx_cards_rarity ON cards(rarity)`,
            `CREATE INDEX IF NOT EXISTS idx_cards_unlock_level ON cards(unlock_level)`,
            `CREATE INDEX IF NOT EXISTS idx_market_seller ON market_listings(seller_id)`,
            `CREATE INDEX IF NOT EXISTS idx_cooldowns_expires ON cooldowns(expires_at)`,
            `CREATE INDEX IF NOT EXISTS idx_user_quests_user ON user_quests(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_user_items_user ON user_items(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_active_effects_user ON active_effects(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_active_effects_expires ON active_effects(expires_at)`,
            `CREATE INDEX IF NOT EXISTS idx_shop_items_available ON shop_items(is_available)`
        ];

        for (const query of queries) {
            await this.run(query);
        }

        // Ensure api_id index exists after table creation
        try {
            await this.run('CREATE INDEX IF NOT EXISTS idx_cards_api_id ON cards(api_id)');
        } catch (error) {
            console.log('Note: api_id index creation skipped (may already exist)');
        }

        console.log('Database initialized successfully');
    }

    async run(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(query, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    async get(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(query, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async all(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Item management
    async addUserItem(userId, itemId, quantity = 1) {
        return this.run(
            'INSERT OR REPLACE INTO user_items (user_id, item_id, quantity) VALUES (?, ?, COALESCE((SELECT quantity FROM user_items WHERE user_id = ? AND item_id = ?), 0) + ?)',
            [userId, itemId, userId, itemId, quantity]
        );
    }

    async getUserItem(userId, itemId) {
        return this.get('SELECT * FROM user_items WHERE user_id = ? AND item_id = ?', [userId, itemId]);
    }

    async getAllUserItems(userId) {
        return this.all('SELECT * FROM user_items WHERE user_id = ? ORDER BY item_id', [userId]);
    }

    async updateItemQuantity(userId, itemId, quantity) {
        if (quantity <= 0) {
            return this.run('DELETE FROM user_items WHERE user_id = ? AND item_id = ?', [userId, itemId]);
        }
        return this.run('UPDATE user_items SET quantity = ? WHERE user_id = ? AND item_id = ?', [quantity, userId, itemId]);
    }

    async removeUserItem(userId, itemId, quantity = 1) {
        const item = await this.getUserItem(userId, itemId);
        if (!item) return false;
        
        const newQuantity = item.quantity - quantity;
        if (newQuantity <= 0) {
            await this.run('DELETE FROM user_items WHERE user_id = ? AND item_id = ?', [userId, itemId]);
        } else {
            await this.run('UPDATE user_items SET quantity = ? WHERE user_id = ? AND item_id = ?', [newQuantity, userId, itemId]);
        }
        return true;
    }

    // Active effects management
    async addActiveEffect(userId, effectType, category, multiplier, expiresAt = null, usesRemaining = null) {
        return this.run(
            'INSERT INTO active_effects (user_id, effect_type, category, multiplier, expires_at, uses_remaining) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, effectType, category, multiplier, expiresAt, usesRemaining]
        );
    }

    async getUserActiveEffects(userId) {
        return this.all('SELECT * FROM active_effects WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    }

    async removeActiveEffect(userId, effectId) {
        return this.run('DELETE FROM active_effects WHERE user_id = ? AND id = ?', [userId, effectId]);
    }

    async cleanupExpiredEffects() {
        const now = Math.floor(Date.now() / 1000);
        return this.run('DELETE FROM active_effects WHERE expires_at IS NOT NULL AND expires_at < ?', [now]);
    }

    async updateEffectUses(effectId, usesRemaining) {
        if (usesRemaining <= 0) {
            return this.run('DELETE FROM active_effects WHERE id = ?', [effectId]);
        }
        return this.run('UPDATE active_effects SET uses_remaining = ? WHERE id = ?', [usesRemaining, effectId]);
    }

    async getUserEffectsByCategory(userId, category) {
        return this.all('SELECT * FROM active_effects WHERE user_id = ? AND category = ?', [userId, category]);
    }

    // Shop items management
    async addShopItem(itemId, name, description, category, price, maxStock = null, sortOrder = 0) {
        return this.run(
            'INSERT OR REPLACE INTO shop_items (item_id, name, description, category, price, max_stock, current_stock, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [itemId, name, description, category, price, maxStock, maxStock, sortOrder]
        );
    }

    async getShopItem(itemId) {
        return this.get('SELECT * FROM shop_items WHERE item_id = ?', [itemId]);
    }

    async getAllShopItems(category = null) {
        if (category) {
            return this.all('SELECT * FROM shop_items WHERE category = ? AND is_available = TRUE ORDER BY sort_order, name', [category]);
        }
        return this.all('SELECT * FROM shop_items WHERE is_available = TRUE ORDER BY sort_order, category, name');
    }

    async updateShopStock(itemId, newStock) {
        return this.run('UPDATE shop_items SET current_stock = ? WHERE item_id = ?', [newStock, itemId]);
    }

    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err);
                } else {
                    console.log('Database connection closed');
                }
            });
        }
    }
}

module.exports = Database;