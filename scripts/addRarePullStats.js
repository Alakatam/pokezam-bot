const Database = require('../database/Database');

async function addRarePullStatistics() {
    console.log('🎯 Adding Rare Pull Statistics Columns...');
    
    try {
        // Initialize database connection
        const database = new Database();
        await database.connect();
        await database.initialize();
        
        console.log('✅ Database connected successfully');
        
        // Add rare pull statistics columns to users table
        const rarePullColumns = [
            'legendary_pulls INTEGER DEFAULT 0',
            'ultra_pulls INTEGER DEFAULT 0',
            'special_pulls INTEGER DEFAULT 0', 
            'holo_pulls INTEGER DEFAULT 0',
            'rare_pulls INTEGER DEFAULT 0',
            'total_rare_pulls INTEGER DEFAULT 0',
            'showcase_count INTEGER DEFAULT 0'
        ];
        
        let addedCount = 0;
        
        for (const column of rarePullColumns) {
            const columnName = column.split(' ')[0];
            
            try {
                await database.run(`ALTER TABLE users ADD COLUMN ${column}`);
                console.log(`✅ Added column: ${columnName}`);
                addedCount++;
            } catch (error) {
                if (error.message.includes('duplicate column')) {
                    console.log(`ℹ️  Column ${columnName} already exists`);
                } else {
                    console.log(`⚠️  Error adding ${columnName}:`, error.message);
                }
            }
        }
        
        console.log(`\n📊 Rare Pull Statistics Setup Complete:`);
        console.log(`   • New columns added: ${addedCount}`);
        console.log(`   • Total statistics tracked: ${rarePullColumns.length}`);
        
        console.log('\n🎮 Enhanced Notification Features:');
        console.log('   ✨ Smart reactions based on card rarity');
        console.log('   🎊 Celebration messages for ultra rare+ pulls');
        console.log('   📈 Rare pull statistics tracking');
        console.log('   🏆 Milestone achievement notifications');
        console.log('   💫 Enhanced visual effects for rare cards');
        
        await database.close();
        console.log('\n🚀 Smart Notification System Ready!');
        
    } catch (error) {
        console.error('❌ Failed to add rare pull statistics:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    addRarePullStatistics();
}

module.exports = addRarePullStatistics;