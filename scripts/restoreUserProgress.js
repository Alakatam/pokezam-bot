const Database = require('../database/Database');

async function restoreUserProgress() {
    const db = new Database();
    
    try {
        await db.connect();
        
        console.log('📋 Restoring tamzam user progress...');
        
        // Get current user state
        const currentUser = await db.get('SELECT * FROM users WHERE id = ?', ['411307913429254174']);
        if (!currentUser) {
            console.log('❌ User not found');
            return;
        }
        
        console.log('Current state:');
        console.log('- Level:', currentUser.level);
        console.log('- XP:', currentUser.xp);
        console.log('- Gold:', currentUser.gold);
        console.log('- Total draws:', currentUser.total_draws);
        
        // Restore to pre-deployment values
        await db.run(`
            UPDATE users 
            SET xp = ?, gold = ?, total_draws = ?
            WHERE id = ?
        `, [65, 19496, 55, '411307913429254174']);
        
        // Verify restoration
        const restoredUser = await db.get('SELECT * FROM users WHERE id = ?', ['411307913429254174']);
        console.log('\n✅ Restored state:');
        console.log('- Level:', restoredUser.level);
        console.log('- XP:', restoredUser.xp, '/ 150');
        console.log('- Gold:', restoredUser.gold.toLocaleString(), '🪙');
        console.log('- Total draws:', restoredUser.total_draws);
        
        console.log('\n🎉 User progress restored successfully!');
        
    } catch (error) {
        console.error('❌ Progress restoration failed:', error);
    } finally {
        db.close();
    }
}

restoreUserProgress();