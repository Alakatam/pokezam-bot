const { Client, GatewayIntentBits } = require('discord.js');
const Database = require('../database/Database');
const UserManager = require('../database/UserManager');
const CardManager = require('../database/CardManager');

class LoadTester {
    constructor() {
        this.database = new Database();
        this.userManager = new UserManager(this.database);
        this.cardManager = new CardManager(this.database);
        this.testUsers = [];
        this.isRunning = false;
        this.stats = {
            startTime: null,
            operations: 0,
            errors: 0,
            peakMemory: 0,
            averageMemory: 0,
            memoryReadings: []
        };
    }

    async initialize() {
        console.log('🔧 Initializing Load Test Environment...');
        await this.database.connect();
        console.log('✅ Database connected');
        
        // Create test users
        for (let i = 1; i <= 25; i++) {
            this.testUsers.push({
                id: `test_user_${i}`,
                username: `TestUser${i}`,
                drawInterval: null,
                questInterval: null,
                shopInterval: null
            });
        }
        console.log(`✅ Created ${this.testUsers.length} test users`);
    }

    async createTestUsers() {
        console.log('👥 Setting up test users in database...');
        
        for (const user of this.testUsers) {
            try {
                // Check if user exists, create if not
                let dbUser = await this.userManager.getUser(user.id);
                if (!dbUser) {
                    await this.userManager.createUser(user.id, user.username);
                    console.log(`Created user: ${user.username}`);
                }
                
                // Ensure user has started
                await this.database.run(
                    'UPDATE users SET has_started = TRUE WHERE id = ?',
                    [user.id]
                );
            } catch (error) {
                console.error(`Error setting up ${user.username}:`, error.message);
                this.stats.errors++;
            }
        }
        console.log('✅ Test users ready');
    }

    startMemoryMonitoring() {
        console.log('📊 Starting memory monitoring...');
        
        return setInterval(() => {
            const memUsage = process.memoryUsage();
            const rssMB = Math.round(memUsage.rss / 1024 / 1024);
            const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
            
            this.stats.memoryReadings.push({
                timestamp: Date.now(),
                rss: rssMB,
                heapUsed: heapUsedMB,
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
                external: Math.round(memUsage.external / 1024 / 1024)
            });
            
            if (rssMB > this.stats.peakMemory) {
                this.stats.peakMemory = rssMB;
            }
            
            // Keep only last 100 readings
            if (this.stats.memoryReadings.length > 100) {
                this.stats.memoryReadings.shift();
            }
            
            process.stdout.write(`\r📈 Current RAM: ${rssMB}MB | Peak: ${this.stats.peakMemory}MB | Operations: ${this.stats.operations} | Errors: ${this.stats.errors}`);
        }, 1000);
    }

    async simulateCardDrawing(user) {
        try {
            // Simulate /zam command
            const availableSets = await this.cardManager.getAvailableSets(user.id);
            if (availableSets.length > 0) {
                const randomSet = availableSets[Math.floor(Math.random() * availableSets.length)];
                const cards = await this.cardManager.getCardsFromSet(randomSet.id);
                
                if (cards.length > 0) {
                    const randomCard = cards[Math.floor(Math.random() * cards.length)];
                    await this.cardManager.addCardToUser(user.id, randomCard, 'normal', 1);
                    
                    // Add some gold
                    await this.userManager.addGold(user.id, Math.floor(Math.random() * 15) + 10);
                }
            }
            
            this.stats.operations++;
        } catch (error) {
            console.error(`Draw error for ${user.username}:`, error.message);
            this.stats.errors++;
        }
    }

    async simulateQuestCheck(user) {
        try {
            // Simulate /quest command - check user quests
            const quests = await this.database.all(`
                SELECT * FROM user_quests 
                WHERE user_id = ? AND completed = FALSE
                LIMIT 5
            `, [user.id]);
            
            this.stats.operations++;
        } catch (error) {
            console.error(`Quest error for ${user.username}:`, error.message);
            this.stats.errors++;
        }
    }

    async simulateProfileCheck(user) {
        try {
            // Simulate /profile command
            const dbUser = await this.userManager.getUser(user.id);
            const cardStats = await this.database.get(`
                SELECT 
                    COUNT(DISTINCT card_id) as unique_cards,
                    SUM(quantity) as total_cards
                FROM user_cards 
                WHERE user_id = ?
            `, [user.id]);
            
            this.stats.operations++;
        } catch (error) {
            console.error(`Profile error for ${user.username}:`, error.message);
            this.stats.errors++;
        }
    }

    async simulateShopBrowse(user) {
        try {
            // Simulate /shop command - get shop items
            const items = await this.database.all('SELECT * FROM shop_items LIMIT 10');
            this.stats.operations++;
        } catch (error) {
            console.error(`Shop error for ${user.username}:`, error.message);
            this.stats.errors++;
        }
    }

    startUserSimulation(user, intensity = 'medium') {
        const intervals = {
            light: { draw: 8000, quest: 15000, profile: 20000, shop: 25000 },
            medium: { draw: 5000, quest: 10000, profile: 12000, shop: 18000 },
            heavy: { draw: 2000, quest: 5000, profile: 6000, shop: 8000 },
            extreme: { draw: 1000, quest: 2000, profile: 3000, shop: 4000 }
        };

        const config = intervals[intensity] || intervals.medium;

        // Card drawing simulation
        user.drawInterval = setInterval(() => {
            this.simulateCardDrawing(user);
        }, config.draw + Math.random() * 2000); // Add some randomness

        // Quest checking simulation
        user.questInterval = setInterval(() => {
            this.simulateQuestCheck(user);
        }, config.quest + Math.random() * 3000);

        // Profile checking simulation
        user.profileInterval = setInterval(() => {
            this.simulateProfileCheck(user);
        }, config.profile + Math.random() * 5000);

        // Shop browsing simulation
        user.shopInterval = setInterval(() => {
            this.simulateShopBrowse(user);
        }, config.shop + Math.random() * 7000);
    }

    stopUserSimulation(user) {
        if (user.drawInterval) clearInterval(user.drawInterval);
        if (user.questInterval) clearInterval(user.questInterval);
        if (user.profileInterval) clearInterval(user.profileInterval);
        if (user.shopInterval) clearInterval(user.shopInterval);
    }

    async startLoadTest(userCount = 20, intensity = 'medium', durationMinutes = 5) {
        console.log(`\n🚀 Starting Load Test:`);
        console.log(`👥 Users: ${userCount}`);
        console.log(`⚡ Intensity: ${intensity}`);
        console.log(`⏱️ Duration: ${durationMinutes} minutes`);
        console.log(`─────────────────────────────────────────\n`);

        this.isRunning = true;
        this.stats.startTime = Date.now();

        // Start memory monitoring
        const memoryMonitor = this.startMemoryMonitoring();

        // Start user simulations
        const activeUsers = this.testUsers.slice(0, userCount);
        for (const user of activeUsers) {
            this.startUserSimulation(user, intensity);
        }

        console.log(`\n✅ Load test running with ${userCount} simulated users...`);
        console.log(`⏱️ Test will run for ${durationMinutes} minutes`);
        console.log(`📊 Monitoring system performance...\n`);

        // Wait for test duration
        await new Promise(resolve => setTimeout(resolve, durationMinutes * 60 * 1000));

        // Stop all simulations
        for (const user of activeUsers) {
            this.stopUserSimulation(user);
        }

        clearInterval(memoryMonitor);
        this.isRunning = false;

        // Generate report
        await this.generateReport(userCount, intensity, durationMinutes);
    }

    async generateReport(userCount, intensity, durationMinutes) {
        console.log(`\n\n📋 LOAD TEST REPORT`);
        console.log(`═══════════════════════════════════════════════════════════`);
        
        const duration = Date.now() - this.stats.startTime;
        const durationSeconds = Math.round(duration / 1000);
        
        console.log(`🧪 Test Configuration:`);
        console.log(`   Users Simulated: ${userCount}`);
        console.log(`   Intensity Level: ${intensity}`);
        console.log(`   Duration: ${durationMinutes} minutes (${durationSeconds}s actual)`);
        console.log(`   Total Operations: ${this.stats.operations}`);
        console.log(`   Operations/Second: ${Math.round(this.stats.operations / durationSeconds)}`);
        console.log(`   Error Count: ${this.stats.errors}`);
        console.log(`   Success Rate: ${Math.round(((this.stats.operations - this.stats.errors) / this.stats.operations) * 100)}%`);
        
        console.log(`\n💾 Memory Performance:`);
        if (this.stats.memoryReadings.length > 0) {
            const avgMemory = Math.round(
                this.stats.memoryReadings.reduce((sum, reading) => sum + reading.rss, 0) / 
                this.stats.memoryReadings.length
            );
            const minMemory = Math.min(...this.stats.memoryReadings.map(r => r.rss));
            const maxMemory = Math.max(...this.stats.memoryReadings.map(r => r.rss));
            
            console.log(`   Peak RAM Usage: ${maxMemory}MB`);
            console.log(`   Average RAM Usage: ${avgMemory}MB`);
            console.log(`   Minimum RAM Usage: ${minMemory}MB`);
            console.log(`   Memory Growth: ${maxMemory - minMemory}MB`);
            console.log(`   Memory per User: ${Math.round(avgMemory / userCount * 100) / 100}MB`);
        }
        
        console.log(`\n🏗️ Hosting Recommendations:`);
        const projectedRAM = Math.round(this.stats.peakMemory * 1.5); // 50% buffer
        console.log(`   Minimum RAM Needed: ${this.stats.peakMemory}MB`);
        console.log(`   Recommended RAM: ${projectedRAM}MB`);
        console.log(`   Suitable for 512MB VPS: ${projectedRAM <= 512 ? '✅ YES' : '❌ NO'}`);
        console.log(`   Suitable for 1GB VPS: ${projectedRAM <= 1024 ? '✅ YES' : '❌ NO'}`);
        
        const estimatedCapacity = Math.floor(512 / (this.stats.peakMemory / userCount));
        console.log(`   Estimated User Capacity (512MB): ~${estimatedCapacity} users`);
        
        console.log(`\n📊 Database Performance:`);
        try {
            const dbStats = await Promise.all([
                this.database.get('SELECT COUNT(*) as count FROM users WHERE id LIKE "test_user_%"'),
                this.database.get('SELECT COUNT(*) as count FROM user_cards WHERE user_id LIKE "test_user_%"'),
            ]);
            
            console.log(`   Test Users in DB: ${dbStats[0].count}`);
            console.log(`   Test Cards Generated: ${dbStats[1].count}`);
        } catch (error) {
            console.log(`   Database stats error: ${error.message}`);
        }
        
        console.log(`\n🎯 Load Test Conclusion:`);
        if (this.stats.errors / this.stats.operations < 0.05) {
            console.log(`   ✅ EXCELLENT: Error rate < 5%`);
        } else if (this.stats.errors / this.stats.operations < 0.15) {
            console.log(`   ⚠️ ACCEPTABLE: Error rate < 15%`);
        } else {
            console.log(`   ❌ CONCERNING: Error rate > 15%`);
        }
        
        if (projectedRAM <= 512) {
            console.log(`   ✅ READY: Bot is ready for 512MB hosting`);
        } else {
            console.log(`   ⚠️ UPGRADE: Consider 1GB+ hosting plan`);
        }
        
        console.log(`═══════════════════════════════════════════════════════════\n`);
    }

    async cleanup() {
        console.log('🧹 Cleaning up test data...');
        try {
            // Remove test users and their data
            await this.database.run('DELETE FROM user_cards WHERE user_id LIKE "test_user_%"');
            await this.database.run('DELETE FROM user_quests WHERE user_id LIKE "test_user_%"');
            await this.database.run('DELETE FROM active_effects WHERE user_id LIKE "test_user_%"');
            await this.database.run('DELETE FROM users WHERE id LIKE "test_user_%"');
            console.log('✅ Test data cleaned up');
        } catch (error) {
            console.error('❌ Cleanup error:', error.message);
        }
        
        if (this.database) {
            this.database.close();
        }
    }
}

// Main execution
async function runLoadTest() {
    const tester = new LoadTester();
    
    try {
        // Parse command line arguments
        const args = process.argv.slice(2);
        const userCount = parseInt(args[0]) || 20;
        const intensity = args[1] || 'medium';
        const duration = parseInt(args[2]) || 5;
        
        console.log('🧪 Pokézam Bot Load Testing Suite');
        console.log('═══════════════════════════════════════════════════════════');
        
        await tester.initialize();
        await tester.createTestUsers();
        
        console.log('\n⏳ Starting in 3 seconds...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        await tester.startLoadTest(userCount, intensity, duration);
        
    } catch (error) {
        console.error('\n❌ Load test failed:', error);
    } finally {
        await tester.cleanup();
        console.log('🏁 Load test completed. Exiting...');
        process.exit(0);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n\n⚠️ Load test interrupted by user');
    process.exit(0);
});

// Run if called directly
if (require.main === module) {
    runLoadTest();
}

module.exports = LoadTester;