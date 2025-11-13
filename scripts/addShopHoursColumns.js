/**
 * Migration Script: Add Shop Hours System Columns
 * 
 * Adds shop_opened_at and daily_variance_multiplier columns to collector_departments table
 * for the new shop hours and daily variance system.
 */

const Database = require('../database/Database');

async function addShopHoursColumns() {
    console.log('🔧 Starting Shop Hours migration...');

    const db = new Database();
    await db.initialize();

    try {
        // Check if columns already exist
        const tableInfo = await db.all(`PRAGMA table_info(collector_departments)`);
        const hasShopOpenedAt = tableInfo.some(col => col.name === 'shop_opened_at');
        const hasVariance = tableInfo.some(col => col.name === 'daily_variance_multiplier');

        if (hasShopOpenedAt && hasVariance) {
            console.log('✅ Columns already exist, no migration needed');
            return;
        }

        // Add shop_opened_at column if missing
        if (!hasShopOpenedAt) {
            console.log('📝 Adding shop_opened_at column...');
            await db.run(`
                ALTER TABLE collector_departments 
                ADD COLUMN shop_opened_at ${db.dbType === 'postgresql' ? 'BIGINT' : 'INTEGER'} DEFAULT ${Date.now()}
            `);
            console.log('✅ Added shop_opened_at column');
        }

        // Add daily_variance_multiplier column if missing
        if (!hasVariance) {
            console.log('📝 Adding daily_variance_multiplier column...');
            await db.run(`
                ALTER TABLE collector_departments 
                ADD COLUMN daily_variance_multiplier REAL DEFAULT 1.0
            `);
            console.log('✅ Added daily_variance_multiplier column');
        }

        // Initialize shop_opened_at for existing departments
        console.log('🔄 Initializing shop times for existing departments...');
        await db.run(`
            UPDATE collector_departments 
            SET shop_opened_at = last_collected_at 
            WHERE shop_opened_at IS NULL OR shop_opened_at = 0
        `);

        // Generate random variance for existing departments
        console.log('🎲 Generating initial variance values...');
        const departments = await db.all('SELECT user_id, department_id FROM collector_departments');
        
        for (const dept of departments) {
            const variance = 0.7 + (Math.random() * 0.6); // 0.7 to 1.3
            await db.run(`
                UPDATE collector_departments 
                SET daily_variance_multiplier = ? 
                WHERE user_id = ? AND department_id = ?
            `, [variance, dept.user_id, dept.department_id]);
        }

        console.log('✅ Migration completed successfully!');
        console.log(`📊 Updated ${departments.length} departments`);

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await db.close();
    }
}

// Run migration
if (require.main === module) {
    addShopHoursColumns()
        .then(() => {
            console.log('🎉 Shop Hours system ready!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Migration error:', error);
            process.exit(1);
        });
}

module.exports = { addShopHoursColumns };
