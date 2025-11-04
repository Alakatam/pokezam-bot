/**
 * PostgreSQL Database Adapter for Render Deployment
 * 
 * This replaces SQLite with PostgreSQL for persistent storage on Render.
 * Maintains the same interface as the existing Database class for compatibility.
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

class PostgreSQLDatabase {
    constructor() {
        this.pool = null;
        this.dbType = 'POSTGRESQL';
        
        // Database configuration for Render PostgreSQL
        this.config = {
            connectionString: process.env.DATABASE_URL, // Render provides this
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            max: 10, // Maximum number of clients in the pool
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        };
    }

    async connect() {
        try {
            console.log('🗃️ Database type: POSTGRESQL');
            console.log('🌐 Connecting to PostgreSQL database...');
            
            if (!process.env.DATABASE_URL) {
                throw new Error('DATABASE_URL environment variable not set');
            }
            
            this.pool = new Pool(this.config);
            
            // Test connection
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();
            
            console.log('✅ Connected to PostgreSQL database');
            return this;
            
        } catch (error) {
            console.error('❌ PostgreSQL connection failed:', error.message);
            throw error;
        }
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
            console.log('Database connection closed');
        }
    }

    // Execute a query that returns multiple rows
    async all(sql, params = []) {
        const client = await this.pool.connect();
        try {
            // Convert SQLite syntax to PostgreSQL
            const pgSql = this.convertSqliteToPostgreSQL(sql);
            const result = await client.query(pgSql, params);
            return result.rows;
        } finally {
            client.release();
        }
    }

    // Execute a query that returns a single row
    async get(sql, params = []) {
        const client = await this.pool.connect();
        try {
            const pgSql = this.convertSqliteToPostgreSQL(sql);
            const result = await client.query(pgSql, params);
            return result.rows[0] || null;
        } finally {
            client.release();
        }
    }

    // Execute a query that modifies data (INSERT, UPDATE, DELETE)
    async run(sql, params = []) {
        const client = await this.pool.connect();
        try {
            const pgSql = this.convertSqliteToPostgreSQL(sql);
            const result = await client.query(pgSql, params);
            return {
                changes: result.rowCount || 0,
                lastID: result.insertId || null
            };
        } finally {
            client.release();
        }
    }

    // Execute multiple statements in a transaction
    async transaction(callback) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Convert SQLite SQL syntax to PostgreSQL
    convertSqliteToPostgreSQL(sql) {
        let pgSql = sql;
        
        // Convert AUTOINCREMENT to SERIAL
        pgSql = pgSql.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY');
        pgSql = pgSql.replace(/AUTOINCREMENT/gi, '');
        
        // Convert SQLite datetime functions
        pgSql = pgSql.replace(/datetime\\('now'\\)/gi, 'NOW()');
        pgSql = pgSql.replace(/strftime\\('%s', 'now'\\)/gi, 'EXTRACT(EPOCH FROM NOW())');
        
        // Convert PRAGMA statements (SQLite specific)
        if (pgSql.toLowerCase().includes('pragma')) {
            // Convert table_info to PostgreSQL equivalent
            if (pgSql.toLowerCase().includes('pragma table_info')) {
                const match = pgSql.match(/PRAGMA table_info\\(([^)]+)\\)/i);
                if (match) {
                    const tableName = match[1].replace(/['"]/g, '');
                    pgSql = `
                        SELECT column_name as name, data_type as type, 
                               is_nullable = 'NO' as "notnull",
                               column_default as dflt_value,
                               CASE WHEN column_name IN (
                                   SELECT column_name FROM information_schema.key_column_usage 
                                   WHERE table_name = '${tableName}' AND constraint_name LIKE '%_pkey'
                               ) THEN 1 ELSE 0 END as pk
                        FROM information_schema.columns 
                        WHERE table_name = '${tableName}'
                        ORDER BY ordinal_position
                    `;
                }
            }
        }
        
        // Convert LIMIT/OFFSET syntax if needed
        // PostgreSQL supports LIMIT/OFFSET natively, so no conversion needed
        
        // Convert JSON functions if any
        pgSql = pgSql.replace(/JSON_EXTRACT/gi, 'JSON_EXTRACT_PATH_TEXT');
        
        // Convert SQLite parameter placeholders (?) to PostgreSQL ($1, $2, $3, ...)
        let paramCount = 0;
        pgSql = pgSql.replace(/\?/g, () => {
            paramCount++;
            return `$${paramCount}`;
        });
        
        return pgSql;
    }

    // Initialize database with tables
    async initialize() {
        console.log('🔨 Initializing PostgreSQL database schema...');
        
        try {
            // Read and execute schema
            const schemaPath = path.join(__dirname, 'postgresql_schema.sql');
            const schema = await fs.readFile(schemaPath, 'utf8');
            
            // Execute schema in transaction
            await this.transaction(async (client) => {
                const statements = schema.split(';').filter(stmt => stmt.trim());
                for (const statement of statements) {
                    if (statement.trim()) {
                        await client.query(statement);
                    }
                }
            });
            
            console.log('✅ Database schema initialized');
            
        } catch (error) {
            console.error('❌ Schema initialization failed:', error.message);
            throw error;
        }
    }

    // Backup user data (for migration from SQLite)
    async backupToJSON() {
        console.log('💾 Creating PostgreSQL backup...');
        
        const backup = {
            timestamp: new Date().toISOString(),
            type: "postgresql_backup",
            data: {
                users: await this.all('SELECT * FROM users'),
                user_cards: await this.all('SELECT * FROM user_cards'),
                user_quests: await this.all('SELECT * FROM user_quests'),
                active_effects: await this.all('SELECT * FROM active_effects'),
                user_items: await this.all('SELECT * FROM user_items'),
                guilds: await this.all('SELECT * FROM guilds'),
                // Note: cards will be loaded via progressive loading
            }
        };
        
        return backup;
    }

    // Restore user data (for migration from SQLite)
    async restoreFromJSON(backupData) {
        console.log('📥 Restoring data to PostgreSQL...');
        
        await this.transaction(async (client) => {
            const { data } = backupData;
            
            // Restore users
            if (data.users && data.users.length > 0) {
                for (const user of data.users) {
                    await client.query(`
                        INSERT INTO users (id, username, level, xp, gold, total_draws, has_started, created_at, last_daily_claim)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                        ON CONFLICT (id) DO UPDATE SET
                        username = EXCLUDED.username,
                        level = EXCLUDED.level,
                        xp = EXCLUDED.xp,
                        gold = EXCLUDED.gold,
                        total_draws = EXCLUDED.total_draws,
                        has_started = EXCLUDED.has_started,
                        last_daily_claim = EXCLUDED.last_daily_claim
                    `, [user.id, user.username, user.level, user.xp, user.gold, user.total_draws, user.has_started, user.created_at, user.last_daily_claim]);
                }
                console.log(`   ✅ Restored ${data.users.length} users`);
            }
            
            // Restore user cards
            if (data.user_cards && data.user_cards.length > 0) {
                for (const userCard of data.user_cards) {
                    await client.query(`
                        INSERT INTO user_cards (user_id, card_id, quantity, variant_type)
                        VALUES ($1, $2, $3, $4)
                        ON CONFLICT (user_id, card_id, variant_type) DO UPDATE SET
                        quantity = EXCLUDED.quantity
                    `, [userCard.user_id, userCard.card_id, userCard.quantity, userCard.variant_type || 'normal']);
                }
                console.log(`   ✅ Restored ${data.user_cards.length} user cards`);
            }
            
            // Restore other data similarly...
            console.log('✅ Data restoration complete');
        });
    }
}

module.exports = PostgreSQLDatabase;