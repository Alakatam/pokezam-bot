/**
 * Background Card Generation Cron Job
 * Runs every hour to pre-generate cards for Bulk Bin departments
 * This prevents lag spikes when users collect large amounts of cards
 */

class CardGenerationCron {
    constructor(database, collectorShopManager, cardManager, userManager) {
        this.database = database;
        this.collectorShopManager = collectorShopManager;
        this.cardManager = cardManager;
        this.userManager = userManager;
        this.isRunning = false;
    }

    /**
     * Start the cron job (runs every hour)
     */
    start() {
        console.log('🔄 Starting background card generation cron job...');
        
        // Run immediately on startup
        this.generateCards();
        
        // Then run every hour
        this.interval = setInterval(() => {
            this.generateCards();
        }, 60 * 60 * 1000); // 1 hour
    }

    /**
     * Stop the cron job
     */
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            console.log('⏹️ Stopped background card generation cron job');
        }
    }

    /**
     * Generate cards for all active users
     */
    async generateCards() {
        if (this.isRunning) {
            console.log('⚠️ Card generation already running, skipping...');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();
        
        try {
            console.log('🎲 Starting background card generation...');

            // Get all users with Bulk Bin unlocked (level > 0)
            const activeUsers = await this.database.all(
                'SELECT DISTINCT user_id FROM collector_departments WHERE department_id = ? AND level > 0',
                ['bulk_bin']
            );

            if (!activeUsers || activeUsers.length === 0) {
                console.log('✅ No active Bulk Bin users found');
                this.isRunning = false;
                return;
            }

            console.log(`📊 Found ${activeUsers.length} active Bulk Bin users`);
            let totalGenerated = 0;

            // Process users in batches to avoid overload
            const batchSize = 10;
            for (let i = 0; i < activeUsers.length; i += batchSize) {
                const batch = activeUsers.slice(i, Math.min(i + batchSize, activeUsers.length));
                
                // Process batch in parallel
                const results = await Promise.all(
                    batch.map(async ({ user_id }) => {
                        try {
                            // Get user level for rarity odds
                            const user = await this.userManager.getUser(user_id);
                            if (!user) return 0;

                            const generated = await this.collectorShopManager.generatePendingCardsForUser(
                                user_id,
                                this.cardManager,
                                user.level
                            );

                            return generated;
                        } catch (error) {
                            console.error(`Error generating cards for user ${user_id}:`, error);
                            return 0;
                        }
                    })
                );

                totalGenerated += results.reduce((sum, count) => sum + count, 0);

                // Small delay between batches
                if (i + batchSize < activeUsers.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`✅ Generated ${totalGenerated} cards for ${activeUsers.length} users in ${elapsed}s`);

        } catch (error) {
            console.error('❌ Error in background card generation:', error);
        } finally {
            this.isRunning = false;
        }
    }
}

module.exports = CardGenerationCron;
