/**
 * Ensure collector_pending_cards schema is compatible with PostgreSQL production.
 */

const { Client } = require('pg');

async function fixCollectorPendingCardsSchema() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        return { changed: 0, skipped: true };
    }

    const client = new Client({
        connectionString,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        await client.connect();

        await client.query(`
            CREATE TABLE IF NOT EXISTS collector_pending_cards (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                card_id INTEGER NOT NULL,
                generated_at BIGINT NOT NULL
            )
        `);

        const cols = await client.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'collector_pending_cards'
        `);

        const columnMap = new Map(cols.rows.map((row) => [row.column_name, row.data_type]));
        let changed = 0;

        if (columnMap.get('generated_at') && columnMap.get('generated_at').toLowerCase() !== 'bigint') {
            await client.query(`
                ALTER TABLE collector_pending_cards
                ALTER COLUMN generated_at TYPE BIGINT
                USING generated_at::BIGINT
            `);
            changed++;
        }

        if (columnMap.get('card_id') && columnMap.get('card_id').toLowerCase() !== 'integer') {
            await client.query(`
                ALTER TABLE collector_pending_cards
                ALTER COLUMN card_id TYPE INTEGER
                USING card_id::INTEGER
            `);
            changed++;
        }

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_collector_pending_user
            ON collector_pending_cards(user_id)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_collector_pending_generated
            ON collector_pending_cards(generated_at)
        `);

        return { changed, skipped: false };
    } finally {
        await client.end();
    }
}

if (require.main === module) {
    fixCollectorPendingCardsSchema()
        .then((result) => {
            console.log('✅ collector_pending_cards schema fixed', result);
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 collector_pending_cards schema fix failed:', error.message);
            process.exit(1);
        });
}

module.exports = fixCollectorPendingCardsSchema;
module.exports.fixCollectorPendingCardsSchema = fixCollectorPendingCardsSchema;
