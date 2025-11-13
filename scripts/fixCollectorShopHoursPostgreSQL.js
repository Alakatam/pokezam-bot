/**
 * PostgreSQL Migration: Add Shop Hours Columns
 * 
 * Adds shop_opened_at and daily_variance_multiplier columns to collector_departments
 * This is a PostgreSQL-specific fix for production database.
 */

const { Client } = require('pg');

async function fixCollectorShopHours() {
    console.log('🔧 Starting PostgreSQL Shop Hours migration...');

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        await client.connect();
        console.log('✅ Connected to PostgreSQL database');

        // Check if columns already exist
        const checkColumns = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'collector_departments' 
            AND column_name IN ('shop_opened_at', 'daily_variance_multiplier')
        `);

        const existingColumns = new Set(checkColumns.rows.map(row => row.column_name));

        if (existingColumns.has('shop_opened_at') && existingColumns.has('daily_variance_multiplier')) {
            console.log('✅ Columns already exist, no migration needed');
            return;
        }

        // Add shop_opened_at column if missing
        if (!existingColumns.has('shop_opened_at')) {
            console.log('📝 Adding shop_opened_at column...');
            await client.query(`
                ALTER TABLE collector_departments 
                ADD COLUMN shop_opened_at BIGINT DEFAULT ${Date.now()}
            `);
            console.log('✅ Added shop_opened_at column');

            // Initialize with last_collected_at values
            console.log('🔄 Initializing shop_opened_at timestamps...');
            await client.query(`
                UPDATE collector_departments 
                SET shop_opened_at = last_collected_at 
                WHERE shop_opened_at IS NULL OR shop_opened_at = 0
            `);
        }

        // Add daily_variance_multiplier column if missing
        if (!existingColumns.has('daily_variance_multiplier')) {
            console.log('📝 Adding daily_variance_multiplier column...');
            await client.query(`
                ALTER TABLE collector_departments 
                ADD COLUMN daily_variance_multiplier REAL DEFAULT 1.0
            `);
            console.log('✅ Added daily_variance_multiplier column');

            // Generate random variance for existing departments
            console.log('🎲 Generating initial variance values...');
            const departments = await client.query('SELECT user_id, department_id FROM collector_departments');
            
            for (const dept of departments.rows) {
                const variance = 0.7 + (Math.random() * 0.6); // 0.7 to 1.3
                await client.query(`
                    UPDATE collector_departments 
                    SET daily_variance_multiplier = $1 
                    WHERE user_id = $2 AND department_id = $3
                `, [variance, dept.user_id, dept.department_id]);
            }
            
            console.log(`📊 Updated ${departments.rows.length} departments with variance`);
        }

        console.log('✅ Migration completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await client.end();
        console.log('🔌 Disconnected from database');
    }
}

// Run migration if executed directly
if (require.main === module) {
    fixCollectorShopHours()
        .then(() => {
            console.log('🎉 Shop Hours system ready!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Migration error:', error);
            process.exit(1);
        });
}

module.exports = fixCollectorShopHours;
