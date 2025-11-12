/**
 * Fix collector_pending_cards schema for PostgreSQL
 * Changes generated_at from INTEGER to BIGINT
 */

const DatabaseManager = require('../database/DatabaseManager');

async function fixSchema() {
    const dbManager = new DatabaseManager();
    const db = await dbManager.connect();

    try {
        console.log('🔧 Fixing collector_pending_cards schema...');

        // Check if table exists
        const tableExists = await db.get(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'collector_pending_cards'
            ) as exists
        `);

        if (!tableExists?.exists) {
            console.log('✅ Table does not exist yet, will be created with correct schema');
            await db.close();
            return;
        }

        // Drop existing table (it's just for testing anyway)
        console.log('Dropping old table...');
        await db.run('DROP TABLE IF EXISTS collector_pending_cards CASCADE');

        // Recreate with correct schema
        console.log('Creating table with BIGINT...');
        await db.run(`
            CREATE TABLE collector_pending_cards (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                card_id INTEGER NOT NULL,
                generated_at BIGINT NOT NULL
            )
        `);

        // Recreate indexes
        console.log('Creating indexes...');
        await db.run(`
            CREATE INDEX idx_collector_pending_user 
            ON collector_pending_cards(user_id)
        `);

        await db.run(`
            CREATE INDEX idx_collector_pending_generated 
            ON collector_pending_cards(generated_at)
        `);

        console.log('✅ Schema fixed successfully!');
        console.log('   - generated_at is now BIGINT');
        console.log('   - Indexes recreated');

    } catch (error) {
        console.error('❌ Error fixing schema:', error);
        process.exit(1);
    } finally {
        await db.close();
    }
}

// Run if called directly
if (require.main === module) {
    fixSchema()
        .then(() => {
            console.log('✅ Done!');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Fatal error:', error);
            process.exit(1);
        });
}

module.exports = fixSchema;
