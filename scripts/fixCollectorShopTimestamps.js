/**
 * Fix Collector Shop timestamp columns - INTEGER to BIGINT
 * This fixes the "value out of range for type integer" error
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function fixTimestamps() {
    console.log('🔧 Fixing Collector Shop timestamp columns...');
    
    // Connect to PostgreSQL
    const { Client } = require('pg');
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL?.includes('localhost') ? false : {
            rejectUnauthorized: false
        }
    });

    try {
        await client.connect();
        console.log('✅ Connected to PostgreSQL');

        // Check if tables exist
        const tableCheck = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('collector_shops', 'collector_departments', 'collector_storage')
        `);

        console.log(`📊 Found ${tableCheck.rows.length} collector tables`);

        if (tableCheck.rows.length === 0) {
            console.log('ℹ️  No collector tables exist yet - they will be created with correct types');
            await client.end();
            return;
        }

        // Backup existing data
        console.log('💾 Backing up existing data...');
        const shops = await client.query('SELECT * FROM collector_shops');
        const departments = await client.query('SELECT * FROM collector_departments');
        const storage = await client.query('SELECT * FROM collector_storage');
        console.log(`   - Shops: ${shops.rows.length} rows`);
        console.log(`   - Departments: ${departments.rows.length} rows`);
        console.log(`   - Storage: ${storage.rows.length} rows`);

        // Drop and recreate tables with correct types
        console.log('🗑️  Dropping old tables...');
        await client.query('DROP TABLE IF EXISTS collector_storage');
        await client.query('DROP TABLE IF EXISTS collector_departments');
        await client.query('DROP TABLE IF EXISTS collector_shops');

        console.log('🏗️  Creating new tables with BIGINT timestamps...');
        
        // Main shop data
        await client.query(`
            CREATE TABLE collector_shops (
                user_id TEXT PRIMARY KEY,
                shop_level INTEGER DEFAULT 1,
                total_upgrades INTEGER DEFAULT 0,
                lifetime_coins_generated BIGINT DEFAULT 0,
                lifetime_cards_generated INTEGER DEFAULT 0,
                created_at BIGINT DEFAULT ${Date.now()},
                updated_at BIGINT DEFAULT ${Date.now()}
            )
        `);

        // Department levels
        await client.query(`
            CREATE TABLE collector_departments (
                user_id TEXT,
                department_id TEXT,
                level INTEGER DEFAULT 0,
                total_upgrades INTEGER DEFAULT 0,
                last_collected_at BIGINT DEFAULT ${Date.now()},
                PRIMARY KEY (user_id, department_id)
            )
        `);

        // Storage for resources
        await client.query(`
            CREATE TABLE collector_storage (
                user_id TEXT,
                department_id TEXT,
                coins_stored INTEGER DEFAULT 0,
                cards_stored INTEGER DEFAULT 0,
                packs_stored INTEGER DEFAULT 0,
                last_generation_at BIGINT DEFAULT ${Date.now()},
                PRIMARY KEY (user_id, department_id)
            )
        `);

        // Restore data if any existed
        if (shops.rows.length > 0) {
            console.log('📥 Restoring shop data...');
            for (const shop of shops.rows) {
                await client.query(`
                    INSERT INTO collector_shops (
                        user_id, shop_level, total_upgrades, 
                        lifetime_coins_generated, lifetime_cards_generated,
                        created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, [
                    shop.user_id,
                    shop.shop_level,
                    shop.total_upgrades,
                    shop.lifetime_coins_generated,
                    shop.lifetime_cards_generated,
                    Date.now(),
                    Date.now()
                ]);
            }
        }

        if (departments.rows.length > 0) {
            console.log('📥 Restoring department data...');
            for (const dept of departments.rows) {
                await client.query(`
                    INSERT INTO collector_departments (
                        user_id, department_id, level, total_upgrades, last_collected_at
                    ) VALUES ($1, $2, $3, $4, $5)
                `, [
                    dept.user_id,
                    dept.department_id,
                    dept.level,
                    dept.total_upgrades,
                    Date.now()
                ]);
            }
        }

        if (storage.rows.length > 0) {
            console.log('📥 Restoring storage data...');
            for (const store of storage.rows) {
                await client.query(`
                    INSERT INTO collector_storage (
                        user_id, department_id, coins_stored, 
                        cards_stored, packs_stored, last_generation_at
                    ) VALUES ($1, $2, $3, $4, $5, $6)
                `, [
                    store.user_id,
                    store.department_id,
                    store.coins_stored,
                    store.cards_stored,
                    store.packs_stored,
                    Date.now()
                ]);
            }
        }

        console.log('✅ Collector shop tables fixed!');
        console.log('📊 Summary:');
        console.log(`   - Shops restored: ${shops.rows.length}`);
        console.log(`   - Departments restored: ${departments.rows.length}`);
        console.log(`   - Storage restored: ${storage.rows.length}`);

    } catch (error) {
        console.error('❌ Error fixing timestamps:', error);
        throw error;
    } finally {
        await client.end();
    }
}

// Run if called directly
if (require.main === module) {
    fixTimestamps()
        .then(() => {
            console.log('✅ Migration complete');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { fixTimestamps };
