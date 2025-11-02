const Database = require('../database/Database');
const UserManager = require('../database/UserManager');

async function testDailyCommand() {
    const database = new Database();
    const userManager = new UserManager(database);
    
    try {
        await database.connect();
        await database.initialize();
        
        console.log('🧪 Testing Daily Command Database Operations...');
        
        const testUserId = 'test-user-123';
        const testUsername = 'TestUser';
        
        // Create test user
        console.log('Creating test user...');
        let user = await userManager.getUser(testUserId);
        if (!user) {
            user = await userManager.createUser(testUserId, testUsername);
        }
        console.log('✅ Test user:', user);
        
        // Test daily reward data update
        const today = new Date().toDateString();
        const xpReward = 250;
        const coinReward = 50;
        const newXP = user.xp + xpReward;
        const newCoins = (user.coins || 0) + coinReward;
        const newLevel = Math.floor(newXP / 1000) + 1;
        
        console.log('\n🎁 Simulating daily reward...');
        await database.run(`
            UPDATE users 
            SET xp = ?, coins = ?, level = ?, last_daily_claim = ?
            WHERE id = ?
        `, [newXP, newCoins, newLevel, today, testUserId]);
        
        // Test item addition
        console.log('Adding reward items...');
        await database.run(`
            INSERT OR REPLACE INTO user_items (user_id, item_id, quantity)
            VALUES (?, ?, COALESCE((SELECT quantity FROM user_items WHERE user_id = ? AND item_id = ?), 0) + 1)
        `, [testUserId, 'Gold Boost', testUserId, 'Gold Boost']);
        
        await database.run(`
            INSERT OR REPLACE INTO user_items (user_id, item_id, quantity)
            VALUES (?, ?, COALESCE((SELECT quantity FROM user_items WHERE user_id = ? AND item_id = ?), 0) + 1)
        `, [testUserId, 'Daily Charm', testUserId, 'Daily Charm']);
        
        // Test streak update
        console.log('Updating daily streak...');
        const streakCount = 1;
        await database.run(`
            UPDATE users 
            SET daily_streak = ?
            WHERE id = ?
        `, [streakCount, testUserId]);
        
        // Verify results
        const updatedUser = await userManager.getUser(testUserId);
        const userItems = await database.all('SELECT * FROM user_items WHERE user_id = ?', [testUserId]);
        
        console.log('\n📊 Results:');
        console.log('Updated user:', {
            id: updatedUser.id,
            level: updatedUser.level,
            xp: updatedUser.xp,
            coins: updatedUser.coins,
            last_daily_claim: updatedUser.last_daily_claim,
            daily_streak: updatedUser.daily_streak
        });
        console.log('User items:', userItems);
        
        // Cleanup test data
        console.log('\n🧹 Cleaning up test data...');
        await database.run('DELETE FROM users WHERE id = ?', [testUserId]);
        await database.run('DELETE FROM user_items WHERE user_id = ?', [testUserId]);
        
        console.log('✅ Daily command database operations test completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        database.close();
    }
}

testDailyCommand();