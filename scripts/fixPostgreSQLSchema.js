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
        try {
            const result = await this.db.all(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'users' AND table_schema = 'public'
            `);
            const existingColumns = result.map(col => col.column_name);
            
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

            let added = 0;
            for (const column of requiredColumns) {
                if (!existingColumns.includes(column.name)) {
                    try {
                        await this.db.run(`ALTER TABLE users ADD COLUMN ${column.name} ${column.type}`);
                        this.fixedColumns.push(`users.${column.name}`);
                        added++;
                    } catch (err) {
                        // Silent fail - column might exist or be incompatible
                    }
                }
            }
            
            if (added > 0) {
                console.log(`✅ Added ${added} missing users columns`);
            }
            
        } catch (error) {
            console.error('❌ Users table schema fix failed:', error.message);
        }
    }

    async fixCardsTableSchema() {
        try {
            const result = await this.db.all(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'cards' AND table_schema = 'public'
            `);
            const existingColumns = result.map(col => col.column_name);
            
            // Make api_id nullable (local JSON files don't have API IDs)
            if (existingColumns.includes('api_id')) {
                try {
                    await this.db.run(`ALTER TABLE cards ALTER COLUMN api_id DROP NOT NULL`);
                    this.fixedColumns.push('cards.api_id (nullable)');
                } catch (err) {
                    // Silent fail
                }
            }
            
            // Fix variant_holo (holo is rarity, not variant)
            try {
                await this.db.run(`UPDATE cards SET variant_holo = FALSE WHERE variant_holo = TRUE`);
                this.fixedColumns.push('cards.variant_holo (corrected)');
            } catch (err) {
                // Silent fail
            }
            
            const requiredColumns = [
                { name: 'card_id', type: 'TEXT UNIQUE' },
                { name: 'subtype', type: 'TEXT' },
                { name: 'supertype', type: 'TEXT' },
                { name: 'types', type: 'TEXT' },
                { name: 'hp', type: 'INTEGER' },
                { name: 'artist', type: 'TEXT' },
                { name: 'flavor_text', type: 'TEXT' },
                { name: 'level', type: 'INTEGER' },
                { name: 'retreat_cost', type: 'INTEGER' },
                { name: 'converted_retreat_cost', type: 'INTEGER' },
                { name: 'attacks', type: 'TEXT' },
                { name: 'abilities', type: 'TEXT' },
                { name: 'weaknesses', type: 'TEXT' },
                { name: 'resistances', type: 'TEXT' },
                { name: 'legalities', type: 'TEXT' },
                { name: 'tcgplayer', type: 'TEXT' },
                { name: 'cardmarket', type: 'TEXT' },
                { name: 'national_pokedex_number', type: 'INTEGER' },
                { name: 'evolves_from', type: 'TEXT' },
                { name: 'evolves_to', type: 'TEXT' },
                { name: 'rules', type: 'TEXT' },
                { name: 'ancient_trait', type: 'TEXT' },
                { name: 'image_url_small', type: 'TEXT' },
                { name: 'image_url_large', type: 'TEXT' },
                { name: 'tcgplayer_url', type: 'TEXT' },
                { name: 'cardmarket_url', type: 'TEXT' },
                { name: 'created_at', type: 'BIGINT' },
                { name: 'updated_at', type: 'BIGINT' }
            ];

            let added = 0;
            for (const column of requiredColumns) {
                if (!existingColumns.includes(column.name)) {
                    try {
                        await this.db.run(`ALTER TABLE cards ADD COLUMN ${column.name} ${column.type}`);
                        this.fixedColumns.push(`cards.${column.name}`);
                        added++;
                    } catch (err) {
                        // Silent fail
                    }
                }
            }
            
            if (added > 0) {
                console.log(`✅ Added ${added} missing cards columns`);
            }
            
        } catch (error) {
            console.error('❌ Cards table schema fix failed:', error.message);
        }
    }

    async fixQuestsTableSchema() {
        try {
            const result = await this.db.all(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'quests' AND table_schema = 'public'
            `);
            const existingColumns = result.map(col => col.column_name);
            
            if (!existingColumns.includes('target_type')) {
                try {
                    await this.db.run(`ALTER TABLE quests ADD COLUMN target_type TEXT DEFAULT 'card_draws'`);
                    this.fixedColumns.push('quests.target_type');
                } catch (err) {
                    // Silent fail
                }
            }
        } catch (error) {
            // Silent fail - table might not exist yet
        }
    }

    async verifyCooldownBypass() {
        try {
            await this.db.get(`SELECT cooldown_bypass FROM users LIMIT 1`);
        } catch (error) {
            // Silent fail
        }
    }

    async fixActiveEffectsTableSchema() {
        try {
            const result = await this.db.all(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'active_effects' AND table_schema = 'public'
            `);
            const existingColumns = result.map(col => col.column_name);
            
            // Add effect_name column if missing
            if (!existingColumns.includes('effect_name')) {
                try {
                    await this.db.run(`ALTER TABLE active_effects ADD COLUMN effect_name VARCHAR(100)`);
                    this.fixedColumns.push('active_effects.effect_name');
                    console.log('✅ Added effect_name column to active_effects');
                } catch (err) {
                    console.log('⚠️ effect_name column might already exist');
                }
            }
            
            // Backfill existing rows where effect_name is NULL
            try {
                const backfillResult = await this.db.run(`
                    UPDATE active_effects 
                    SET effect_name = effect_type 
                    WHERE effect_name IS NULL
                `);
                if (backfillResult.changes > 0) {
                    console.log(`✅ Backfilled ${backfillResult.changes} rows with effect_name`);
                }
            } catch (err) {
                console.log('⚠️ Backfill skipped');
            }
            
            // Make effect_name NOT NULL if it exists
            if (existingColumns.includes('effect_name') || this.fixedColumns.includes('active_effects.effect_name')) {
                try {
                    // Check if column is already NOT NULL
                    const colInfo = await this.db.get(`
                        SELECT is_nullable 
                        FROM information_schema.columns 
                        WHERE table_name = 'active_effects' 
                        AND column_name = 'effect_name'
                    `);
                    
                    if (colInfo && colInfo.is_nullable === 'YES') {
                        await this.db.run(`
                            ALTER TABLE active_effects 
                            ALTER COLUMN effect_name SET NOT NULL
                        `);
                        this.fixedColumns.push('active_effects.effect_name (NOT NULL)');
                        console.log('✅ Set effect_name as NOT NULL');
                    }
                } catch (err) {
                    console.log('⚠️ Could not set effect_name to NOT NULL:', err.message);
                }
            }
            
        } catch (error) {
            console.error('❌ Active effects table schema fix failed:', error.message);
        }
    }

    async run() {
        const isPostgreSQL = await this.initialize();
        
        if (!isPostgreSQL) {
            await this.cleanup();
            return;
        }

        console.log('🔧 Running PostgreSQL schema fixes...');
        
        await this.fixUsersTableSchema();
        await this.fixCardsTableSchema();
        await this.fixQuestsTableSchema();
        await this.fixActiveEffectsTableSchema();
        await this.verifyCooldownBypass();
        
        if (this.fixedColumns.length > 0) {
            console.log(`✅ Schema fixes complete: ${this.fixedColumns.length} changes applied`);
        } else {
            console.log(`✅ Schema already up to date`);
        }
        
        await this.cleanup();
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
        await fixer.fixCardsTableSchema();
        await fixer.fixQuestsTableSchema();
        await fixer.fixActiveEffectsTableSchema();
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