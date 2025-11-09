// Manual cleanup script to remove old completed quests
// Run this once to clean up the backlog of accumulated quests

const { Client } = require('pg');

async function cleanupOldQuests() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        await client.connect();
        console.log('📡 Connected to database');

        // Get current time for comparison
        const now = Date.now();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);
        const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000);

        console.log('\n🧹 Starting quest cleanup...');
        console.log(`⏰ Current time: ${new Date(now).toISOString()}`);
        console.log(`📅 One day ago: ${new Date(oneDayAgo).toISOString()}`);

        // Clean up daily quests
        const dailyResult = await client.query(`
            DELETE FROM user_quests 
            WHERE completed = TRUE 
            AND quest_id IN (SELECT id FROM quests WHERE quest_type = 'daily')
            AND (
                completed_date < $1 
                OR (completed_date IS NULL AND assigned_date < $1)
            )
            RETURNING user_id
        `, [oneDayAgo]);
        
        console.log(`✅ Deleted ${dailyResult.rowCount} old daily quests`);

        // Clean up weekly quests
        const weeklyResult = await client.query(`
            DELETE FROM user_quests 
            WHERE completed = TRUE 
            AND quest_id IN (SELECT id FROM quests WHERE quest_type = 'weekly')
            AND (
                completed_date < $1 
                OR (completed_date IS NULL AND assigned_date < $1)
            )
            RETURNING user_id
        `, [oneWeekAgo]);
        
        console.log(`✅ Deleted ${weeklyResult.rowCount} old weekly quests`);

        // Clean up monthly quests
        const monthlyResult = await client.query(`
            DELETE FROM user_quests 
            WHERE completed = TRUE 
            AND quest_id IN (SELECT id FROM quests WHERE quest_type = 'monthly')
            AND (
                completed_date < $1 
                OR (completed_date IS NULL AND assigned_date < $1)
            )
            RETURNING user_id
        `, [oneMonthAgo]);
        
        console.log(`✅ Deleted ${monthlyResult.rowCount} old monthly quests`);

        // Show remaining quest count per user
        const remaining = await client.query(`
            SELECT user_id, COUNT(*) as quest_count
            FROM user_quests
            GROUP BY user_id
            HAVING COUNT(*) > 15
            ORDER BY quest_count DESC
        `);

        if (remaining.rowCount > 0) {
            console.log('\n⚠️  Users still with >15 quests:');
            remaining.rows.forEach(row => {
                console.log(`   User ${row.user_id}: ${row.quest_count} quests`);
            });
        } else {
            console.log('\n✅ All users have reasonable quest counts');
        }

        console.log('\n🎉 Cleanup complete!');

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    } finally {
        await client.end();
    }
}

// Run if executed directly
if (require.main === module) {
    cleanupOldQuests().catch(console.error);
}

module.exports = { cleanupOldQuests };
