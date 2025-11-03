const Database = require('../database/Database');

async function fixQuestSchema() {
    console.log('🔧 Quest Schema Fix Script');
    console.log('Checking and fixing quest table schema...');
    
    const db = new Database();
    
    try {
        await db.connect();
        console.log('✅ Connected to database');
        
        // Check if target_type column exists
        let hasTargetType = false;
        
        if (db.dbType === 'sqlite') {
            const tableInfo = await db.all("PRAGMA table_info(quests)");
            hasTargetType = tableInfo.some(col => col.name === 'target_type');
            console.log('📋 Current quest table columns:', tableInfo.map(col => col.name));
        } else {
            const result = await db.all(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'quests' AND table_schema = 'public'
            `);
            hasTargetType = result.some(col => col.column_name === 'target_type');
            console.log('📋 Current quest table columns:', result.map(col => col.column_name));
        }
        
        if (!hasTargetType) {
            console.log('⚠️ target_type column missing, adding it now...');
            const defaultValue = db.dbType === 'sqlite' ? '"card_draws"' : "'card_draws'";
            await db.run(`ALTER TABLE quests ADD COLUMN target_type TEXT DEFAULT ${defaultValue}`);
            console.log('✅ Successfully added target_type column');
        } else {
            console.log('✅ target_type column already exists');
        }
        
        // Verify the fix worked
        const questCount = await db.get('SELECT COUNT(*) as count FROM quests');
        console.log('📊 Total quests in database:', questCount.count);
        
        // Test the enhanced quest query that was failing
        const testQuery = `
            SELECT uq.*, q.name, q.target_value, q.reward_gold, q.reward_xp, q.description, q.target_type
            FROM user_quests uq
            JOIN quests q ON uq.quest_id = q.id
            WHERE uq.user_id = ? AND q.target_type = ? AND uq.completed = FALSE
        `;
        
        const testResults = await db.all(testQuery, ['411307913429254174', 'card_draws']);
        console.log('🧪 Test query result:', testResults.length, 'card draw quests found');
        
        console.log('🎉 Schema fix completed successfully!');
        
    } catch (error) {
        console.error('❌ Schema fix error:', error);
        process.exit(1);
    } finally {
        await db.close();
        console.log('📪 Database connection closed');
    }
}

if (require.main === module) {
    fixQuestSchema();
}

module.exports = fixQuestSchema;