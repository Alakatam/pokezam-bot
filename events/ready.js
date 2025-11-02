const { Events } = require('discord.js');
const cron = require('cron');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client, bot) {
        console.log(`${client.user.tag} is online!`);
        client.user.setActivity('/draw - Start your collection!');
        
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
    },
};