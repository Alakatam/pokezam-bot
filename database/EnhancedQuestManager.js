class EnhancedQuestManager {
    constructor(database) {
        this.db = database;
        this.questPool = this.initializeQuestPool();
    }

    // Define diverse quest types with various objectives
    initializeQuestPool() {
        return {
            daily: [
                // Card Drawing Quests
                { name: 'Daily Collector', description: 'Draw 10 Pokemon cards', target_type: 'card_draws', target_value: 10, reward_gold: 500, reward_xp: 25 },
                { name: 'Lucky Drawer', description: 'Draw 5 Pokemon cards', target_type: 'card_draws', target_value: 5, reward_gold: 300, reward_xp: 15 },
                { name: 'Card Hunter', description: 'Draw 15 Pokemon cards', target_type: 'card_draws', target_value: 15, reward_gold: 750, reward_xp: 35 },
                
                // Type-Specific Quests  
                { name: 'Electric Enthusiast', description: 'Collect 8 Electric-type Pokemon', target_type: 'type_electric', target_value: 8, reward_gold: 600, reward_xp: 30 },
                { name: 'Fire Master', description: 'Collect 8 Fire-type Pokemon', target_type: 'type_fire', target_value: 8, reward_gold: 600, reward_xp: 30 },
                { name: 'Water Champion', description: 'Collect 8 Water-type Pokemon', target_type: 'type_water', target_value: 8, reward_gold: 600, reward_xp: 30 },
                { name: 'Grass Guardian', description: 'Collect 8 Grass-type Pokemon', target_type: 'type_grass', target_value: 8, reward_gold: 600, reward_xp: 30 },
                { name: 'Psychic Sage', description: 'Collect 6 Psychic-type Pokemon', target_type: 'type_psychic', target_value: 6, reward_gold: 550, reward_xp: 25 },
                { name: 'Fighting Spirit', description: 'Collect 6 Fighting-type Pokemon', target_type: 'type_fighting', target_value: 6, reward_gold: 550, reward_xp: 25 },
                
                // Rarity Quests
                { name: 'Rare Finder', description: 'Pull 3 Rare cards or better', target_type: 'rarity_rare_plus', target_value: 3, reward_gold: 800, reward_xp: 40 },
                { name: 'Holo Hunter', description: 'Pull 2 Holo Rare cards', target_type: 'rarity_holo', target_value: 2, reward_gold: 1200, reward_xp: 50 },
                { name: 'Ultra Seeker', description: 'Pull 1 Ultra Rare card', target_type: 'rarity_ultra', target_value: 1, reward_gold: 2000, reward_xp: 75 },
                
                // Gold/Economy Quests
                { name: 'Gold Digger', description: 'Earn 2,000 gold from card draws', target_type: 'gold_from_zam', target_value: 2000, reward_gold: 1000, reward_xp: 30 },
                { name: 'Treasure Hunter', description: 'Earn 3,500 gold from card draws', target_type: 'gold_from_zam', target_value: 3500, reward_gold: 1500, reward_xp: 45 },
                { name: 'Fortune Seeker', description: 'Earn 1,500 gold from card draws', target_type: 'gold_from_zam', target_value: 1500, reward_gold: 800, reward_xp: 25 },
                
                // Set/Generation Quests
                { name: 'Classic Collector', description: 'Draw 5 cards from Base Set era (Gen 1)', target_type: 'generation_1', target_value: 5, reward_gold: 700, reward_xp: 35 },
                { name: 'Modern Master', description: 'Draw 6 cards from recent sets (Gen 8+)', target_type: 'generation_modern', target_value: 6, reward_gold: 650, reward_xp: 30 },
                { name: 'Vintage Collector', description: 'Draw 4 cards from classic sets', target_type: 'vintage_sets', target_value: 4, reward_gold: 900, reward_xp: 40 },
                
                // Social Quests
                { name: 'Community Star', description: 'Receive 5 star reactions on your cards', target_type: 'star_reactions', target_value: 5, reward_gold: 400, reward_xp: 20 },
                { name: 'Showcase Champion', description: 'Get featured in global showcase', target_type: 'global_showcase', target_value: 1, reward_gold: 1000, reward_xp: 50 }
            ],
            
            weekly: [
                // Weekly Challenges - Higher stakes
                { name: 'Weekly Marathoner', description: 'Draw 75 Pokemon cards this week', target_type: 'card_draws', target_value: 75, reward_gold: 3000, reward_xp: 150 },
                { name: 'Type Master', description: 'Collect Pokemon of 6 different types', target_type: 'type_diversity', target_value: 6, reward_gold: 2500, reward_xp: 125 },
                { name: 'Rarity Expert', description: 'Pull 15 Rare or better cards', target_type: 'rarity_rare_plus', target_value: 15, reward_gold: 4000, reward_xp: 200 },
                { name: 'Golden Week', description: 'Earn 15,000 gold from /zam command', target_type: 'gold_from_zam', target_value: 15000, reward_gold: 5000, reward_xp: 250 },
                { name: 'Set Explorer', description: 'Draw cards from 8 different sets', target_type: 'set_diversity', target_value: 8, reward_gold: 3500, reward_xp: 175 },
                { name: 'Holo Collector', description: 'Pull 8 Holo Rare cards this week', target_type: 'rarity_holo', target_value: 8, reward_gold: 6000, reward_xp: 300 },
                { name: 'Generation Master', description: 'Collect cards from 4 different generations', target_type: 'generation_diversity', target_value: 4, reward_gold: 2800, reward_xp: 140 },
                { name: 'Social Butterfly', description: 'Receive 25 star reactions', target_type: 'star_reactions', target_value: 25, reward_gold: 2000, reward_xp: 100 }
            ],
            
            monthly: [
                // Monthly Objectives - Epic challenges
                { name: 'Monthly Legend', description: 'Draw 500 Pokemon cards this month', target_type: 'card_draws', target_value: 500, reward_gold: 15000, reward_xp: 1000 },
                { name: 'Ultimate Collector', description: 'Pull 50 Rare or better cards', target_type: 'rarity_rare_plus', target_value: 50, reward_gold: 20000, reward_xp: 1200 },
                { name: 'Holo Master', description: 'Pull 25 Holo Rare cards', target_type: 'rarity_holo', target_value: 25, reward_gold: 30000, reward_xp: 1500 },
                { name: 'Ultra Legend', description: 'Pull 8 Ultra Rare cards', target_type: 'rarity_ultra', target_value: 8, reward_gold: 50000, reward_xp: 2000 },
                { name: 'Golden Emperor', description: 'Earn 100,000 gold from /zam', target_type: 'gold_from_zam', target_value: 100000, reward_gold: 25000, reward_xp: 1250 },
                { name: 'Set Completion Master', description: 'Complete progress on 15 different sets', target_type: 'set_progress', target_value: 15, reward_gold: 35000, reward_xp: 1750 },
                { name: 'Type Pokemon Master', description: 'Collect cards of all 18 Pokemon types', target_type: 'all_types', target_value: 18, reward_gold: 40000, reward_xp: 2000 },
                { name: 'Community Champion', description: 'Receive 150 star reactions', target_type: 'star_reactions', target_value: 150, reward_gold: 10000, reward_xp: 500 }
            ]
        };
    }

    // Get available quests for assignment (with daily rotation)
    async getAvailableQuests(questType) {
        const quests = this.questPool[questType];
        if (!quests) return [];
        
        // For daily quests, rotate based on day of year
        if (questType === 'daily') {
            const dayOfYear = Math.floor((Date.now() / (1000 * 60 * 60 * 24)) % 365);
            const questsPerDay = 3; // Assign 3 daily quests
            const startIndex = (dayOfYear * questsPerDay) % quests.length;
            
            // Get 3 quests with rotation
            const selectedQuests = [];
            for (let i = 0; i < questsPerDay; i++) {
                selectedQuests.push(quests[(startIndex + i) % quests.length]);
            }
            return selectedQuests;
        }
        
        // For weekly/monthly, assign all available quests  
        return quests.slice(0, questType === 'weekly' ? 3 : 2);
    }

    // Initialize enhanced quest system in database
    async initializeEnhancedQuests() {
        try {
            // Clear old quest system
            await this.db.run('DELETE FROM quests');
            
            let questId = 1;
            
            // Add all quest types to database
            for (const [questType, quests] of Object.entries(this.questPool)) {
                for (const quest of quests) {
                    try {
                        // Try with target_type column first
                        await this.db.run(`
                            INSERT INTO quests 
                            (id, name, description, quest_type, target_value, reward_gold, reward_xp, reset_interval, target_type)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `, [
                            questId++,
                            quest.name,
                            quest.description, 
                            questType,
                            quest.target_value,
                            quest.reward_gold,
                            quest.reward_xp,
                            questType === 'daily' ? 86400 : questType === 'weekly' ? 604800 : 2592000,
                            quest.target_type
                        ]);
                    } catch (error) {
                        if (error.message.includes('no such column: target_type')) {
                            console.log('⚠️ Fallback: inserting quest without target_type column');
                            // Fallback for databases without target_type column
                            await this.db.run(`
                                INSERT INTO quests 
                                (id, name, description, quest_type, target_value, reward_gold, reward_xp, reset_interval)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                            `, [
                                questId - 1, // Use the same ID since it was incremented above
                                quest.name,
                                quest.description, 
                                questType,
                                quest.target_value,
                                quest.reward_gold,
                                quest.reward_xp,
                                questType === 'daily' ? 86400 : questType === 'weekly' ? 604800 : 2592000
                            ]);
                        } else {
                            throw error;
                        }
                    }
                }
            }
            
            console.log(`✅ Enhanced quest system initialized with ${questId - 1} diverse quests`);
            
        } catch (error) {
            console.error('Error initializing enhanced quests:', error);
        }
    }

    // Auto-assign quests with daily rotation
    async autoAssignDiverseQuests(userId) {
        const questTypes = ['daily', 'weekly', 'monthly'];
        
        for (const type of questTypes) {
            // Remove old completed quests for this type
            await this.cleanupCompletedQuests(userId, type);
            
            // Get available quests for this type (with rotation)
            const availableQuests = await this.getAvailableQuests(type);
            
            for (const questData of availableQuests) {
                // Find quest ID in database
                const dbQuest = await this.db.get(
                    'SELECT id FROM quests WHERE name = ? AND quest_type = ?',
                    [questData.name, type]
                );
                
                if (dbQuest) {
                    // Check if user already has this quest
                    const existing = await this.db.get(
                        'SELECT * FROM user_quests WHERE user_id = ? AND quest_id = ?',
                        [userId, dbQuest.id]
                    );

                    if (!existing) {
                        // Create new quest for user with milliseconds timestamp
                        await this.db.run(`
                            INSERT INTO user_quests (user_id, quest_id, progress, completed, assigned_date)
                            VALUES (?, ?, 0, FALSE, ?)
                        `, [userId, dbQuest.id, Date.now()]);
                    }
                }
            }
        }
    }

    // Enhanced quest progress update with type checking
    async updateEnhancedQuestProgress(userId, targetType, amount = 1, cardData = null) {
        // Get active user quests that match the target type
        let userQuests = [];
        
        try {
            // Try the enhanced query with target_type column
            userQuests = await this.db.all(`
                SELECT uq.*, q.name, q.target_value, q.reward_gold, q.reward_xp, q.description, 
                       COALESCE(q.target_type, 'card_draws') as target_type
                FROM user_quests uq
                JOIN quests q ON uq.quest_id = q.id
                WHERE uq.user_id = ? AND COALESCE(q.target_type, 'card_draws') = ? AND uq.completed = FALSE
            `, [userId, targetType]);
        } catch (error) {
            if (error.message.includes('no such column: q.target_type')) {
                console.log('⚠️ target_type column not found, using fallback query');
                // Fallback for databases without target_type column
                userQuests = await this.db.all(`
                    SELECT uq.*, q.name, q.target_value, q.reward_gold, q.reward_xp, q.description, 
                           'card_draws' as target_type
                    FROM user_quests uq
                    JOIN quests q ON uq.quest_id = q.id
                    WHERE uq.user_id = ? AND uq.completed = FALSE
                `, [userId]);
            } else {
                throw error;
            }
        }

        const completedQuests = [];

        for (const quest of userQuests) {
            let shouldUpdate = true;
            let progressAmount = amount;
            
            // Special handling for type-specific quests
            if (targetType.startsWith('type_') && cardData) {
                const requiredType = targetType.replace('type_', '');
                shouldUpdate = this.checkCardType(cardData, requiredType);
            }
            
            // Special handling for rarity quests
            else if (targetType.startsWith('rarity_') && cardData) {
                shouldUpdate = this.checkCardRarity(cardData, targetType);
            }
            
            // Special handling for generation quests
            else if (targetType.startsWith('generation_') && cardData) {
                shouldUpdate = this.checkCardGeneration(cardData, targetType);
            }
            
            if (shouldUpdate) {
                const newProgress = quest.progress + progressAmount;
                
                if (newProgress >= quest.target_value && !quest.completed) {
                    // Quest completed! Use milliseconds timestamp
                    await this.db.run(`
                        UPDATE user_quests 
                        SET progress = ?, completed = TRUE, completed_date = ?
                        WHERE id = ?
                    `, [quest.target_value, Date.now(), quest.id]);

                    // Add rewards
                    if (quest.reward_gold > 0) {
                        await this.db.run(
                            'UPDATE users SET gold = gold + ? WHERE id = ?',
                            [quest.reward_gold, userId]
                        );
                    }

                    const questCompletion = {
                        name: quest.name,
                        reward_gold: quest.reward_gold,
                        reward_xp: quest.reward_xp || 0
                    };

                    // Add XP and handle level ups
                    if (quest.reward_xp && quest.reward_xp > 0) {
                        const UserManager = require('./UserManager');
                        const tempUserManager = new UserManager(this.db);
                        const levelResult = await tempUserManager.addXP(userId, quest.reward_xp);
                        
                        if (levelResult && levelResult.leveledUp) {
                            questCompletion.levelUp = {
                                oldLevel: levelResult.oldLevel,
                                newLevel: levelResult.newLevel
                            };
                        }
                    }

                    completedQuests.push(questCompletion);
                } else {
                    // Update progress
                    await this.db.run(`
                        UPDATE user_quests SET progress = ? WHERE id = ?
                    `, [newProgress, quest.id]);
                }
            }
        }

        return completedQuests;
    }

    // Helper methods for quest validation
    checkCardType(cardData, requiredType) {
        if (!cardData.types) return false;
        const cardTypes = typeof cardData.types === 'string' ? 
            JSON.parse(cardData.types) : cardData.types;
        return cardTypes && cardTypes.some(type => 
            type.toLowerCase() === requiredType.toLowerCase()
        );
    }

    checkCardRarity(cardData, rarityTarget) {
        const rarity = cardData.rarity?.toLowerCase() || '';
        
        switch (rarityTarget) {
            case 'rarity_rare_plus':
                return rarity.includes('rare') || rarity.includes('ultra') || rarity.includes('secret');
            case 'rarity_holo':
                return rarity.includes('holo');
            case 'rarity_ultra':
                return rarity.includes('ultra');
            default:
                return false;
        }
    }

    checkCardGeneration(cardData, generationTarget) {
        // Map sets to generations (simplified)
        const genMapping = {
            'generation_1': ['base1', 'base2', 'base3', 'gym1', 'gym2'],
            'generation_modern': ['swsh9', 'swsh10', 'swsh11', 'swsh12']
        };
        
        const targetSets = genMapping[generationTarget] || [];
        return targetSets.includes(cardData.set_id);
    }

    // Clean up old completed quests
    async cleanupCompletedQuests(userId, questType) {
        const resetTime = this.getResetTime(questType);
        
        await this.db.run(`
            DELETE FROM user_quests 
            WHERE user_id = ? AND completed = TRUE 
            AND quest_id IN (SELECT id FROM quests WHERE quest_type = ?)
            AND completed_date < ?
        `, [userId, questType, resetTime]);
    }

    getResetTime(questType) {
        const now = Math.floor(Date.now() / 1000); // Convert to integer seconds for PostgreSQL BIGINT
        const day = 24 * 60 * 60;
        
        switch (questType) {
            case 'daily': return now - day;
            case 'weekly': return now - (day * 7);
            case 'monthly': return now - (day * 30);
            default: return now;
        }
    }

    // Get user quests with enhanced display
    async getUserQuests(userId) {
        console.log('🔍 QUEST: EnhancedQuestManager - getUserQuests called for:', userId);
        
        try {
            const result = await this.db.all(`
                SELECT uq.id, uq.user_id, uq.quest_id, uq.progress, uq.completed, uq.assigned_date, uq.completed_date,
                       q.name, q.description, q.quest_type, q.target_value, 
                       q.reward_gold, q.reward_xp, q.reset_interval, q.target_type
                FROM user_quests uq
                JOIN quests q ON uq.quest_id = q.id
                WHERE uq.user_id = ?
                ORDER BY q.quest_type, uq.completed ASC, q.name
            `, [userId]);
            
            console.log('🔍 QUEST: EnhancedQuestManager - getUserQuests success, count:', result.length);
            return result;
            
        } catch (error) {
            console.error('🚨 QUEST: EnhancedQuestManager - getUserQuests error:', error.message);
            
            // If target_type column doesn't exist, try without it
            if (error.message.includes('target_type')) {
                console.log('🔧 QUEST: Retrying getUserQuests without target_type column');
                try {
                    const fallbackResult = await this.db.all(`
                        SELECT uq.id, uq.user_id, uq.quest_id, uq.progress, uq.completed, uq.assigned_date, uq.completed_date,
                               q.name, q.description, q.quest_type, q.target_value, 
                               q.reward_gold, q.reward_xp, q.reset_interval
                        FROM user_quests uq
                        JOIN quests q ON uq.quest_id = q.id
                        WHERE uq.user_id = ?
                        ORDER BY q.quest_type, uq.completed ASC, q.name
                    `, [userId]);
                    
                    console.log('🔧 QUEST: Fallback getUserQuests success, count:', fallbackResult.length);
                    return fallbackResult;
                    
                } catch (fallbackError) {
                    console.error('🚨 QUEST: Fallback getUserQuests also failed:', fallbackError.message);
                    throw fallbackError;
                }
            }
            
            throw error;
        }
    }
}

module.exports = EnhancedQuestManager;