/**
 * Reset All User Quests Script
 * Removes ALL user quests (completed and active) to start completely fresh
 * Run this to reset the entire quest system to default 3 daily quests
 */

const DatabaseManager = require('../database/DatabaseManager');

async function resetAllUserQuests() {
    console.log('🔄 Starting FULL quest reset...');
    console.log('⚠️  This will remove ALL quests (completed and active)');
    
    const dbManager = new DatabaseManager();
    let db;
    
    try {
        // Connect to database
        db = await dbManager.connect();
        await db.initialize();
        
        console.log('📊 Connected to database');
        
        // Count all quests before cleanup
        const beforeCount = await db.get(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN completed = TRUE THEN 1 END) as completed,
                COUNT(CASE WHEN completed = FALSE OR completed IS NULL THEN 1 END) as active
            FROM user_quests
        `);
        
        console.log(`📋 Current quest status:`);
        console.log(`   Total: ${beforeCount.total}`);
        console.log(`   Completed: ${beforeCount.completed}`);
        console.log(`   Active: ${beforeCount.active}`);
        
        if (beforeCount.total === 0) {
            console.log('✅ No quests found - database is already clean!');
            await db.close();
            return;
        }
        
        // Delete ALL user quests
        const result = await db.run(`
            DELETE FROM user_quests
        `);
        
        console.log(`🗑️  Deleted ${result.changes || beforeCount.total} quests`);
        
        // Verify cleanup
        const afterCount = await db.get(`
            SELECT COUNT(*) as count 
            FROM user_quests
        `);
        
        console.log(`📊 Quests remaining: ${afterCount.count}`);
        
        console.log('\n🎉 Full quest reset complete!');
        console.log('💡 Next /quest command will auto-assign 3 fresh daily quests.');
        
        await db.close();
        
    } catch (error) {
        console.error('❌ Error during reset:', error);
        if (db) {
            await db.close();
        }
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    resetAllUserQuests()
        .then(() => {
            console.log('\n✅ Script completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Script failed:', error);
            process.exit(1);
        });
}

module.exports = resetAllUserQuests;
