const Database = require('./Database');

class SetCompletionManager {
    constructor(database) {
        this.database = database;
    }

    // Initialize default set rewards for popular sets
    async initializeDefaultSetRewards() {
        const defaultRewards = [
            // Classic Sets - High rewards
            { set_id: 'base1', set_name: 'Base Set', reward_type: 'gold', reward_value: '5000', reward_description: 'Base Set Master - 5,000 Gold', bonus_multiplier: 1.5 },
            { set_id: 'base2', set_name: 'Jungle', reward_type: 'gold', reward_value: '4000', reward_description: 'Jungle Explorer - 4,000 Gold', bonus_multiplier: 1.3 },
            { set_id: 'base3', set_name: 'Fossil', reward_type: 'gold', reward_value: '4000', reward_description: 'Fossil Hunter - 4,000 Gold', bonus_multiplier: 1.3 },
            { set_id: 'base5', set_name: 'Team Rocket', reward_type: 'gold', reward_value: '3500', reward_description: 'Team Rocket Agent - 3,500 Gold', bonus_multiplier: 1.2 },
            
            // Modern Sets - Medium rewards  
            { set_id: 'swsh1', set_name: 'Sword & Shield', reward_type: 'gold', reward_value: '2500', reward_description: 'Galar Champion - 2,500 Gold', bonus_multiplier: 1.1 },
            { set_id: 'swsh9', set_name: 'Brilliant Stars', reward_type: 'gold', reward_value: '2000', reward_description: 'Star Collector - 2,000 Gold', bonus_multiplier: 1.0 },
            { set_id: 'swsh10', set_name: 'Astral Radiance', reward_type: 'gold', reward_value: '2000', reward_description: 'Astral Seeker - 2,000 Gold', bonus_multiplier: 1.0 },
            
            // Special Title Rewards
            { set_id: 'xy1', set_name: 'XY', reward_type: 'title', reward_value: 'Kalos Champion', reward_description: 'Earn the title "Kalos Champion"', bonus_multiplier: 1.0 },
            { set_id: 'sm1', set_name: 'Sun & Moon', reward_type: 'title', reward_value: 'Alola Guardian', reward_description: 'Earn the title "Alola Guardian"', bonus_multiplier: 1.0 },
        ];

        for (const reward of defaultRewards) {
            try {
                await this.database.run(`
                    INSERT OR IGNORE INTO set_rewards 
                    (set_id, set_name, reward_type, reward_value, reward_description, bonus_multiplier)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [reward.set_id, reward.set_name, reward.reward_type, reward.reward_value, 
                    reward.reward_description, reward.bonus_multiplier]);
            } catch (error) {
                // Silenced: Set rewards already exist (expected on startup)
                // console.log(`Set reward ${reward.set_id} may already exist`);
            }
        }
    }

    // Update user's set completion progress
    async updateSetCompletion(userId) {
        try {
            // Get all sets the user has cards from
            const userSets = await this.database.all(`
                SELECT DISTINCT c.set_id, c.set_name
                FROM user_cards uc
                JOIN cards c ON uc.card_id = c.id
                WHERE uc.user_id = ?
            `, [userId]);

            for (const userSet of userSets) {
                await this.updateSingleSetCompletion(userId, userSet.set_id, userSet.set_name);
            }

        } catch (error) {
            console.error('Error updating set completion:', error);
        }
    }

    // Update completion for a specific set
    async updateSingleSetCompletion(userId, setId, setName) {
        try {
            // Get total unique cards in this set
            const totalCards = await this.database.get(`
                SELECT COUNT(DISTINCT id) as count
                FROM cards 
                WHERE set_id = ?
            `, [setId]);

            if (!totalCards || totalCards.count === 0) return;

            // Get unique cards owned by user in this set
            const ownedCards = await this.database.get(`
                SELECT COUNT(DISTINCT uc.card_id) as count
                FROM user_cards uc
                JOIN cards c ON uc.card_id = c.id
                WHERE uc.user_id = ? AND c.set_id = ?
            `, [userId, setId]);

            const ownedCount = ownedCards ? ownedCards.count : 0;
            const completionPercentage = (ownedCount / totalCards.count) * 100;
            const isCompleted = ownedCount >= totalCards.count;

            // Insert or update set completion record
            await this.database.run(`
                INSERT OR REPLACE INTO set_completion 
                (user_id, set_id, set_name, total_cards, owned_cards, completion_percentage, 
                 is_completed, completed_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
            `, [userId, setId, setName, totalCards.count, ownedCount, completionPercentage,
                isCompleted, isCompleted ? Date.now() / 1000 : null]);

            // Check if this is a new completion and award rewards
            if (isCompleted) {
                await this.checkAndAwardSetReward(userId, setId, setName);
            }

            return {
                setId,
                setName,
                totalCards: totalCards.count,
                ownedCards: ownedCount,
                completionPercentage,
                isCompleted
            };

        } catch (error) {
            console.error(`Error updating set completion for ${setId}:`, error);
        }
    }

    // Award rewards for completing a set
    async checkAndAwardSetReward(userId, setId, setName) {
        try {
            // Check if reward already claimed
            const completion = await this.database.get(`
                SELECT reward_claimed FROM set_completion 
                WHERE user_id = ? AND set_id = ? AND is_completed = TRUE
            `, [userId, setId]);

            if (!completion || completion.reward_claimed) return null;

            // Get reward configuration
            const reward = await this.database.get(`
                SELECT * FROM set_rewards WHERE set_id = ? AND is_active = TRUE
            `, [setId]);

            if (!reward) {
                // Default reward if no specific reward configured
                await this.awardDefaultSetReward(userId, setName);
                return { type: 'gold', value: 1000, description: `${setName} Completion Bonus` };
            }

            let awardedReward = null;

            // Award based on reward type
            switch (reward.reward_type) {
                case 'gold':
                    const goldAmount = parseInt(reward.reward_value) * reward.bonus_multiplier;
                    await this.database.run(`
                        UPDATE users SET gold = gold + ? WHERE id = ?
                    `, [goldAmount, userId]);
                    awardedReward = { type: 'gold', value: goldAmount, description: reward.reward_description };
                    break;

                case 'title':
                    await this.database.run(`
                        INSERT OR IGNORE INTO user_titles (user_id, title, title_type, source_id)
                        VALUES (?, ?, 'set_completion', ?)
                    `, [userId, reward.reward_value, setId]);
                    awardedReward = { type: 'title', value: reward.reward_value, description: reward.reward_description };
                    break;

                case 'item':
                    // Award item (would integrate with existing item system)
                    awardedReward = { type: 'item', value: reward.reward_value, description: reward.reward_description };
                    break;
            }

            // Mark reward as claimed
            await this.database.run(`
                UPDATE set_completion SET reward_claimed = TRUE WHERE user_id = ? AND set_id = ?
            `, [userId, setId]);

            return awardedReward;

        } catch (error) {
            console.error('Error awarding set reward:', error);
            return null;
        }
    }

    // Award default reward for sets without specific rewards
    async awardDefaultSetReward(userId, setName) {
        const defaultGold = 1000;
        await this.database.run(`
            UPDATE users SET gold = gold + ? WHERE id = ?
        `, [defaultGold, userId]);
    }

    // Get user's set completion progress
    async getUserSetCompletion(userId, limit = 20, showCompleted = null) {
        try {
            let whereClause = 'WHERE sc.user_id = ?';
            const params = [userId];

            if (showCompleted === true) {
                whereClause += ' AND sc.is_completed = TRUE';
            } else if (showCompleted === false) {
                whereClause += ' AND sc.is_completed = FALSE';
            }

            const completions = await this.database.all(`
                SELECT sc.*, sr.reward_description, sr.reward_type, sr.reward_value
                FROM set_completion sc
                LEFT JOIN set_rewards sr ON sc.set_id = sr.set_id
                ${whereClause}
                ORDER BY sc.completion_percentage DESC, sc.set_name ASC
                LIMIT ?
            `, [...params, limit]);

            return completions;

        } catch (error) {
            console.error('Error getting user set completion:', error);
            return [];
        }
    }

    // Get set completion leaderboard
    async getSetCompletionLeaderboard(setId = null, limit = 10) {
        try {
            let query = `
                SELECT u.username, sc.set_name, sc.completion_percentage, sc.is_completed, sc.completed_at
                FROM set_completion sc
                JOIN users u ON sc.user_id = u.id
            `;
            let params = [];

            if (setId) {
                query += ' WHERE sc.set_id = ?';
                params.push(setId);
            }

            query += ` ORDER BY sc.completion_percentage DESC, sc.completed_at ASC LIMIT ?`;
            params.push(limit);

            const leaderboard = await this.database.all(query, params);
            return leaderboard;

        } catch (error) {
            console.error('Error getting set completion leaderboard:', error);
            return [];
        }
    }

    // Get user's earned titles
    async getUserTitles(userId) {
        try {
            const titles = await this.database.all(`
                SELECT title, title_type, earned_at, is_active
                FROM user_titles 
                WHERE user_id = ?
                ORDER BY earned_at DESC
            `, [userId]);

            return titles;

        } catch (error) {
            console.error('Error getting user titles:', error);
            return [];
        }
    }

    // Set active title for user
    async setActiveTitle(userId, title) {
        try {
            // Deactivate all titles first
            await this.database.run(`
                UPDATE user_titles SET is_active = FALSE WHERE user_id = ?
            `, [userId]);

            // Activate the selected title
            await this.database.run(`
                UPDATE user_titles SET is_active = TRUE 
                WHERE user_id = ? AND title = ?
            `, [userId, title]);

            return true;

        } catch (error) {
            console.error('Error setting active title:', error);
            return false;
        }
    }

    // Get overall completion statistics for a user
    async getUserCompletionStats(userId) {
        try {
            const stats = await this.database.get(`
                SELECT 
                    COUNT(*) as total_sets_tracked,
                    COUNT(CASE WHEN is_completed = TRUE THEN 1 END) as completed_sets,
                    ROUND(AVG(completion_percentage), 2) as average_completion,
                    MAX(completion_percentage) as highest_completion
                FROM set_completion 
                WHERE user_id = ?
            `, [userId]);

            const titles = await this.database.get(`
                SELECT COUNT(*) as total_titles
                FROM user_titles 
                WHERE user_id = ?
            `, [userId]);

            return {
                ...stats,
                totalTitles: titles ? titles.total_titles : 0
            };

        } catch (error) {
            console.error('Error getting user completion stats:', error);
            return null;
        }
    }
}

module.exports = SetCompletionManager;