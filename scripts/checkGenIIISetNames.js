const DatabaseManager = require('../database/DatabaseManager');

async function checkGenIIISetNames() {
    try {
        const dbManager = new DatabaseManager();
        await dbManager.initialize();
        const database = dbManager.getDatabase();

        console.log('🔍 Checking actual Generation III set names in database...\n');

        // Check for set names WITHOUT EX prefix
        const withoutEX = await database.all(`
            SELECT DISTINCT set_name, COUNT(*) as count 
            FROM cards 
            WHERE set_name IN (
                'Ruby & Sapphire', 'Sandstorm', 'Dragon', 'Team Magma vs Team Aqua',
                'Hidden Legends', 'FireRed & LeafGreen', 'Team Rocket Returns', 'Deoxys',
                'Emerald', 'Unseen Forces', 'Delta Species', 'Legend Maker',
                'Holon Phantoms', 'Crystal Guardians', 'Dragon Frontiers', 'Power Keepers'
            )
            GROUP BY set_name
        `);

        console.log('📋 Cards with set names WITHOUT "EX" prefix:');
        if (withoutEX.length === 0) {
            console.log('  ❌ None found');
        } else {
            for (const row of withoutEX) {
                console.log(`  ✓ ${row.set_name}: ${row.count} cards`);
            }
        }

        // Check for set names WITH EX prefix
        const withEX = await database.all(`
            SELECT DISTINCT set_name, COUNT(*) as count 
            FROM cards 
            WHERE set_name IN (
                'EX Ruby & Sapphire', 'EX Sandstorm', 'EX Dragon', 'EX Team Magma vs Team Aqua',
                'EX Hidden Legends', 'EX FireRed & LeafGreen', 'EX Team Rocket Returns', 'EX Deoxys',
                'EX Emerald', 'EX Unseen Forces', 'EX Delta Species', 'EX Legend Maker',
                'EX Holon Phantoms', 'EX Crystal Guardians', 'EX Dragon Frontiers', 'EX Power Keepers'
            )
            GROUP BY set_name
        `);

        console.log('\n📋 Cards with set names WITH "EX" prefix:');
        if (withEX.length === 0) {
            console.log('  ❌ None found');
        } else {
            for (const row of withEX) {
                console.log(`  ✓ ${row.set_name}: ${row.count} cards`);
            }
        }

        // Check for ANY set that contains "ex" case-insensitive
        const anyEX = await database.all(`
            SELECT DISTINCT set_name, COUNT(*) as count 
            FROM cards 
            WHERE LOWER(set_name) LIKE '%ruby%' 
               OR LOWER(set_name) LIKE '%sandstorm%'
               OR LOWER(set_name) LIKE '%emerald%'
               OR LOWER(set_name) LIKE '%deoxys%'
            GROUP BY set_name
        `);

        console.log('\n📋 Any sets matching Generation III keywords:');
        if (anyEX.length === 0) {
            console.log('  ❌ None found');
        } else {
            for (const row of anyEX) {
                console.log(`  ✓ ${row.set_name}: ${row.count} cards`);
            }
        }

        // Check total cards in database
        const total = await database.get(`SELECT COUNT(*) as count FROM cards`);
        console.log(`\n📊 Total cards in database: ${total.count}`);

        await dbManager.close();
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    }
}

checkGenIIISetNames();
