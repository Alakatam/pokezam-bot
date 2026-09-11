/**
 * Converts older quest timestamps from seconds-based values to millisecond values.
 */

const { Client } = require('pg');

async function fixQuestTimestamps() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        return { updated: 0, skipped: true };
    }

    const client = new Client({
        connectionString,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        await client.connect();

        const threshold = 946684800000; // 2000-01-01 in ms
        const rows = await client.query(`
            SELECT id, assigned_date, completed_date
            FROM user_quests
            WHERE assigned_date < $1 OR completed_date < $1
            LIMIT 500
        `, [threshold]);

        let updated = 0;

        for (const row of rows.rows) {
            const assigned = row.assigned_date && Number(row.assigned_date) < threshold ? Number(row.assigned_date) * 1000 : row.assigned_date;
            const completed = row.completed_date && Number(row.completed_date) < threshold ? Number(row.completed_date) * 1000 : row.completed_date;

            await client.query(`
                UPDATE user_quests
                SET assigned_date = $1,
                    completed_date = $2
                WHERE id = $3
            `, [assigned, completed, row.id]);
            updated++;
        }

        return { updated, skipped: false };
    } finally {
        await client.end();
    }
}

if (require.main === module) {
    fixQuestTimestamps()
        .then((result) => {
            console.log('✅ Quest timestamps fixed', result);
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Quest timestamp fix failed:', error.message);
            process.exit(1);
        });
}

module.exports = { fixQuestTimestamps };
