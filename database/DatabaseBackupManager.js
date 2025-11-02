const Database = require('../database/Database');
const UserManager = require('../database/UserManager');
const fs = require('fs');
const path = require('path');

class DatabaseBackupManager {
    constructor() {
        this.backupUrl = process.env.DATABASE_BACKUP_URL; // Could be a cloud storage URL
        this.localBackupPath = '/tmp/pokezam_backup.json';
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
            
            const backup = {
                timestamp: new Date().toISOString(),
                version: '1.0',
                data: {
                    users,
                    userItems,
                    activeEffects
                }
            };
            
            // Save to local file
            fs.writeFileSync(this.localBackupPath, JSON.stringify(backup, null, 2));
            
            console.log(`✅ Backup created: ${users.length} users, ${userItems.length} items`);
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
            
            console.log(`✅ Restored: ${users.length} users, ${userItems.length} items, ${activeEffects.length} effects`);
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
}

module.exports = DatabaseBackupManager;