const { Events } = require('discord.js');
const cron = require('cron');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client, bot) {
        console.log(`${client.user.tag} is online!`);
        client.user.setActivity('🃏 Pokémon TCG Collection Bot');
        
        // Set up quest reset timer (runs every hour)
        const questResetJob = new cron.CronJob('0 * * * *', async () => {
            try {
                const resetCount = await bot.questManager.resetExpiredQuests();
                if (resetCount > 0) {
                    console.log(`Reset ${resetCount} expired quests`);
                }
            } catch (error) {
                console.error('Error resetting quests:', error);
            }
        });
        
        questResetJob.start();
        console.log('Quest reset timer started (runs hourly)');
        
        // Initial quest reset on startup
        try {
            const initialResetCount = await bot.questManager.resetExpiredQuests();
            console.log(`Initial quest reset: ${initialResetCount} quests reset`);
        } catch (error) {
            console.error('Error in initial quest reset:', error);
        }

        // DEPLOYMENT FIX: Start Progressive Card Loading AFTER bot is ready and connected
        // This prevents deployment timeouts by running card loading post-deployment
        if (process.env.NODE_ENV === 'production' || process.env.PORT) {
            console.log('🎴 Starting post-deployment card loading tasks...');
            
            // Wait 10 seconds after bot ready to ensure everything is stable
            setTimeout(async () => {
                try {
                    // Load Generation III (EX series) cards if missing
                    const loadGenIIICards = require('../scripts/loadGenIIICards');
                    console.log('🔍 Checking for Generation III cards...');
                    
                    loadGenIIICards(bot.database).then(result => {
                        if (result.success) {
                            if (result.alreadyLoaded) {
                                console.log(`✅ Generation III already loaded (${result.count} cards)`);
                            } else {
                                console.log(`✨ Generation III loaded: ${result.loaded} cards`);
                            }
                        } else {
                            console.error(`⚠️ Generation III loading failed: ${result.error}`);
                        }
                    }).catch(error => {
                        console.error('❌ Generation III loader error:', error.message);
                    });
                    
                    // Start progressive card loader for other sets
                    const ProgressiveCardLoader = require('../database/ProgressiveCardLoader');
                    const cardLoader = new ProgressiveCardLoader(bot.database);
                    
                    console.log('🔄 Beginning progressive card loading from GitHub (non-blocking)...');
                    
                    // Load additional cards in background (don't block bot operations)
                    cardLoader.checkAndLoadCards().catch(error => {
                        console.error('❌ Progressive loading failed (bot remains functional):', error.message);
                    });
                    
                } catch (error) {
                    console.error('❌ Failed to initialize card loaders:', error.message);
                }
            }, 10000); // 10 second delay after bot ready
        }
    },
};