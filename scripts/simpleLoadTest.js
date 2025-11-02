// Simple Load Test - Monitor system resources while simulating bot load
const os = require('os');
const { performance } = require('perf_hooks');

class SimpleLoadTester {
    constructor() {
        this.isRunning = false;
        this.stats = {
            startTime: null,
            initialMemory: 0,
            peakMemory: 0,
            memoryReadings: [],
            cpuReadings: [],
            operations: 0
        };
    }

    // Get current system memory info
    getMemoryInfo() {
        const memUsage = process.memoryUsage();
        return {
            rss: Math.round(memUsage.rss / 1024 / 1024), // Total memory
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // Used heap
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // Total heap
            external: Math.round(memUsage.external / 1024 / 1024), // External memory
            free: Math.round(os.freemem() / 1024 / 1024), // System free memory
            total: Math.round(os.totalmem() / 1024 / 1024) // Total system memory
        };
    }

    // Get basic CPU info
    getCPUInfo() {
        const cpus = os.cpus();
        return {
            count: cpus.length,
            model: cpus[0].model,
            loadAvg: os.loadavg()
        };
    }

    // Simulate database operations (without actual DB connection)
    simulateCardDraw() {
        // Simulate the memory/CPU load of card drawing
        const data = [];
        for (let i = 0; i < 100; i++) {
            data.push({
                id: Math.random().toString(36),
                name: `Card${i}`,
                rarity: ['Common', 'Uncommon', 'Rare', 'Rare Holo'][Math.floor(Math.random() * 4)],
                set: `Set${Math.floor(Math.random() * 10)}`
            });
        }
        
        // Simulate JSON processing
        const json = JSON.stringify(data);
        const parsed = JSON.parse(json);
        
        this.stats.operations++;
        return parsed.length;
    }

    // Simulate quest checking
    simulateQuestCheck() {
        const quests = [];
        for (let i = 0; i < 20; i++) {
            quests.push({
                id: i,
                type: ['daily', 'weekly', 'monthly'][Math.floor(Math.random() * 3)],
                progress: Math.floor(Math.random() * 100),
                completed: Math.random() > 0.7
            });
        }
        
        // Simulate processing
        const completedQuests = quests.filter(q => q.completed);
        this.stats.operations++;
        return completedQuests.length;
    }

    // Simulate user profile calculations
    simulateProfileCalc() {
        let totalXP = 0;
        let totalCards = 0;
        
        // Simulate calculations
        for (let level = 1; level <= 50; level++) {
            totalXP += 100 + (level - 1) * 50;
            totalCards += Math.floor(Math.random() * 10);
        }
        
        this.stats.operations++;
        return { totalXP, totalCards };
    }

    // Start monitoring system resources
    startMonitoring() {
        console.log('📊 Starting system monitoring...\n');
        
        return setInterval(() => {
            const memory = this.getMemoryInfo();
            const timestamp = Date.now();
            
            // Track memory
            this.stats.memoryReadings.push({
                timestamp,
                ...memory
            });
            
            // Update peak memory
            if (memory.rss > this.stats.peakMemory) {
                this.stats.peakMemory = memory.rss;
            }
            
            // Keep only last 60 readings (1 minute at 1 second intervals)
            if (this.stats.memoryReadings.length > 60) {
                this.stats.memoryReadings.shift();
            }
            
            // Display current stats
            const runtime = Math.floor((Date.now() - this.stats.startTime) / 1000);
            process.stdout.write(`\r📈 RAM: ${memory.rss}MB | Peak: ${this.stats.peakMemory}MB | Free: ${memory.free}MB | Ops: ${this.stats.operations} | Time: ${runtime}s`);
        }, 1000);
    }

    // Simulate multiple users performing operations
    simulateUserLoad(userCount, intensity = 'medium') {
        const intensityConfig = {
            light: { interval: 3000, burst: 1 },
            medium: { interval: 1500, burst: 2 },
            heavy: { interval: 800, burst: 3 },
            extreme: { interval: 400, burst: 5 }
        };
        
        const config = intensityConfig[intensity] || intensityConfig.medium;
        const intervals = [];
        
        // Create simulation for each user
        for (let userId = 0; userId < userCount; userId++) {
            const userInterval = setInterval(() => {
                // Each user performs multiple operations per cycle
                for (let i = 0; i < config.burst; i++) {
                    const operation = Math.floor(Math.random() * 3);
                    
                    switch (operation) {
                        case 0:
                            this.simulateCardDraw();
                            break;
                        case 1:
                            this.simulateQuestCheck();
                            break;
                        case 2:
                            this.simulateProfileCalc();
                            break;
                    }
                }
            }, config.interval + (Math.random() * 1000)); // Add randomness
            
            intervals.push(userInterval);
        }
        
        return intervals;
    }

    async runLoadTest(userCount = 20, intensity = 'medium', durationMinutes = 3) {
        console.log(`🚀 Simple Load Test Started`);
        console.log(`═══════════════════════════════════════════════════════════`);
        console.log(`👥 Simulated Users: ${userCount}`);
        console.log(`⚡ Intensity: ${intensity}`);
        console.log(`⏱️ Duration: ${durationMinutes} minutes`);
        console.log(`🖥️ System: ${os.platform()} ${os.arch()}`);
        
        const cpuInfo = this.getCPUInfo();
        console.log(`🔧 CPU: ${cpuInfo.model.substring(0, 50)}...`);
        console.log(`⚙️ CPU Cores: ${cpuInfo.count}`);
        
        const initialMemory = this.getMemoryInfo();
        console.log(`💾 Available RAM: ${initialMemory.total}MB (${initialMemory.free}MB free)`);
        console.log(`📊 Initial Bot Memory: ${initialMemory.rss}MB\n`);
        
        this.stats.startTime = Date.now();
        this.stats.initialMemory = initialMemory.rss;
        this.stats.peakMemory = initialMemory.rss;
        this.isRunning = true;
        
        // Start monitoring
        const monitor = this.startMonitoring();
        
        // Start user simulation
        console.log(`🎯 Starting simulation of ${userCount} users...\n`);
        const userIntervals = this.simulateUserLoad(userCount, intensity);
        
        // Wait for test duration
        await new Promise(resolve => setTimeout(resolve, durationMinutes * 60 * 1000));
        
        // Stop everything
        clearInterval(monitor);
        userIntervals.forEach(interval => clearInterval(interval));
        this.isRunning = false;
        
        // Generate report
        this.generateReport(userCount, intensity, durationMinutes);
    }

    generateReport(userCount, intensity, durationMinutes) {
        console.log(`\n\n📋 LOAD TEST RESULTS`);
        console.log(`═══════════════════════════════════════════════════════════`);
        
        const finalMemory = this.getMemoryInfo();
        const memoryGrowth = this.stats.peakMemory - this.stats.initialMemory;
        const avgMemory = this.stats.memoryReadings.length > 0 ? 
            Math.round(this.stats.memoryReadings.reduce((sum, r) => sum + r.rss, 0) / this.stats.memoryReadings.length) : 
            this.stats.initialMemory;
        
        const duration = Date.now() - this.stats.startTime;
        const opsPerSecond = Math.round(this.stats.operations / (duration / 1000));
        
        console.log(`📊 Performance Summary:`);
        console.log(`   Duration: ${Math.round(duration / 1000)}s`);
        console.log(`   Operations Simulated: ${this.stats.operations.toLocaleString()}`);
        console.log(`   Operations/Second: ${opsPerSecond.toLocaleString()}`);
        console.log(`   Users Simulated: ${userCount}`);
        console.log(`   Load Intensity: ${intensity}`);
        
        console.log(`\n💾 Memory Analysis:`);
        console.log(`   Initial Memory: ${this.stats.initialMemory}MB`);
        console.log(`   Peak Memory: ${this.stats.peakMemory}MB`);
        console.log(`   Final Memory: ${finalMemory.rss}MB`);
        console.log(`   Average Memory: ${avgMemory}MB`);
        console.log(`   Memory Growth: +${memoryGrowth}MB`);
        console.log(`   Memory per User: ${Math.round(memoryGrowth / userCount * 100) / 100}MB`);
        console.log(`   System Free RAM: ${finalMemory.free}MB`);
        
        console.log(`\n🏗️ Hosting Recommendations:`);
        const projectedRAM = Math.round(this.stats.peakMemory * 1.3); // 30% buffer
        const maxUsers512 = Math.floor(400 / (memoryGrowth / userCount || 1));
        const maxUsers1024 = Math.floor(900 / (memoryGrowth / userCount || 1));
        
        console.log(`   Current Peak Usage: ${this.stats.peakMemory}MB`);
        console.log(`   Recommended RAM (with buffer): ${projectedRAM}MB`);
        console.log(`   512MB VPS Suitable: ${projectedRAM <= 512 ? '✅ YES' : '❌ NO'}`);
        console.log(`   1GB VPS Suitable: ${projectedRAM <= 1024 ? '✅ YES' : '❌ NO'}`);
        console.log(`   Estimated Capacity (512MB): ~${maxUsers512} concurrent users`);
        console.log(`   Estimated Capacity (1GB): ~${maxUsers1024} concurrent users`);
        
        console.log(`\n🎯 Hosting Verdict:`);
        if (projectedRAM <= 256) {
            console.log(`   🟢 EXCELLENT: Your bot is very lightweight!`);
            console.log(`   📦 Recommended: 512MB VPS (plenty of headroom)`);
        } else if (projectedRAM <= 512) {
            console.log(`   🟢 GOOD: Your bot has moderate resource usage`);
            console.log(`   📦 Recommended: 512MB-1GB VPS`);
        } else if (projectedRAM <= 1024) {
            console.log(`   🟡 ACCEPTABLE: Your bot needs adequate resources`);
            console.log(`   📦 Recommended: 1GB VPS minimum`);
        } else {
            console.log(`   🔴 HIGH USAGE: Your bot is resource intensive`);
            console.log(`   📦 Recommended: 2GB+ VPS or optimization needed`);
        }
        
        console.log(`\n💰 Hosting Cost Estimate:`);
        if (projectedRAM <= 512) {
            console.log(`   🆓 Railway: Free tier suitable`);
            console.log(`   🆓 Render: Free tier suitable`);
            console.log(`   💵 VPS: $5-10/month`);
        } else {
            console.log(`   💵 Entry VPS: $10-15/month`);
            console.log(`   💵 Premium VPS: $15-25/month`);
        }
        
        console.log(`═══════════════════════════════════════════════════════════\n`);
    }
}

// Main execution
async function runTest() {
    const args = process.argv.slice(2);
    const userCount = parseInt(args[0]) || 20;
    const intensity = args[1] || 'medium';
    const duration = parseInt(args[2]) || 3;
    
    const tester = new SimpleLoadTester();
    
    try {
        await tester.runLoadTest(userCount, intensity, duration);
    } catch (error) {
        console.error('❌ Load test error:', error.message);
    }
    
    console.log('🏁 Load test completed!');
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('\n\n⚠️ Test interrupted by user');
    process.exit(0);
});

if (require.main === module) {
    runTest();
}

module.exports = SimpleLoadTester;