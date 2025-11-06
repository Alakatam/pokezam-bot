const Database = require('../database/Database');
const UserManager = require('../database/UserManager');
const fs = require('fs');
const path = require('path');

class DatabaseBackupManager {
    constructor() {
        this.backupUrl = process.env.DATABASE_BACKUP_URL; // Could be a cloud storage URL
        this.localBackupPath = '/tmp/pokezam_backup.json';
        this.initialBackupPath = path.join(__dirname, '..', 'initial_backup.json');
    }

    // Create a JSON backup of essential user data
    async createBackup() {
        const database = new Database();
        const userManager = new UserManager(database);
        
        try {
            await database.connect();
            
            console.log('📦 Creating database backup...');
            
            // Get all essential data
            const users = await database.all('SELECT * FROM users');
            const userItems = await database.all('SELECT * FROM user_items');
            const activeEffects = await database.all('SELECT * FROM active_effects');
            
            // Get new feature data (achievements, set completion, titles) - handle missing tables gracefully
            let achievements = [];
            let userAchievements = [];
            let setCompletion = [];
            let setRewards = [];
            let userTitles = [];
            
            try {
                achievements = await database.all('SELECT * FROM achievements');
            } catch (e) { console.log('⚠️ achievements table not found, skipping...'); }
            
            try {
                userAchievements = await database.all('SELECT * FROM user_achievements');
            } catch (e) { console.log('⚠️ user_achievements table not found, skipping...'); }
            
            try {
                setCompletion = await database.all('SELECT * FROM set_completion');
            } catch (e) { console.log('⚠️ set_completion table not found, skipping...'); }
            
            try {
                setRewards = await database.all('SELECT * FROM set_rewards');
            } catch (e) { console.log('⚠️ set_rewards table not found, skipping...'); }
            
            try {
                userTitles = await database.all('SELECT * FROM user_titles');
            } catch (e) { console.log('⚠️ user_titles table not found, skipping...'); }
            
            const backup = {
                timestamp: new Date().toISOString(),
                version: '2.0', // Updated version for new tables
                data: {
                    users,
                    userItems,
                    activeEffects,
                    achievements,
                    userAchievements,
                    setCompletion,
                    setRewards,
                    userTitles
                }
            };
            
            // Save to local file
            fs.writeFileSync(this.localBackupPath, JSON.stringify(backup, null, 2));
            
            console.log(`✅ Backup created: ${users.length} users, ${userItems.length} items, ${activeEffects.length} effects`);
            console.log(`🏆 Backup includes: ${achievements.length} achievements, ${userAchievements.length} user achievements`);
            console.log(`📊 Backup includes: ${setCompletion.length} set completion records, ${setRewards.length} rewards, ${userTitles.length} titles`);
            console.log(`📁 Backup saved to: ${this.localBackupPath}`);
            
            return backup;
            
        } catch (error) {
            console.error('❌ Backup creation failed:', error);
            throw error;
        } finally {
            database.close();
        }
    }

    // Restore data from backup
    async restoreBackup() {
        // Check for initial backup first (on first deployment)
        if (!fs.existsSync(this.localBackupPath) && fs.existsSync(this.initialBackupPath)) {
            console.log('📂 Found initial backup, using for first deployment');
            return await this.restoreFromInitialBackup();
        }
        
        if (!fs.existsSync(this.localBackupPath)) {
            console.log('📂 No backup file found, starting fresh');
            return false;
        }

        const database = new Database();
        
        try {
            await database.connect();
            await database.initialize();
            
            console.log('🔄 Restoring from backup...');
            
            const backupData = JSON.parse(fs.readFileSync(this.localBackupPath, 'utf8'));
            
            if (!backupData.data) {
                console.log('❌ Invalid backup format');
                return false;
            }
            
            const { users, userItems, activeEffects } = backupData.data;
            
            // Restore users
            for (const user of users) {
                await database.run(`
                    INSERT OR REPLACE INTO users 
                    (id, username, level, xp, gold, coins, total_draws, guild_id, scout_level, 
                     scout_start_time, scout_duration, last_draw, has_started, last_daily_claim, daily_streak, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    user.id, user.username, user.level, user.xp, user.gold, user.coins || 0,
                    user.total_draws, user.guild_id, user.scout_level, user.scout_start_time,
                    user.scout_duration, user.last_draw, user.has_started, user.last_daily_claim,
                    user.daily_streak || 0, user.created_at
                ]);
            }
            
            // Restore user items
            for (const item of userItems) {
                await database.run(`
                    INSERT OR REPLACE INTO user_items (id, user_id, item_id, quantity, obtained_at)
                    VALUES (?, ?, ?, ?, ?)
                `, [item.id, item.user_id, item.item_id, item.quantity, item.obtained_at]);
            }
            
            // Restore active effects
            for (const effect of activeEffects) {
                await database.run(`
                    INSERT OR REPLACE INTO active_effects 
                    (id, user_id, effect_type, category, multiplier, expires_at, uses_remaining, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    effect.id, effect.user_id, effect.effect_type, effect.category,
                    effect.multiplier, effect.expires_at, effect.uses_remaining, effect.created_at
                ]);
            }
            
            // Restore new feature data (version 2.0+)
            const { achievements, userAchievements, setCompletion, setRewards, userTitles } = backupData.data;
            
            // Restore achievements (system defaults)
            if (achievements && achievements.length > 0) {
                for (const achievement of achievements) {
                    await database.run(`
                        INSERT OR REPLACE INTO achievements 
                        (id, name, description, category, target_value, reward_gold, reward_xp, icon, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        achievement.id, achievement.name, achievement.description, achievement.category,
                        achievement.target_value, achievement.reward_gold, achievement.reward_xp, 
                        achievement.icon, achievement.created_at
                    ]);
                }
            }
            
            // Restore user achievements
            if (userAchievements && userAchievements.length > 0) {
                for (const userAch of userAchievements) {
                    await database.run(`
                        INSERT OR REPLACE INTO user_achievements 
                        (id, user_id, achievement_id, progress, is_completed, completed_at, reward_claimed, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        userAch.id, userAch.user_id, userAch.achievement_id, userAch.progress,
                        userAch.is_completed, userAch.completed_at, userAch.reward_claimed, userAch.created_at
                    ]);
                }
            }
            
            // Restore set completion data
            if (setCompletion && setCompletion.length > 0) {
                for (const completion of setCompletion) {
                    await database.run(`
                        INSERT OR REPLACE INTO set_completion 
                        (id, user_id, set_id, set_name, total_cards, owned_cards, completion_percentage, 
                         is_completed, completed_at, reward_claimed, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        completion.id, completion.user_id, completion.set_id, completion.set_name,
                        completion.total_cards, completion.owned_cards, completion.completion_percentage,
                        completion.is_completed, completion.completed_at, completion.reward_claimed,
                        completion.created_at, completion.updated_at
                    ]);
                }
            }
            
            // Restore set rewards configuration
            if (setRewards && setRewards.length > 0) {
                for (const reward of setRewards) {
                    await database.run(`
                        INSERT OR REPLACE INTO set_rewards 
                        (id, set_id, set_name, reward_type, reward_value, reward_description, 
                         bonus_multiplier, is_active, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        reward.id, reward.set_id, reward.set_name, reward.reward_type,
                        reward.reward_value, reward.reward_description, reward.bonus_multiplier,
                        reward.is_active, reward.created_at
                    ]);
                }
            }
            
            // Restore user titles
            if (userTitles && userTitles.length > 0) {
                for (const title of userTitles) {
                    await database.run(`
                        INSERT OR REPLACE INTO user_titles 
                        (id, user_id, title, title_type, source_id, earned_at, is_active)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `, [
                        title.id, title.user_id, title.title, title.title_type,
                        title.source_id, title.earned_at, title.is_active
                    ]);
                }
            }
            
            console.log(`✅ Restored: ${users.length} users, ${userItems.length} items, ${activeEffects.length} effects`);
            if (achievements) console.log(`🏆 Restored: ${achievements.length} achievements`);
            if (userAchievements) console.log(`🎯 Restored: ${userAchievements.length} user achievements`);
            if (setCompletion) console.log(`📊 Restored: ${setCompletion.length} set completion records`);
            if (setRewards) console.log(`🎁 Restored: ${setRewards.length} set rewards`);
            if (userTitles) console.log(`👑 Restored: ${userTitles.length} user titles`);
            console.log(`📅 Backup from: ${backupData.timestamp}`);
            
            return true;
            
        } catch (error) {
            console.error('❌ Backup restore failed:', error);
            return false;
        } finally {
            database.close();
        }
    }

    // Auto-backup every hour
    startAutoBackup() {
        setInterval(async () => {
            try {
                await this.createBackup();
                console.log('🔄 Auto-backup completed');
            } catch (error) {
                console.error('❌ Auto-backup failed:', error);
            }
        }, 60 * 60 * 1000); // Every hour

        console.log('⏰ Auto-backup started (every hour)');
    }

    // Restore from initial backup (includes cards and all data)
    async restoreFromInitialBackup() {
        const database = new Database();
        
        try {
            await database.connect();
            await database.initialize();
            
            console.log('🔄 Restoring from initial deployment backup...');
            
            const backupData = JSON.parse(fs.readFileSync(this.initialBackupPath, 'utf8'));
            
            if (!backupData.data) {
                console.log('❌ Invalid initial backup format');
                return false;
            }
            
            const { users, userItems, userQuests, activeEffects, userCards, cards, quests } = backupData.data;
            
            // Restore cards first (they're needed for user cards)
            if (cards && cards.length > 0) {
                console.log('📦 Restoring', cards.length, 'cards...');
                for (const card of cards) {
                    await database.run(`
                        INSERT OR REPLACE INTO cards 
                        (id, name, set_name, set_id, number, rarity, api_id, image_large, image_small, 
                         is_cached, types, variant_normal, variant_reverse, variant_holo, variant_first_edition, variant_promo)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        card.id, card.name, card.set_name, card.set_id, card.number, card.rarity,
                        card.api_id, card.image_large, card.image_small, card.is_cached, card.types,
                        card.variant_normal || 1, card.variant_reverse || 0, card.variant_holo || 0,
                        card.variant_first_edition || 0, card.variant_promo || 0
                    ]);
                }
            }
            
            // Restore quests
            if (quests && quests.length > 0) {
                console.log('🎯 Restoring', quests.length, 'quests...');
                for (const quest of quests) {
                    await database.run(`
                        INSERT OR REPLACE INTO quests 
                        (id, name, description, quest_type, target_value, reward_gold, reward_xp, reset_interval)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        quest.id, quest.name, quest.description, quest.quest_type,
                        quest.target_value, quest.reward_gold, quest.reward_xp, quest.reset_interval
                    ]);
                }
            }
            
            // Restore users
            if (users && users.length > 0) {
                console.log('👥 Restoring', users.length, 'users...');
                for (const user of users) {
                    await database.run(`
                        INSERT OR REPLACE INTO users 
                        (id, username, level, xp, gold, coins, total_draws, guild_id, scout_level, 
                         scout_start_time, scout_duration, last_draw, has_started, last_daily_claim, daily_streak, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        user.id, user.username, user.level, user.xp, user.gold, user.coins || 0,
                        user.total_draws, user.guild_id, user.scout_level, user.scout_start_time,
                        user.scout_duration, user.last_draw, user.has_started, user.last_daily_claim,
                        user.daily_streak || 0, user.created_at
                    ]);
                }
            }
            
            // Restore user items
            if (userItems && userItems.length > 0) {
                console.log('🎒 Restoring', userItems.length, 'user items...');
                for (const item of userItems) {
                    await database.run(`
                        INSERT OR REPLACE INTO user_items 
                        (id, user_id, item_id, quantity, obtained_at)
                        VALUES (?, ?, ?, ?, ?)
                    `, [
                        item.id, item.user_id, item.item_id, item.quantity, item.obtained_at
                    ]);
                }
            }
            
            // Restore user quests and other data...
            if (userQuests && userQuests.length > 0) {
                console.log('📋 Restoring', userQuests.length, 'user quests...');
                for (const quest of userQuests) {
                    await database.run(`
                        INSERT OR REPLACE INTO user_quests 
                        (id, user_id, quest_id, progress, completed, last_reset, completed_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `, [
                        quest.id, quest.user_id, quest.quest_id, quest.progress,
                        quest.completed, quest.last_reset, quest.completed_at
                    ]);
                }
            }
            
            if (activeEffects && activeEffects.length > 0) {
                console.log('✨ Restoring', activeEffects.length, 'active effects...');
                for (const effect of activeEffects) {
                    await database.run(`
                        INSERT OR REPLACE INTO active_effects 
                        (id, user_id, effect_type, category, multiplier, uses_remaining, expires_at, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        effect.id, effect.user_id, effect.effect_type, effect.effect_category || effect.category,
                        effect.multiplier, effect.uses_remaining, effect.expires_at, effect.created_at
                    ]);
                }
            }
            
            if (userCards && userCards.length > 0) {
                console.log('🎴 Restoring', userCards.length, 'user cards...');
                for (const card of userCards) {
                    await database.run(`
                        INSERT OR REPLACE INTO user_cards 
                        (id, user_id, card_id, star_level, quantity, obtained_at, owns_normal, owns_reverse, owns_holo, owns_first_edition, owns_promo)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        card.id, card.user_id, card.card_id, card.star_level || card.variant || 1,
                        card.quantity, card.obtained_at,
                        card.owns_normal || 1, card.owns_reverse || 0, card.owns_holo || 0,
                        card.owns_first_edition || 0, card.owns_promo || 0
                    ]);
                }
            }
            
            console.log('✅ Initial backup restoration completed successfully');
            
            // Copy initial backup to regular backup location for future use (only if directory exists)
            const backupDir = path.dirname(this.localBackupPath);
            if (fs.existsSync(backupDir) || process.platform !== 'win32') {
                try {
                    if (!fs.existsSync(backupDir)) {
                        fs.mkdirSync(backupDir, { recursive: true });
                    }
                    fs.copyFileSync(this.initialBackupPath, this.localBackupPath);
                    console.log('📋 Created regular backup from initial data');
                } catch (copyError) {
                    console.log('⚠️ Could not create regular backup copy:', copyError.message);
                }
            } else {
                console.log('📋 Skipping backup copy (local development)');
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ Error restoring from initial backup:', error);
            return false;
        } finally {
            database.close();
        }
    }
}

module.exports = DatabaseBackupManager;