/**
 * Force reload of base sets (base1, base2, base3) by clearing them from database
 * This will trigger the auto-loader on next bot restart
 */

const Database = require('../database/Database.js');

async function forceReloadBaseSets() {
    console.log('🔧 Forcing base sets reload...');
    
    const db = new Database();
    await db.initialize();

    try {
        // Delete base1, base2, base3 cards to trigger reload
        const result = await db.run(`
            DELETE FROM cards 
            WHERE set_id IN ('base1', 'base2', 'base3')
        `);

        console.log(`✅ Deleted ${result.changes || result.rowCount || 0} cards from base sets`);
        console.log('💡 Bot will auto-reload base sets on next restart');
        
        await db.close();
        
    } catch (error) {
        console.error('❌ Failed to clear base sets:', error.message);
        await db.close();
        process.exit(1);
    }
}

if (require.main === module) {
    forceReloadBaseSets()
        .then(() => {
            console.log('\n🎉 Base sets cleared - restart bot to reload!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Failed:', error);
            process.exit(1);
        });
}

module.exports = forceReloadBaseSets;
