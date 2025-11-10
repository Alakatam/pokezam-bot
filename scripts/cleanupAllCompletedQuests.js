/**
 * Cleanup All Completed Quests Script
 * Removes ALL completed quests from the database to start fresh
 * Run this to clean up accumulated completed quests
 */

const DatabaseManager = require('../database/DatabaseManager');

async function cleanupAllCompletedQuests() {
    console.log('🧹 Starting cleanup of all completed quests...');
    
    const dbManager = new DatabaseManager();
    let db;
    
    try {
        // Connect to database
        db = await dbManager.connect();
        await db.initialize();
        
        console.log('📊 Connected to database');
        
        // Count completed quests before cleanup
        const beforeCount = await db.get(`
            SELECT COUNT(*) as count 
            FROM user_quests 
            WHERE completed = TRUE
        `);
        
        console.log(`📋 Found ${beforeCount.count} completed quests to remove`);
        
        if (beforeCount.count === 0) {
            console.log('✅ No completed quests found - database is clean!');
            await db.close();
            return;
        }
        
        // Delete ALL completed quests
        const result = await db.run(`
            DELETE FROM user_quests 
            WHERE completed = TRUE
        `);
        
        console.log(`🗑️  Deleted ${result.changes || beforeCount.count} completed quests`);
        
        // Verify cleanup
        const afterCount = await db.get(`
            SELECT COUNT(*) as count 
            FROM user_quests 
            WHERE completed = TRUE
        `);
        
        console.log(`📊 Completed quests remaining: ${afterCount.count}`);
        
        // Show remaining active quests
        const activeCount = await db.get(`
            SELECT COUNT(*) as count 
            FROM user_quests 
            WHERE completed = FALSE OR completed IS NULL
        `);
        
        console.log(`✅ Active quests remaining: ${activeCount.count}`);
        
        console.log('\n🎉 Cleanup complete! All completed quests removed.');
        console.log('💡 New quests will be auto-assigned on next /quest command.');
        
        await db.close();
        
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        if (db) {
            await db.close();
        }
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    cleanupAllCompletedQuests()
        .then(() => {
            console.log('\n✅ Script completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Script failed:', error);
            process.exit(1);
        });
}

module.exports = cleanupAllCompletedQuests;
