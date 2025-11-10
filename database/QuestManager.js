class QuestManager {
    constructor(database) {
        this.db = database;
        // Initialize enhanced quest manager
        const EnhancedQuestManager = require('./EnhancedQuestManager');
        this.enhancedManager = new EnhancedQuestManager(database);
    }

    async getUserQuests(userId) {
        return await this.enhancedManager.getUserQuests(userId);
    }

    async autoAssignQuests(userId) {
        // Enhanced quest assignment with daily rotation
        // NOTE: Quest system initialization now happens at startup only (see index.js)
        return await this.enhancedManager.autoAssignDiverseQuests(userId);
    }
    
    // Initialize enhanced quest system
    async initializeEnhancedQuests() {
        return await this.enhancedManager.initializeEnhancedQuests();
    }
    
    // Ensure enhanced quest system is initialized
    async ensureEnhancedQuestsInitialized() {
        try {
            // Check if we have enhanced quests (with target_type)
            const enhancedQuests = await this.db.all(
                'SELECT COUNT(*) as count FROM quests WHERE target_type IS NOT NULL'
            );
            
            const count = parseInt(enhancedQuests[0]?.count) || 0; // Convert string to number for PostgreSQL
            if (count === 0) {
                console.log('🚀 Initializing enhanced quest system...');
                try {
                    await this.enhancedManager.initializeEnhancedQuests();
                    console.log('✅ Enhanced quest system initialized');
                } catch (initError) {
                    console.error('🚨 QUEST: Quest initialization failed:', initError.message);
                }
            }
        } catch (error) {
            console.error('Error checking enhanced quest initialization:', error.message);
            // Try to initialize anyway
            try {
                await this.enhancedManager.initializeEnhancedQuests();
                console.log('✅ Enhanced quest system initialized after error');
            } catch (initError) {
                console.error('Failed to initialize enhanced quest system:', initError.message);
            }
        }
    }

    async initializeUserQuests(userId) {
        // Legacy method - now uses autoAssignQuests
        await this.autoAssignQuests(userId);
    }

    async updateQuestProgress(userId, questType, amount = 1, cardData = null) {
        // Use enhanced quest progress system
        return await this.enhancedManager.updateEnhancedQuestProgress(userId, questType, amount, cardData);
    }
    
    // Direct access method for enhanced quest progress 
    async updateEnhancedQuestProgress(userId, targetType, amount = 1, cardData = null) {
        return await this.enhancedManager.updateEnhancedQuestProgress(userId, targetType, amount, cardData);
    }

    async resetExpiredQuestsEasternTime() {
        const now = new Date();
        
        // Convert to Eastern Time
        const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
        const currentHour = easternTime.getHours();
        const currentDay = easternTime.getDay(); // 0 = Sunday
        const currentDate = easternTime.getDate();
        const lastDayOfMonth = new Date(easternTime.getFullYear(), easternTime.getMonth() + 1, 0).getDate();
        
        // Only reset at 20:00 (8 PM) Eastern Time
        if (currentHour === 20) {
            // Get all user quests with their types
            const userQuests = await this.db.all(`
                SELECT uq.*, q.quest_type
                FROM user_quests uq
                JOIN quests q ON uq.quest_id = q.id
            `);

            const nowTimestamp = Date.now();
            let resetCount = 0;

            for (const quest of userQuests) {
                let shouldReset = false;
                
                // Check reset conditions based on quest type
                if (quest.quest_type === 'daily') {
                    // Daily quests reset every day at 20:00 ET
                    const assignedDate = new Date(quest.assigned_date); // Now in milliseconds
                    const assignedEastern = new Date(assignedDate.toLocaleString("en-US", {timeZone: "America/New_York"}));
                    
                    // Reset if it's been more than a day since assignment
                    if (easternTime.getDate() !== assignedEastern.getDate() || 
                        easternTime.getMonth() !== assignedEastern.getMonth() ||
                        easternTime.getFullYear() !== assignedEastern.getFullYear()) {
                        shouldReset = true;
                    }
                } else if (quest.quest_type === 'weekly') {
                    // Weekly quests reset every Sunday at 20:00 ET
                    if (currentDay === 0) { // Sunday
                        const assignedDate = new Date(quest.assigned_date); // Now in milliseconds
                        const daysSinceAssignment = Math.floor((nowTimestamp - quest.assigned_date) / (24 * 60 * 60 * 1000));
                        
                        if (daysSinceAssignment >= 7) {
                            shouldReset = true;
                        }
                    }
                } else if (quest.quest_type === 'monthly') {
                    // Monthly quests reset on last day of month at 20:00 ET
                    if (currentDate === lastDayOfMonth) {
                        const assignedDate = new Date(quest.assigned_date); // Now in milliseconds
                        const assignedEastern = new Date(assignedDate.toLocaleString("en-US", {timeZone: "America/New_York"}));
                        
                        if (easternTime.getMonth() !== assignedEastern.getMonth() ||
                            easternTime.getFullYear() !== assignedEastern.getFullYear()) {
                            shouldReset = true;
                        }
                    }
                }

                if (shouldReset) {
                    await this.db.run(`
                        UPDATE user_quests 
                        SET progress = 0, completed = FALSE, completed_date = NULL
                        WHERE id = ?
                    `, [quest.id]);
                    resetCount++;
                }
            }

            return resetCount;
        }

        return 0;
    }

    async resetExpiredQuests() {
        // Legacy method - now uses Eastern Time logic
        return await this.resetExpiredQuestsEasternTime();
    }

    async getQuestProgress(userId, questId) {
        return await this.db.get(
            'SELECT * FROM user_quests WHERE user_id = ? AND quest_id = ?',
            [userId, questId]
        );
    }

    async getAvailableQuests() {
        return await this.db.all('SELECT * FROM quests ORDER BY quest_type, name');
    }

    async getCompletedQuestsToday(userId) {
        const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;
        
        return await this.db.all(`
            SELECT uq.*, q.name, q.quest_type
            FROM user_quests uq
            JOIN quests q ON uq.quest_id = q.id
            WHERE uq.user_id = ? AND uq.completed = TRUE AND uq.completed_date > ?
        `, [userId, oneDayAgo]);
    }

    async getQuestStats(userId) {
        const stats = await this.db.get(`
            SELECT 
                COUNT(*) as total_quests,
                COUNT(CASE WHEN completed = TRUE THEN 1 END) as completed_quests,
                SUM(CASE WHEN completed = TRUE THEN q.reward_gold ELSE 0 END) as total_gold_earned,
                SUM(CASE WHEN completed = TRUE THEN q.reward_xp ELSE 0 END) as total_xp_earned
            FROM user_quests uq
            JOIN quests q ON uq.quest_id = q.id
            WHERE uq.user_id = ?
        `, [userId]);

        return stats || { total_quests: 0, completed_quests: 0, total_gold_earned: 0, total_xp_earned: 0 };
    }

    getTimeUntilReset(assignedDate, resetInterval) {
        const now = Date.now(); // Keep as milliseconds
        
        // Convert reset interval to milliseconds (not seconds!)
        let intervalMilliseconds;
        switch(resetInterval) {
            case 'daily': intervalMilliseconds = 24 * 60 * 60 * 1000; break;  // 1 day
            case 'weekly': intervalMilliseconds = 7 * 24 * 60 * 60 * 1000; break;  // 7 days  
            case 'monthly': intervalMilliseconds = 30 * 24 * 60 * 60 * 1000; break;  // 30 days
            default: intervalMilliseconds = 24 * 60 * 60 * 1000; break;  // default to daily
        }
        
        const nextReset = assignedDate + intervalMilliseconds;
        const timeLeft = nextReset - now;
        
        if (timeLeft <= 0) return 'Ready to reset';
        
        const hours = Math.floor(timeLeft / (1000 * 3600));
        const minutes = Math.floor((timeLeft % (1000 * 3600)) / (1000 * 60));
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }
}

module.exports = QuestManager;