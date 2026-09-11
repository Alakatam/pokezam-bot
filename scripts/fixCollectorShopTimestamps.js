/**
 * Ensures collector shop timestamp columns are BIGINT on PostgreSQL.
 * This prevents Render/Postgres integer underflow issues and keeps shop timing stable.
 */

const { Client } = require('pg');

async function fixTimestamps() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.log('ℹ️  No DATABASE_URL configured, skipping shop timestamp fix');
        return { changed: 0, skipped: true };
    }

    const client = new Client({
        connectionString,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        await client.connect();

        const tables = [
            { table: 'collector_shops', columns: ['created_at', 'updated_at'] },
            { table: 'collector_departments', columns: ['last_collected_at', 'shop_opened_at'] },
            { table: 'collector_storage', columns: ['last_generation_at'] }
        ];

        let changed = 0;

        for (const { table, columns } of tables) {
            for (const column of columns) {
                try {
                    const result = await client.query(`
                        SELECT data_type
                        FROM information_schema.columns
                        WHERE table_name = $1 AND column_name = $2
                    `, [table, column]);

                    if (result.rows.length === 0) {
                        continue;
                    }

                    const type = result.rows[0].data_type;
                    if (type && type.toLowerCase() !== 'bigint' && type.toLowerCase() !== 'bigint[]') {
                        await client.query(`
                            ALTER TABLE ${table}
                            ALTER COLUMN ${column} TYPE BIGINT
                            USING ${column}::BIGINT
                        `);
                        changed++;
                    }
                } catch (error) {
                    console.warn(`⚠️  Could not normalize ${table}.${column}: ${error.message}`);
                }
            }
        }

        console.log(`✅ Collector shop timestamps fixed: ${changed} column updates`);
        return { changed, skipped: false };
    } finally {
        await client.end();
    }
}

if (require.main === module) {
    fixTimestamps()
        .then((result) => {
            console.log('🎉 Timestamp migration complete', result);
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Timestamp migration failed:', error.message);
            process.exit(1);
        });
}

module.exports = { fixTimestamps };
