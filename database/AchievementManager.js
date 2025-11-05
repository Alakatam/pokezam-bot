class AchievementManager {
    constructor(database) {
        this.db = database;
        
        // OPTIMIZATION: Smart achievement cache for performance ⚡
        this.achievementCache = new Map();
        this.cacheInitialized = false;
        
        // Initialize tables asynchronously (don't block constructor)
        this.initializeTables().catch(error => {
            console.error('Error in AchievementManager initialization:', error);
        });
    }

    async initializeTables() {
        try {
            // Create achievements table (predefined achievements)
            await this.db.run(`
                CREATE TABLE IF NOT EXISTS achievements (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    category TEXT NOT NULL,
                    emoji TEXT NOT NULL,
                    condition_type TEXT NOT NULL,
                    condition_value INTEGER NOT NULL,
                    reward_gold INTEGER DEFAULT 0,
                    reward_xp INTEGER DEFAULT 0,
                    is_secret BOOLEAN DEFAULT FALSE,
                    unlock_order INTEGER DEFAULT 0,
                    created_at INTEGER DEFAULT (strftime('%s', 'now'))
                )
            `);

            // Create user_achievements table (user progress)
            await this.db.run(`
                CREATE TABLE IF NOT EXISTS user_achievements (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    achievement_id INTEGER NOT NULL,
                    earned_at INTEGER DEFAULT (strftime('%s', 'now')),
                    progress INTEGER DEFAULT 0,
                    is_completed BOOLEAN DEFAULT FALSE,
                    FOREIGN KEY (achievement_id) REFERENCES achievements(id),
                    UNIQUE(user_id, achievement_id)
                )
            `);

            // Initialize default achievements if none exist
            const existingAchievements = await this.db.get('SELECT COUNT(*) as count FROM achievements');
            if (existingAchievements.count === 0) {
                await this.initializeDefaultAchievements();
            }

        } catch (error) {
            console.error('Error initializing achievement tables:', error);
        }
    }

    async initializeDefaultAchievements() {
        const defaultAchievements = [
            // Collection Achievements
            {
                name: 'first_card',
                title: 'First Steps',
                description: 'Draw your very first Pokemon card!',
                category: 'collection',
                emoji: '🎴',
                condition_type: 'total_draws',
                condition_value: 1,
                reward_gold: 100,
                reward_xp: 5,
                unlock_order: 1
            },
            {
                name: 'card_collector',
                title: 'Card Collector',
                description: 'Draw 50 Pokemon cards',
                category: 'collection',
                emoji: '📚',
                condition_type: 'total_draws',
                condition_value: 50,
                reward_gold: 500,
                reward_xp: 25,
                unlock_order: 10
            },
            {
                name: 'devoted_trainer',
                title: 'Devoted Trainer',
                description: 'Draw 100 Pokemon cards',
                category: 'collection',
                emoji: '🎯',
                condition_type: 'total_draws',
                condition_value: 100,
                reward_gold: 1000,
                reward_xp: 50,
                unlock_order: 15
            },
            {
                name: 'master_collector',
                title: 'Master Collector',
                description: 'Draw 500 Pokemon cards',
                category: 'collection',
                emoji: '🏆',
                condition_type: 'total_draws',
                condition_value: 500,
                reward_gold: 2500,
                reward_xp: 100,
                unlock_order: 25
            },

            // Rarity Achievements
            {
                name: 'first_rare',
                title: 'Rare Discovery',
                description: 'Pull your first Rare card or above',
                category: 'rarity',
                emoji: '⭐',
                condition_type: 'rare_cards',
                condition_value: 1,
                reward_gold: 200,
                reward_xp: 10,
                unlock_order: 5
            },
            {
                name: 'first_holo',
                title: 'Holographic Wonder',
                description: 'Pull your first Holo Rare card',
                category: 'rarity',
                emoji: '✨',
                condition_type: 'holo_cards',
                condition_value: 1,
                reward_gold: 500,
                reward_xp: 25,
                unlock_order: 12
            },
            {
                name: 'first_ultra',
                title: 'Ultra Discovery',
                description: 'Pull your first Ultra Rare card',
                category: 'rarity',
                emoji: '💎',
                condition_type: 'ultra_cards',
                condition_value: 1,
                reward_gold: 1000,
                reward_xp: 50,
                unlock_order: 18
            },
            {
                name: 'first_secret',
                title: 'Legendary Find',
                description: 'Pull your first Secret Rare card',
                category: 'rarity',
                emoji: '🌟',
                condition_type: 'secret_cards',
                condition_value: 1,
                reward_gold: 2000,
                reward_xp: 100,
                unlock_order: 30,
                is_secret: true
            },
            {
                name: 'holo_hunter',
                title: 'Holo Hunter',
                description: 'Pull 10 Holo Rare cards',
                category: 'rarity',
                emoji: '🔮',
                condition_type: 'holo_cards',
                condition_value: 10,
                reward_gold: 2500,
                reward_xp: 75,
                unlock_order: 22
            },

            // Level Achievements
            {
                name: 'level_10',
                title: 'Rising Trainer',
                description: 'Reach level 10',
                category: 'progression',
                emoji: '📈',
                condition_type: 'level',
                condition_value: 10,
                reward_gold: 750,
                reward_xp: 0,
                unlock_order: 8
            },
            {
                name: 'level_25',
                title: 'Experienced Trainer',
                description: 'Reach level 25',
                category: 'progression',
                emoji: '🎖️',
                condition_type: 'level',
                condition_value: 25,
                reward_gold: 1500,
                reward_xp: 0,
                unlock_order: 20
            },
            {
                name: 'level_50',
                title: 'Expert Trainer',
                description: 'Reach level 50',
                category: 'progression',
                emoji: '👑',
                condition_type: 'level',
                condition_value: 50,
                reward_gold: 3000,
                reward_xp: 0,
                unlock_order: 35
            },

            // Economic Achievements
            {
                name: 'first_thousand',
                title: 'Gold Saver',
                description: 'Accumulate 1,000 gold',
                category: 'economy',
                emoji: '💰',
                condition_type: 'gold',
                condition_value: 1000,
                reward_gold: 250,
                reward_xp: 15,
                unlock_order: 6
            },
            {
                name: 'gold_collector',
                title: 'Wealthy Trainer',
                description: 'Accumulate 10,000 gold',
                category: 'economy',
                emoji: '🪙',
                condition_type: 'gold',
                condition_value: 10000,
                reward_gold: 1000,
                reward_xp: 50,
                unlock_order: 28
            },

            // Quest Achievements  
            {
                name: 'quest_master',
                title: 'Quest Master',
                description: 'Complete 10 quests',
                category: 'quests',
                emoji: '📋',
                condition_type: 'quests_completed',
                condition_value: 10,
                reward_gold: 800,
                reward_xp: 40,
                unlock_order: 14
            },
            {
                name: 'daily_dedication',
                title: 'Daily Dedication',
                description: 'Claim daily rewards 7 days in a row',
                category: 'quests',
                emoji: '📅',
                condition_type: 'daily_streak',
                condition_value: 7,
                reward_gold: 1000,
                reward_xp: 30,
                unlock_order: 16
            },

            // Special/Community Achievements
            {
                name: 'showcase_star',
                title: 'Showcase Star',
                description: 'Get featured in Global showcase 5 times',
                category: 'community',
                emoji: '⭐',
                condition_type: 'showcase_count',
                condition_value: 5,
                reward_gold: 2000,
                reward_xp: 75,
                unlock_order: 24,
                is_secret: true
            },
            {
                name: 'variant_collector',
                title: 'Variant Collector',
                description: 'Pull 5 special Master Set variants',
                category: 'collection',
                emoji: '🎁',
                condition_type: 'variants_collected',
                condition_value: 5,
                reward_gold: 1500,
                reward_xp: 60,
                unlock_order: 26
            }
        ];

        // Insert all default achievements
        for (const achievement of defaultAchievements) {
            try {
                await this.db.run(`
                    INSERT OR IGNORE INTO achievements 
                    (name, title, description, category, emoji, condition_type, condition_value, 
                     reward_gold, reward_xp, is_secret, unlock_order)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    achievement.name, achievement.title, achievement.description,
                    achievement.category, achievement.emoji, achievement.condition_type,
                    achievement.condition_value, achievement.reward_gold, achievement.reward_xp,
                    achievement.is_secret ? 1 : 0, achievement.unlock_order
                ]);
            } catch (error) {
                console.error(`Error inserting achievement ${achievement.name}:`, error);
            }
        }

        console.log('✅ Initialized achievement system with default achievements');
    }

    async getUserAchievements(userId) {
        return await this.db.all(`
            SELECT a.*, ua.progress, ua.is_completed, ua.earned_at
            FROM achievements a
            LEFT JOIN user_achievements ua ON a.achievement_id = ua.achievement_id AND ua.user_id = ?
            ORDER BY a.sort_order, a.name
        `, [userId]);
    }

    async getCompletedAchievements(userId) {
        return await this.db.all(`
            SELECT a.*, ua.earned_at
            FROM achievements a
            JOIN user_achievements ua ON a.achievement_id = ua.achievement_id
            WHERE ua.user_id = ? AND ua.is_completed = TRUE
            ORDER BY ua.earned_at DESC
        `, [userId]);
    }

    // OPTIMIZATION: Smart cache initialization for achievement patterns ⚡
    async initializeAchievementCache() {
        if (this.cacheInitialized) return;
        
        try {
            const allAchievements = await this.db.all('SELECT * FROM achievements');
            
            // Pre-categorize achievements by type for instant filtering
            const categories = {
                'total_draws': [],
                'level': [],
                'gold': [],
                'rare_cards': [],
                'holo_cards': [],
                'ultra_cards': [],
                'secret_cards': []
            };
            
            allAchievements.forEach(achievement => {
                const name = achievement.name.toLowerCase();
                if (name.includes('draw') || name.includes('card')) categories.total_draws.push(achievement.achievement_id);
                if (name.includes('level')) categories.level.push(achievement.achievement_id);
                if (name.includes('gold')) categories.gold.push(achievement.achievement_id);
                if (name.includes('rare')) categories.rare_cards.push(achievement.achievement_id);
                if (name.includes('holo')) categories.holo_cards.push(achievement.achievement_id);
                if (name.includes('ultra')) categories.ultra_cards.push(achievement.achievement_id);
                if (name.includes('secret')) categories.secret_cards.push(achievement.achievement_id);
            });
            
            this.achievementCache = categories;
            this.cacheInitialized = true;
        } catch (error) {
            console.error('Achievement cache initialization failed:', error);
        }
    }

    async checkAndUpdateAchievement(userId, conditionType, currentValue) {
        try {
            // OPTIMIZATION: Initialize cache if needed ⚡
            await this.initializeAchievementCache();
            
            // OPTIMIZATION: Use smart cache for instant achievement filtering 🚀
            const cachedAchievementIds = this.achievementCache[conditionType] || [];
            
            if (cachedAchievementIds.length === 0) {
                return []; // No achievements for this condition type
            }
            
            // Get only relevant achievements using cached IDs (MUCH FASTER!)
            const placeholders = cachedAchievementIds.map(() => '?').join(',');
            const achievements = await this.db.all(`
                SELECT a.*, ua.is_completed
                FROM achievements a
                LEFT JOIN user_achievements ua ON a.achievement_id = ua.achievement_id AND ua.user_id = ?
                WHERE a.achievement_id IN (${placeholders}) AND (ua.is_completed IS NULL OR ua.is_completed = FALSE)
            `, [userId, ...cachedAchievementIds]);

            const newlyCompleted = [];

            for (const achievement of achievements) {
                if (currentValue >= achievement.condition_value) {
                    // Mark achievement as completed
                    await this.db.run(`
                        INSERT OR REPLACE INTO user_achievements 
                        (user_id, achievement_id, progress, is_completed, earned_at)
                        VALUES (?, ?, ?, TRUE, ?)
                    `, [userId, achievement.achievement_id, achievement.condition_value, Math.floor(Date.now() / 1000)]);

                    newlyCompleted.push(achievement);
                } else {
                    // Update progress
                    await this.db.run(`
                        INSERT OR REPLACE INTO user_achievements 
                        (user_id, achievement_id, progress, is_completed)
                        VALUES (?, ?, ?, FALSE)
                    `, [userId, achievement.achievement_id, currentValue]);
                }
            }

            return newlyCompleted;

        } catch (error) {
            console.error('Error checking achievements:', error);
            return [];
        }
    }

    async getAchievementStats(userId) {
        const total = await this.db.get('SELECT COUNT(*) as count FROM achievements WHERE is_hidden = FALSE');
        const completed = await this.db.get(`
            SELECT COUNT(*) as count FROM user_achievements 
            WHERE user_id = ? AND is_completed = TRUE
        `, [userId]);

        return {
            total: total.count,
            completed: completed.count,
            percentage: total.count > 0 ? Math.round((completed.count / total.count) * 100) : 0
        };
    }

    // Helper method to track specific achievement progress
    async updateShowcaseCount(userId) {
        const current = await this.db.get(`
            SELECT showcase_count FROM users WHERE id = ?
        `, [userId]);
        
        const newCount = (current?.showcase_count || 0) + 1;
        
        await this.db.run(`
            UPDATE users SET showcase_count = ? WHERE id = ?
        `, [newCount, userId]);

        return await this.checkAndUpdateAchievement(userId, 'showcase_count', newCount);
    }
}

module.exports = AchievementManager;