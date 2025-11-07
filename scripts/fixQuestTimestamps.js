/**
 * Fix Quest timestamp issues:
 * 1. assigned_date using seconds instead of milliseconds
 * 2. Remove duplicate quests (keep only 3 per type)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function fixQuestTimestamps() {
    console.log('🔧 Fixing quest timestamp issues...');
    
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

        // Check current assigned_date values
        const sampleQuests = await client.query(`
            SELECT user_id, quest_id, assigned_date, completed
            FROM user_quests
            ORDER BY assigned_date
            LIMIT 5
        `);

        console.log('📊 Sample quest timestamps BEFORE fix:');
        sampleQuests.rows.forEach(q => {
            const dateFromSeconds = new Date(q.assigned_date * 1000);
            const dateFromMillis = new Date(q.assigned_date);
            console.log(`   Quest ${q.quest_id}: ${q.assigned_date}`);
            console.log(`      As seconds: ${dateFromSeconds.toISOString()}`);
            console.log(`      As millis:  ${dateFromMillis.toISOString()}`);
        });

        // Fix 1: Convert assigned_date from seconds to milliseconds
        console.log('\n🔧 Converting timestamps from seconds to milliseconds...');
        
        // Identify timestamps that are in seconds (less than year 2000 in milliseconds)
        const year2000Millis = 946684800000; // Jan 1, 2000 in milliseconds
        
        const result = await client.query(`
            UPDATE user_quests
            SET assigned_date = assigned_date * 1000
            WHERE assigned_date < $1
            RETURNING user_id, quest_id, assigned_date
        `, [year2000Millis]);

        console.log(`✅ Fixed ${result.rowCount} timestamps`);

        // Fix 2: Remove duplicate quests (keep only 3 per quest type per user)
        console.log('\n🔧 Removing duplicate quests...');
        
        // Get quest counts by type
        const questCounts = await client.query(`
            SELECT u.user_id, q.quest_type, COUNT(*) as count
            FROM user_quests u
            JOIN quests q ON u.quest_id = q.id
            GROUP BY u.user_id, q.quest_type
            HAVING COUNT(*) > 3
            ORDER BY u.user_id, q.quest_type
        `);

        console.log(`📊 Found ${questCounts.rows.length} users with duplicate quests`);

        for (const row of questCounts.rows) {
            console.log(`   User ${row.user_id} - ${row.quest_type}: ${row.count} quests (removing ${row.count - 3})`);
            
            // Keep only the 3 most recent quests per type
            await client.query(`
                DELETE FROM user_quests
                WHERE id IN (
                    SELECT id FROM user_quests uq
                    JOIN quests q ON uq.quest_id = q.id
                    WHERE uq.user_id = $1 AND q.quest_type = $2
                    ORDER BY uq.assigned_date DESC
                    OFFSET 3
                )
            `, [row.user_id, row.quest_type]);
        }

        // Fix 3: Update the default value for future inserts
        console.log('\n🔧 Updating schema default for assigned_date...');
        await client.query(`
            ALTER TABLE user_quests
            ALTER COLUMN assigned_date SET DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
        `);
        console.log('✅ Schema default updated to milliseconds');

        // Verify fixes
        console.log('\n📊 Verification:');
        const finalCounts = await client.query(`
            SELECT u.user_id, q.quest_type, COUNT(*) as count
            FROM user_quests u
            JOIN quests q ON u.quest_id = q.id
            GROUP BY u.user_id, q.quest_type
            ORDER BY u.user_id, q.quest_type
        `);

        console.log('   Quest counts after fix:');
        finalCounts.rows.forEach(row => {
            const status = row.count <= 3 ? '✅' : '❌';
            console.log(`   ${status} User ${row.user_id} - ${row.quest_type}: ${row.count} quests`);
        });

        const finalSample = await client.query(`
            SELECT user_id, quest_id, assigned_date
            FROM user_quests
            ORDER BY assigned_date DESC
            LIMIT 3
        `);

        console.log('\n   Sample timestamps AFTER fix:');
        finalSample.rows.forEach(q => {
            const date = new Date(q.assigned_date);
            console.log(`   Quest ${q.quest_id}: ${q.assigned_date} → ${date.toISOString()}`);
        });

        console.log('\n✅ Quest fixes complete!');

    } catch (error) {
        console.error('❌ Error fixing quests:', error);
        throw error;
    } finally {
        await client.end();
    }
}

if (require.main === module) {
    fixQuestTimestamps()
        .then(() => {
            console.log('✅ Migration complete');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { fixQuestTimestamps };
