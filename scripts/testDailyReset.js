const Database = require('../database/Database');
const UserManager = require('../database/UserManager');

async function testDailyResetLogic() {
    const database = new Database();
    const userManager = new UserManager(database);
    
    try {
        await database.connect();
        await database.initialize();
        
        console.log('🧪 Testing Daily Reset Logic (22:00 ET)...\n');
        
        const now = new Date();
        const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
        
        console.log(`Current UTC: ${now.toISOString()}`);
        console.log(`Current ET: ${easternTime.toLocaleString("en-US", {timeZone: "America/New_York"})}`);
        console.log(`Current ET Hour: ${easternTime.getHours()}\n`);
        
        // Calculate the last 22:00 ET reset time
        const lastResetTime = new Date(easternTime);
        lastResetTime.setHours(22, 0, 0, 0);
        
        // If it's before 22:00 ET today, the reset was yesterday at 22:00 ET
        if (easternTime.getHours() < 22) {
            lastResetTime.setDate(lastResetTime.getDate() - 1);
            console.log('⏰ Before 22:00 ET - Last reset was yesterday');
        } else {
            console.log('⏰ After 22:00 ET - Last reset was today');
        }
        
        console.log(`Last Reset Time (ET): ${lastResetTime.toLocaleString("en-US", {timeZone: "America/New_York"})}`);
        
        // Calculate next reset time
        const nextReset = new Date(easternTime);
        nextReset.setHours(22, 0, 0, 0);
        
        if (easternTime.getHours() >= 22) {
            nextReset.setDate(nextReset.getDate() + 1);
        }
        
        console.log(`Next Reset Time (ET): ${nextReset.toLocaleString("en-US", {timeZone: "America/New_York"})}`);
        
        // Calculate time until reset
        const timeUntilReset = nextReset.getTime() - easternTime.getTime();
        const hoursLeft = Math.floor(timeUntilReset / (1000 * 60 * 60));
        const minutesLeft = Math.floor((timeUntilReset % (1000 * 60 * 60)) / (1000 * 60));
        
        console.log(`Time until next reset: ${hoursLeft}h ${minutesLeft}m\n`);
        
        // Test different scenarios
        console.log('🔍 Testing Scenarios:');
        
        // Scenario 1: User claimed 1 hour ago
        const oneHourAgo = new Date(now.getTime() - (1 * 60 * 60 * 1000));
        const oneHourAgoTimestamp = Math.floor(oneHourAgo.getTime() / 1000);
        const lastResetTimestamp = Math.floor(lastResetTime.getTime() / 1000);
        
        console.log(`1. User claimed 1 hour ago: ${oneHourAgoTimestamp > lastResetTimestamp ? 'BLOCKED' : 'ALLOWED'}`);
        
        // Scenario 2: User claimed 25 hours ago
        const twentyFiveHoursAgo = new Date(now.getTime() - (25 * 60 * 60 * 1000));
        const twentyFiveHoursTimestamp = Math.floor(twentyFiveHoursAgo.getTime() / 1000);
        
        console.log(`2. User claimed 25 hours ago: ${twentyFiveHoursTimestamp > lastResetTimestamp ? 'BLOCKED' : 'ALLOWED'}`);
        
        console.log('\n✅ Daily reset logic test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        database.close();
    }
}

testDailyResetLogic();