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
    }
}

module.exports = DatabaseManager;