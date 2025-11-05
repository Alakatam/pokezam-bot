const Database = require('../database/Database');

/**
 * PostgreSQL Schema Fix for Render Production
 * Ensures all required columns exist in the production database
 */

class PostgreSQLSchemaFixer {
    constructor() {
        this.db = null;
        this.fixedColumns = [];
    }

    async initialize() {
        console.log('🔧 PostgreSQL Schema Fixer Initializing...');
        this.db = new Database();
        await this.db.connect();
        
        if (this.db.dbType !== 'postgresql') {
            console.log('⚠️  Not PostgreSQL, skipping schema fix');
            return false;
        }
        
        console.log('✅ Connected to PostgreSQL');
        return true;
    }

    async fixUsersTableSchema() {
        console.log('🔧 Fixing Users table schema...');
        
        try {
            // Get existing columns
            const result = await this.db.all(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'users' AND table_schema = 'public'
            `);
            const existingColumns = result.map(col => col.column_name);
            
            console.log(`📋 Existing users columns: ${existingColumns.length} found`);
            
            // Define required columns with PostgreSQL-specific types
            const requiredColumns = [
                { name: 'last_daily_claim', type: 'TEXT' },
                { name: 'daily_streak', type: 'INTEGER DEFAULT 0' },
                { name: 'coins', type: 'INTEGER DEFAULT 0' },
                { name: 'cooldown_bypass', type: 'BOOLEAN DEFAULT FALSE' },
                { name: 'showcase_count', type: 'INTEGER DEFAULT 0' },
                { name: 'legendary_pulls', type: 'INTEGER DEFAULT 0' },
                { name: 'ultra_pulls', type: 'INTEGER DEFAULT 0' },
                { name: 'special_pulls', type: 'INTEGER DEFAULT 0' },
                { name: 'holo_pulls', type: 'INTEGER DEFAULT 0' },
                { name: 'rare_pulls', type: 'INTEGER DEFAULT 0' },
                { name: 'total_rare_pulls', type: 'INTEGER DEFAULT 0' }
            ];

            // Add missing columns
            for (const column of requiredColumns) {
                if (!existingColumns.includes(column.name)) {
                    try {
                        await this.db.run(`ALTER TABLE users ADD COLUMN ${column.name} ${column.type}`);
                        console.log(`✅ Added users column: ${column.name}`);
                        this.fixedColumns.push(`users.${column.name}`);
                    } catch (err) {
                        console.error(`❌ Failed to add users.${column.name}:`, err.message);
                        
                        // Special handling for cooldown_bypass
                        if (column.name === 'cooldown_bypass') {
                            try {
                                await this.db.run(`ALTER TABLE users ADD COLUMN ${column.name} BOOLEAN`);
                                await this.db.run(`UPDATE users SET ${column.name} = FALSE WHERE ${column.name} IS NULL`);
                                await this.db.run(`ALTER TABLE users ALTER COLUMN ${column.name} SET DEFAULT FALSE`);
                                console.log(`✅ Added ${column.name} with alternative method`);
                                this.fixedColumns.push(`users.${column.name}`);
                            } catch (err2) {
                                console.error(`❌ Alternative method failed for ${column.name}:`, err2.message);
                            }
                        }
                    }
                } else {
                    console.log(`📋 Column users.${column.name} already exists`);
                }
            }
            
        } catch (error) {
            console.error('❌ Users table schema fix failed:', error.message);
        }
    }

    async fixQuestsTableSchema() {
        console.log('🔧 Fixing Quests table schema...');
        
        try {
            // Get existing columns
            const result = await this.db.all(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'quests' AND table_schema = 'public'
            `);
            const existingColumns = result.map(col => col.column_name);
            
            // Check for target_type column
            if (!existingColumns.includes('target_type')) {
                try {
                    await this.db.run(`ALTER TABLE quests ADD COLUMN target_type TEXT DEFAULT 'card_draws'`);
                    console.log(`✅ Added quests column: target_type`);
                    this.fixedColumns.push('quests.target_type');
                } catch (err) {
                    console.error(`❌ Failed to add quests.target_type:`, err.message);
                }
            } else {
                console.log(`📋 Column quests.target_type already exists`);
            }
            
        } catch (error) {
            console.error('❌ Quests table schema fix failed:', error.message);
        }
    }

    async verifyFixes() {
        console.log('🔍 Verifying schema fixes...');
        
        try {
            // Test cooldown_bypass column specifically
            const testResult = await this.db.get(`
                SELECT cooldown_bypass 
                FROM users 
                LIMIT 1
            `);
            
            console.log('✅ cooldown_bypass column accessible');
            
            // Show summary
            console.log('📊 Schema Fix Summary:');
            console.log(`   Columns added: ${this.fixedColumns.length}`);
            this.fixedColumns.forEach(col => {
                console.log(`   ✅ ${col}`);
            });
            
        } catch (error) {
            console.error('❌ Schema verification failed:', error.message);
        }
    }

    async cleanup() {
        if (this.db) {
            await this.db.close();
        }
    }
}

// Main execution function
async function fixPostgreSQLSchema() {
    console.log('🚀 POSTGRESQL SCHEMA FIXER FOR RENDER');
    console.log('=====================================');
    
    const fixer = new PostgreSQLSchemaFixer();
    
    try {
        const isPostgreSQL = await fixer.initialize();
        
        if (!isPostgreSQL) {
            console.log('⏭️  Skipping - not PostgreSQL database');
            return;
        }
        
        await fixer.fixUsersTableSchema();
        await fixer.fixQuestsTableSchema();
        await fixer.verifyFixes();
        
        console.log('\n🎉 PostgreSQL schema fixes complete!');
        
    } catch (error) {
        console.error('💥 Schema fix failed:', error);
        throw error;
    } finally {
        await fixer.cleanup();
    }
}

if (require.main === module) {
    fixPostgreSQLSchema().catch(error => {
        console.error('Script failed:', error);
        process.exit(1);
    });
}

module.exports = { PostgreSQLSchemaFixer, fixPostgreSQLSchema };