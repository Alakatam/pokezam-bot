const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function fixQuestSchemaDirectly() {
    console.log('🔧 Direct Quest Schema Fix');
    
    // Use the same path logic as Database.js
    let dbPath;
    if (process.env.NODE_ENV === 'production' || process.env.PORT) {
        dbPath = '/tmp/pokezam.db';
    } else {
        dbPath = './pokezam.db';
    }
    
    console.log('📁 Database path:', dbPath);
    
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('❌ Database connection error:', err);
            return;
        }
        console.log('✅ Connected to SQLite database');
    });
    
    // Promisify database operations
    const run = (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    };
    
    const all = (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    };
    
    try {
        // Check current quest table schema
        const tableInfo = await all("PRAGMA table_info(quests)");
        console.log('📋 Current quest table columns:', tableInfo.map(col => col.name));
        
        const hasTargetType = tableInfo.some(col => col.name === 'target_type');
        
        if (!hasTargetType) {
            console.log('⚠️ target_type column missing, adding it now...');
            await run('ALTER TABLE quests ADD COLUMN target_type TEXT DEFAULT "card_draws"');
            console.log('✅ Successfully added target_type column');
            
            // Verify the column was added
            const newTableInfo = await all("PRAGMA table_info(quests)");
            console.log('📋 Updated quest table columns:', newTableInfo.map(col => col.name));
        } else {
            console.log('✅ target_type column already exists');
        }
        
        // Test the problematic query
        const testQuery = `
            SELECT COUNT(*) as count
            FROM quests
            WHERE target_type = ?
        `;
        
        const result = await all(testQuery, ['card_draws']);
        console.log('🧪 Test query result:', result[0].count, 'card_draws quests found');
        
        console.log('🎉 Schema fix completed successfully!');
        
    } catch (error) {
        console.error('❌ Schema fix error:', error);
    } finally {
        db.close((err) => {
            if (err) {
                console.error('❌ Error closing database:', err);
            } else {
                console.log('📪 Database connection closed');
            }
        });
    }
}

fixQuestSchemaDirectly();