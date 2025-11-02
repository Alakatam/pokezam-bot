const Database = require('../database/Database');
const UserManager = require('../database/UserManager');

async function repairUserAccount(userId) {
    const database = new Database();
    const userManager = new UserManager(database);
    
    try {
        await database.connect();
        await database.initialize();
        
        console.log('🔧 Repairing user account...');
        
        // Get current user data
        const user = await userManager.getUser(userId);
        if (!user) {
            console.log('❌ User not found!');
            return;
        }
        
        console.log('📊 Current user data:', {
            id: user.id,
            username: user.username,
            level: user.level,
            xp: user.xp,
            coins: user.coins,
            gold: user.gold,
            has_started: user.has_started
        });
        
        // Fix level calculation using proper UserManager method
        const correctLevel = userManager.calculateLevel(user.xp);
        
        // Ensure has_started is set properly
        const hasStarted = user.has_started || (user.xp > 0 || user.level > 1) ? 1 : 0;
        
        // Update with correct values
        await database.run(`
            UPDATE users 
            SET level = ?, has_started = ?
            WHERE id = ?
        `, [correctLevel, hasStarted, userId]);
        
        const updatedUser = await userManager.getUser(userId);
        
        console.log('✅ Repaired user data:', {
            id: updatedUser.id,
            username: updatedUser.username,
            level: updatedUser.level,
            xp: updatedUser.xp,
            coins: updatedUser.coins,
            gold: updatedUser.gold,
            has_started: updatedUser.has_started
        });
        
        console.log('🎉 User account successfully repaired!');
        
    } catch (error) {
        console.error('❌ Error repairing user account:', error);
    } finally {
        database.close();
    }
}

// Usage: node scripts/repairUserAccount.js YOUR_USER_ID
const userId = process.argv[2] || '411307913429254174'; // Your admin user ID as default
repairUserAccount(userId);