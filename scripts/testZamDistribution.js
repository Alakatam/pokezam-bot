const path = require('path');
const Database = require('../database/Database');
const DatabaseManager = require('../database/DatabaseManager');
const CardManager = require('../database/CardManager');

/**
 * Test script to simulate 500 /zam pulls for a level 1 user
 * and analyze the distribution of sets pulled
 */
async function testZamDistribution() {
    console.log('🎯 ===== ZAM DISTRIBUTION TEST =====');
    console.log('Testing 500 /zam pulls for a level 1 user\n');

    const dbManager = new DatabaseManager();
    let db;

    try {
        // Connect to database
        console.log('📦 Connecting to database...');
        db = await dbManager.connect();
        console.log('✅ Connected to database\n');

        const cardManager = new CardManager(db);

        // Test parameters
        const userLevel = 1; // Level 1 user
        const guildLuckBonus = 0; // No guild bonus
        const numPulls = 500;

        console.log(`🎲 Simulating ${numPulls} card pulls...`);
        console.log(`   User Level: ${userLevel}`);
        console.log(`   Guild Luck Bonus: ${guildLuckBonus}\n`);

        // Track distribution
        const setDistribution = {};
        const rarityDistribution = {};
        let successfulPulls = 0;
        let failedPulls = 0;

        // Perform pulls
        for (let i = 0; i < numPulls; i++) {
            try {
                const card = await cardManager.getRandomCard(userLevel, guildLuckBonus);
                
                if (card) {
                    successfulPulls++;
                    
                    // Track set distribution
                    const setId = card.set_id || card.set_name || 'Unknown';
                    setDistribution[setId] = (setDistribution[setId] || 0) + 1;
                    
                    // Track rarity distribution
                    const rarity = card.rarity || 'Unknown';
                    rarityDistribution[rarity] = (rarityDistribution[rarity] || 0) + 1;
                } else {
                    failedPulls++;
                }

                // Progress indicator every 50 pulls
                if ((i + 1) % 50 === 0) {
                    console.log(`   Progress: ${i + 1}/${numPulls} pulls completed...`);
                }
            } catch (error) {
                console.error(`   ❌ Error on pull ${i + 1}:`, error.message);
                failedPulls++;
            }
        }

        console.log('\n✅ Simulation complete!\n');

        // Display results
        console.log('📊 ===== PULL RESULTS =====');
        console.log(`Total Pulls: ${numPulls}`);
        console.log(`Successful: ${successfulPulls}`);
        console.log(`Failed: ${failedPulls}\n`);

        // Set distribution
        console.log('📦 ===== SET DISTRIBUTION =====');
        const sortedSets = Object.entries(setDistribution)
            .sort((a, b) => b[1] - a[1]); // Sort by count, descending

        // Calculate totals
        const totalCards = sortedSets.reduce((sum, [_, count]) => sum + count, 0);

        // Display each set with percentage
        sortedSets.forEach(([setId, count]) => {
            const percentage = ((count / totalCards) * 100).toFixed(2);
            const bar = '█'.repeat(Math.round(percentage / 2)); // Visual bar
            console.log(`   ${setId.padEnd(20)} : ${count.toString().padStart(3)} pulls (${percentage.toString().padStart(6)}%) ${bar}`);
        });

        console.log(`\n   TOTAL CARDS: ${totalCards}`);

        // Specific check for base sets
        console.log('\n🔍 ===== BASE SETS BREAKDOWN =====');
        const baseSets = ['base1', 'base2', 'base3', 'base4', 'base5'];
        baseSets.forEach(setId => {
            const count = setDistribution[setId] || 0;
            const percentage = totalCards > 0 ? ((count / totalCards) * 100).toFixed(2) : '0.00';
            const status = count > 0 ? '✅' : '❌';
            console.log(`   ${status} ${setId.padEnd(10)} : ${count.toString().padStart(3)} pulls (${percentage.toString().padStart(6)}%)`);
        });

        // Rarity distribution
        console.log('\n✨ ===== RARITY DISTRIBUTION =====');
        const sortedRarities = Object.entries(rarityDistribution)
            .sort((a, b) => b[1] - a[1]);

        sortedRarities.forEach(([rarity, count]) => {
            const percentage = ((count / totalCards) * 100).toFixed(2);
            console.log(`   ${rarity.padEnd(20)} : ${count.toString().padStart(3)} pulls (${percentage.toString().padStart(6)}%)`);
        });

        console.log('\n===== TEST COMPLETE =====\n');

    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Stack:', error.stack);
    } finally {
        // Close database
        if (db) {
            try {
                await db.close();
                console.log('✅ Database connection closed');
            } catch (closeError) {
                console.error('❌ Error closing database:', closeError.message);
            }
        }
    }
}

// Run the test
testZamDistribution().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
