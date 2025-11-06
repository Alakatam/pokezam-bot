const { Pool } = require('pg');
require('dotenv').config();

async function addCooldownBypassColumn() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? {
            rejectUnauthorized: false
        } : false
    });

    try {
        console.log('🔄 Adding cooldown_bypass column to users table...');

        // Check if column already exists
        const checkColumn = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            AND column_name = 'cooldown_bypass'
        `);

        if (checkColumn.rows.length > 0) {
            console.log('✅ Column cooldown_bypass already exists!');
        } else {
            // Add the column
            await pool.query(`
                ALTER TABLE users 
                ADD COLUMN cooldown_bypass BOOLEAN DEFAULT FALSE
            `);
            console.log('✅ Successfully added cooldown_bypass column!');
        }

        // Show current users with bypass enabled (should be none initially)
        const usersWithBypass = await pool.query(`
            SELECT id, username, cooldown_bypass 
            FROM users 
            WHERE cooldown_bypass = TRUE
        `);
        
        console.log(`\n📊 Users with cooldown bypass: ${usersWithBypass.rows.length}`);
        if (usersWithBypass.rows.length > 0) {
            console.log(usersWithBypass.rows);
        }

        console.log('\n✅ Migration complete!');
        console.log('💡 Use /admin toggle-cooldown to enable/disable cooldown bypass for users');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

// Run if called directly
if (require.main === module) {
    addCooldownBypassColumn()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { addCooldownBypassColumn };
