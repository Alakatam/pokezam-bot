require('dotenv').config();
const Database = require('../database/Database');

async function initializeDatabase() {
    const db = new Database();
    
    try {
        await db.connect();
        await db.initialize();
        
        // Initialize default quests
        await initializeQuests(db);
        
        console.log('Database initialization completed successfully!');
    } catch (error) {
        console.error('Error initializing database:', error);
    } finally {
        db.close();
    }
}

async function initializeQuests(db) {
    const quests = [
        // Daily Quests
        {
            name: 'The Grinder',
            description: 'Draw 100 cards',
            quest_type: 'daily',
            target_value: 100,
            reward_gold: 50,
            reset_interval: 86400 // 24 hours
        },
        {
            name: 'The Socialite',
            description: 'React to 5 cards in the showcase channel',
            quest_type: 'daily',
            target_value: 5,
            reward_gold: 25,
            reset_interval: 86400
        },
        {
            name: 'The Scout',
            description: 'Complete a 4-hour scouting mission',
            quest_type: 'daily',
            target_value: 1,
            reward_gold: 25,
            reset_interval: 86400
        },
        {
            name: 'The Trader',
            description: 'Send a trade offer to another user',
            quest_type: 'daily',
            target_value: 1,
            reward_gold: 25,
            reset_interval: 86400
        },
        
        // Weekly Quests
        {
            name: 'The Devotee',
            description: 'Complete 5 daily quests this week',
            quest_type: 'weekly',
            target_value: 5,
            reward_gold: 500,
            reset_interval: 604800 // 7 days
        },
        {
            name: 'The Set Collector',
            description: 'Collect 50 unique cards from the Base Set',
            quest_type: 'weekly',
            target_value: 50,
            reward_gold: 250,
            reset_interval: 604800
        },
        {
            name: 'The Guild Member',
            description: 'Donate 1,000 Gold to your guild',
            quest_type: 'weekly',
            target_value: 1000,
            reward_gold: 100,
            reset_interval: 604800
        }
    ];

    for (const quest of quests) {
        try {
            await db.run(`
                INSERT OR IGNORE INTO quests 
                (name, description, quest_type, target_value, reward_gold, reset_interval)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [quest.name, quest.description, quest.quest_type, quest.target_value, quest.reward_gold, quest.reset_interval]);
        } catch (error) {
            console.error(`Error inserting quest ${quest.name}:`, error);
        }
    }
    
    console.log('Default quests initialized');
}

// Run if called directly
if (require.main === module) {
    initializeDatabase();
}

module.exports = { initializeDatabase };