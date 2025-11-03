const Database = require('../database/Database');
const QuestManager = require('../database/QuestManager');

async function migrateToEnhancedQuests() {
    console.log('🎯 Starting Enhanced Quest System Migration...');
    
    try {
        // Initialize database connection
        const database = new Database();
        
        // First connect, then initialize
        await database.connect();
        console.log('✅ Database connected successfully');
        
        await database.initialize();
        console.log('✅ Database initialized successfully');
        
        // Wait for database to be ready
        if (!database.db) {
            throw new Error('Database connection failed during initialization');
        }
        
        // Initialize quest manager
        const questManager = new QuestManager(database);
        
        // First, backup existing user quest progress
        console.log('📦 Backing up existing quest progress...');
        const existingQuests = await database.all(`
            SELECT uq.*, q.name, q.quest_type 
            FROM user_quests uq 
            JOIN quests q ON uq.quest_id = q.id
        `);
        
        console.log(`Found ${existingQuests.length} existing user quest records`);
        
        // Update database schema to include target_type column if it doesn't exist
        try {
            await database.run(`
                ALTER TABLE quests ADD COLUMN target_type TEXT DEFAULT 'card_draws'
            `);
            console.log('✅ Added target_type column to quests table');
        } catch (error) {
            if (error.message.includes('duplicate column')) {
                console.log('ℹ️  target_type column already exists');
            } else {
                console.log('⚠️  Column addition error (might be expected):', error.message);
            }
        }
        
        // Initialize enhanced quest system
        console.log('🚀 Initializing enhanced quest system...');
        await questManager.initializeEnhancedQuests();
        
        // Migrate existing user progress to compatible quests
        console.log('🔄 Migrating existing user progress...');
        
        const migrationMap = {
            'Daily Card Hunter': 'Daily Collector',
            'Daily Collection Builder': 'Lucky Drawer', 
            'Daily Dedication': 'Card Hunter',
            'Weekly Collector': 'Weekly Marathoner',
            'Weekly Explorer': 'Type Master',
            'Weekly Master': 'Rarity Expert',
            'Monthly Champion': 'Monthly Legend',
            'Monthly Legend': 'Ultimate Collector',
            'Monthly Pokemon Master': 'Monthly Legend'
        };
        
        let migratedCount = 0;
        
        for (const oldQuest of existingQuests) {
            const newQuestName = migrationMap[oldQuest.name];
            
            if (newQuestName) {
                // Find new quest ID
                const newQuest = await database.get(
                    'SELECT id FROM quests WHERE name = ? AND quest_type = ?',
                    [newQuestName, oldQuest.quest_type]
                );
                
                if (newQuest) {
                    // Check if user already has new quest
                    const existingNew = await database.get(
                        'SELECT id FROM user_quests WHERE user_id = ? AND quest_id = ?',
                        [oldQuest.user_id, newQuest.id]
                    );
                    
                    if (!existingNew) {
                        // Migrate progress to new quest
                        await database.run(`
                            INSERT INTO user_quests (user_id, quest_id, progress, completed, last_reset, completed_at)
                            VALUES (?, ?, ?, ?, ?, ?)
                        `, [
                            oldQuest.user_id,
                            newQuest.id,
                            Math.min(oldQuest.progress, 15), // Cap at reasonable value
                            oldQuest.completed,
                            oldQuest.last_reset,
                            oldQuest.completed_at
                        ]);
                        
                        migratedCount++;
                    }
                }
            }
        }
        
        console.log(`✅ Migrated ${migratedCount} user quest records to enhanced system`);
        
        // Clean up old quest records gradually
        console.log('🧹 Cleaning up outdated quest records...');
        
        const oldQuestIds = await database.all(`
            SELECT id FROM quests 
            WHERE name IN (${Object.keys(migrationMap).map(() => '?').join(',')})
        `, Object.keys(migrationMap));
        
        if (oldQuestIds.length > 0) {
            // Remove old user quest assignments
            await database.run(`
                DELETE FROM user_quests 
                WHERE quest_id IN (${oldQuestIds.map(() => '?').join(',')})
            `, oldQuestIds.map(q => q.id));
            
            // Remove old quest definitions
            await database.run(`
                DELETE FROM quests 
                WHERE id IN (${oldQuestIds.map(() => '?').join(',')})
            `, oldQuestIds.map(q => q.id));
            
            console.log(`🗑️  Cleaned up ${oldQuestIds.length} old quest definitions`);
        }
        
        // Verify migration
        const newQuestCount = await database.get('SELECT COUNT(*) as count FROM quests');
        const newUserQuestCount = await database.get('SELECT COUNT(*) as count FROM user_quests');
        
        console.log('📊 Migration Summary:');
        console.log(`   • Total Enhanced Quests: ${newQuestCount.count}`);
        console.log(`   • Active User Quests: ${newUserQuestCount.count}`);
        console.log(`   • Migrated Records: ${migratedCount}`);
        
        console.log('\n🎯 Enhanced Quest System Features:');
        console.log('   ✨ Daily Rotation: 3 diverse quests rotate daily');
        console.log('   🎲 Quest Variety: 18+ unique daily quest types');
        console.log('   🔥 Type Tracking: Pokemon type-specific challenges');
        console.log('   💎 Rarity Rewards: Special quests for rare card pulls');
        console.log('   💰 Gold Challenges: Accumulation-based objectives');
        console.log('   🏆 Progressive Rewards: Scaled XP and gold bonuses');
        
        await database.close();
        console.log('\n🚀 Enhanced Quest System Migration Complete!');
        console.log('🎮 Players will now experience diverse, rotating daily quests!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run migration if called directly
if (require.main === module) {
    migrateToEnhancedQuests();
}

module.exports = migrateToEnhancedQuests;