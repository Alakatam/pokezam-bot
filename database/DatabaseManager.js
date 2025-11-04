/**
 * Database Migration Manager
 * 
 * Handles migration from SQLite (development) to PostgreSQL (production)
 * and provides automatic database selection based on environment.
 */

const SQLiteDatabase = require('./Database');
const PostgreSQLDatabase = require('./PostgreSQLDatabase');

class DatabaseManager {
    constructor() {
        this.database = null;
        this.dbType = null;
    }

    async connect() {
        // Determine database type based on environment
        const usePostgreSQL = (
            process.env.NODE_ENV === 'production' || 
            process.env.DATABASE_URL || 
            process.env.USE_POSTGRESQL === 'true'
        );

        if (usePostgreSQL) {
            console.log('🐘 Using PostgreSQL database for production');
            this.database = new PostgreSQLDatabase();
            this.dbType = 'postgresql';
        } else {
            console.log('📁 Using SQLite database for development');
            this.database = new SQLiteDatabase();
            this.dbType = 'sqlite';
        }

        await this.database.connect();
        return this.database;
    }

    // Migration function: SQLite → PostgreSQL
    async migrateToPostgreSQL() {
        console.log('🔄 Starting SQLite to PostgreSQL migration...');

        try {
            // Step 1: Connect to both databases
            const sqliteDb = new SQLiteDatabase();
            await sqliteDb.connect();
            
            const postgresDb = new PostgreSQLDatabase();
            await postgresDb.connect();

            // Step 2: Initialize PostgreSQL schema
            await postgresDb.initialize();

            // Step 3: Export data from SQLite
            console.log('📤 Exporting data from SQLite...');
            const backupData = {
                timestamp: new Date().toISOString(),
                type: "migration_backup",
                data: {
                    users: await sqliteDb.all('SELECT * FROM users'),
                    user_cards: await sqliteDb.all('SELECT * FROM user_cards'),
                    user_quests: await sqliteDb.all('SELECT * FROM user_quests'),
                    active_effects: await sqliteDb.all('SELECT * FROM active_effects'),
                    user_items: await sqliteDb.all('SELECT * FROM user_items'),
                    guilds: await sqliteDb.all('SELECT * FROM guilds'),
                    set_completion: await sqliteDb.all('SELECT * FROM set_completion'),
                    user_achievements: await sqliteDb.all('SELECT * FROM user_achievements'),
                    market_listings: await sqliteDb.all('SELECT * FROM market_listings'),
                    // Cards will be loaded via progressive loading
                }
            };

            // Step 4: Import data into PostgreSQL
            console.log('📥 Importing data to PostgreSQL...');
            await postgresDb.restoreFromJSON(backupData);

            // Step 5: Verify migration
            const sqliteUserCount = await sqliteDb.get('SELECT COUNT(*) as count FROM users');
            const postgresUserCount = await postgresDb.get('SELECT COUNT(*) as count FROM users');
            
            console.log(`✅ Migration verification:`);
            console.log(`   SQLite users: ${sqliteUserCount.count}`);
            console.log(`   PostgreSQL users: ${postgresUserCount.count}`);

            if (sqliteUserCount.count === postgresUserCount.count) {
                console.log('🎉 Migration completed successfully!');
            } else {
                throw new Error('User count mismatch after migration');
            }

            await sqliteDb.close();
            await postgresDb.close();

            return backupData;

        } catch (error) {
            console.error('❌ Migration failed:', error);
            throw error;
        }
    }

    // Create a backup before deployment
    async createPreDeploymentBackup() {
        console.log('💾 Creating pre-deployment backup...');

        try {
            const sqliteDb = new SQLiteDatabase();
            await sqliteDb.connect();

            const backup = {
                timestamp: new Date().toISOString(),
                type: "pre_deployment_backup",
                version: "1.0",
                description: "Backup created before PostgreSQL migration",
                data: {
                    users: await sqliteDb.all('SELECT * FROM users'),
                    user_cards: await sqliteDb.all('SELECT * FROM user_cards'),
                    user_quests: await sqliteDb.all('SELECT * FROM user_quests'),
                    active_effects: await sqliteDb.all('SELECT * FROM active_effects'),
                    user_items: await sqliteDb.all('SELECT * FROM user_items'),
                    guilds: await sqliteDb.all('SELECT * FROM guilds'),
                    set_completion: await sqliteDb.all('SELECT * FROM set_completion'),
                    user_achievements: await sqliteDb.all('SELECT * FROM user_achievements'),
                    market_listings: await sqliteDb.all('SELECT * FROM market_listings')
                },
                statistics: {
                    totalUsers: (await sqliteDb.get('SELECT COUNT(*) as count FROM users')).count,
                    totalUserCards: (await sqliteDb.get('SELECT COUNT(*) as count FROM user_cards')).count,
                    totalQuests: (await sqliteDb.get('SELECT COUNT(*) as count FROM user_quests')).count,
                }
            };

            // Save backup to file
            const fs = require('fs').promises;
            const backupPath = './pre-deployment-backup.json';
            await fs.writeFile(backupPath, JSON.stringify(backup, null, 2));

            console.log(`✅ Backup saved to: ${backupPath}`);
            console.log(`📊 Backup statistics:`, backup.statistics);

            await sqliteDb.close();
            return backup;

        } catch (error) {
            console.error('❌ Backup creation failed:', error);
            throw error;
        }
    }

    // Wrapper methods that delegate to the active database
    async all(sql, params = []) {
        return await this.database.all(sql, params);
    }

    async get(sql, params = []) {
        return await this.database.get(sql, params);
    }

    async run(sql, params = []) {
        return await this.database.run(sql, params);
    }

    async close() {
        if (this.database) {
            await this.database.close();
        }
    }

    // Initialize the database (schema setup)
    async initialize() {
        if (this.database.initialize) {
            await this.database.initialize();
        }
        
        // POSTGRESQL FIX: Apply migration fixes for missing columns
        if (this.isProduction && this.database.dbType === 'postgresql') {
            await this.applyPostgreSQLMigrationFixes();
        }
    }

    // Apply PostgreSQL migration fixes for missing columns
    async applyPostgreSQLMigrationFixes() {
        try {
            console.log('🔧 Applying PostgreSQL schema migration fixes...');
            
            const migrationQueries = [
                // Fix active_effects table
                `DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'active_effects' AND column_name = 'created_at') THEN
                        ALTER TABLE active_effects ADD COLUMN created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW());
                    END IF;
                END $$;`,
                
                `DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'active_effects' AND column_name = 'category') THEN
                        ALTER TABLE active_effects ADD COLUMN category VARCHAR(50) DEFAULT 'unknown';
                    END IF;
                END $$;`,
                
                `DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'active_effects' AND column_name = 'multiplier') THEN
                        ALTER TABLE active_effects ADD COLUMN multiplier DECIMAL(10,2) DEFAULT 1.0;
                    END IF;
                END $$;`,
                
                `DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'active_effects' AND column_name = 'uses_remaining') THEN
                        ALTER TABLE active_effects ADD COLUMN uses_remaining INTEGER DEFAULT NULL;
                    END IF;
                END $$;`,
                
                // Update existing records with NULL values
                `UPDATE active_effects SET created_at = EXTRACT(EPOCH FROM NOW()) WHERE created_at IS NULL;`,
                `UPDATE active_effects SET category = 'legacy' WHERE category IS NULL OR category = '';`,
                `UPDATE active_effects SET multiplier = 1.0 WHERE multiplier IS NULL;`
            ];
            
            for (const query of migrationQueries) {
                try {
                    await this.database.run(query);
                } catch (error) {
                    console.log(`Migration query skipped (may already exist): ${error.message}`);
                }
            }
            
            console.log('✅ PostgreSQL schema migration fixes applied successfully');
            
        } catch (error) {
            console.error('❌ Error applying PostgreSQL migration fixes:', error.message);
            // Don't throw - let the bot continue running
        }
    }

    // ===== ITEM MANAGEMENT DELEGATION =====
    
    async addUserItem(userId, itemId, quantity = 1) {
        if (this.database.addUserItem) {
            return await this.database.addUserItem(userId, itemId, quantity);
        }
        throw new Error('addUserItem method not available');
    }

    async getUserItem(userId, itemId) {
        if (this.database.getUserItem) {
            return await this.database.getUserItem(userId, itemId);
        }
        throw new Error('getUserItem method not available');
    }

    async getAllUserItems(userId) {
        if (this.database.getAllUserItems) {
            return await this.database.getAllUserItems(userId);
        }
        throw new Error('getAllUserItems method not available');
    }

    async updateItemQuantity(userId, itemId, quantity) {
        if (this.database.updateItemQuantity) {
            return await this.database.updateItemQuantity(userId, itemId, quantity);
        }
        throw new Error('updateItemQuantity method not available');
    }

    async removeUserItem(userId, itemId, quantity = 1) {
        if (this.database.removeUserItem) {
            return await this.database.removeUserItem(userId, itemId, quantity);
        }
        throw new Error('removeUserItem method not available');
    }

    // ===== ACTIVE EFFECTS DELEGATION =====
    
    async addActiveEffect(userId, effectName, effectType, multiplier, expiresAt = null, usesRemaining = null) {
        if (this.database.addActiveEffect) {
            return await this.database.addActiveEffect(userId, effectName, effectType, multiplier, expiresAt, usesRemaining);
        }
        throw new Error('addActiveEffect method not available');
    }

    async getUserActiveEffects(userId) {
        if (this.database.getUserActiveEffects) {
            return await this.database.getUserActiveEffects(userId);
        }
        throw new Error('getUserActiveEffects method not available');
    }

    async removeActiveEffect(userId, effectId) {
        if (this.database.removeActiveEffect) {
            return await this.database.removeActiveEffect(userId, effectId);
        }
        throw new Error('removeActiveEffect method not available');
    }

    async cleanupExpiredEffects() {
        if (this.database.cleanupExpiredEffects) {
            return await this.database.cleanupExpiredEffects();
        }
        throw new Error('cleanupExpiredEffects method not available');
    }

    async updateEffectUses(effectId, usesRemaining) {
        if (this.database.updateEffectUses) {
            return await this.database.updateEffectUses(effectId, usesRemaining);
        }
        throw new Error('updateEffectUses method not available');
    }

    async getUserEffectsByCategory(userId, category) {
        if (this.database.getUserEffectsByCategory) {
            return await this.database.getUserEffectsByCategory(userId, category);
        }
        throw new Error('getUserEffectsByCategory method not available');
    }

    // ===== SHOP METHODS DELEGATION =====
    
    async addShopItem(itemId, name, description, category, price, maxStock = null, sortOrder = 0) {
        if (this.database.addShopItem) {
            return await this.database.addShopItem(itemId, name, description, category, price, maxStock, sortOrder);
        }
        throw new Error('addShopItem method not available');
    }

    async getShopItem(itemId) {
        if (this.database.getShopItem) {
            return await this.database.getShopItem(itemId);
        }
        throw new Error('getShopItem method not available');
    }

    async getAllShopItems(category = null) {
        if (this.database.getAllShopItems) {
            return await this.database.getAllShopItems(category);
        }
        throw new Error('getAllShopItems method not available');
    }

    async updateShopStock(itemId, newStock) {
        if (this.database.updateShopStock) {
            return await this.database.updateShopStock(itemId, newStock);
        }
        throw new Error('updateShopStock method not available');
    }

    // ===== TRANSACTION DELEGATION =====
    
    async transaction(callback) {
        if (this.database.transaction) {
            return await this.database.transaction(callback);
        }
        throw new Error('transaction method not available');
    }
}

module.exports = DatabaseManager;