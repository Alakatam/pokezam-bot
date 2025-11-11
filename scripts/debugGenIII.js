const DatabaseManager = require('../database/DatabaseManager');

async function checkGenIII() {
    const dbManager = new DatabaseManager();
    await dbManager.initialize();
    const database = dbManager.getDatabase();

    console.log('🔍 Checking Generation III cards in database...\n');

    // Check total Gen III cards
    const total = await database.get(
        `SELECT COUNT(*) as count FROM cards 
         WHERE set_name IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            'Ruby & Sapphire', 'Sandstorm', 'Dragon', 'Team Magma vs Team Aqua',
            'Hidden Legends', 'FireRed & LeafGreen', 'Team Rocket Returns', 'Deoxys',
            'Emerald', 'Unseen Forces', 'Delta Species', 'Legend Maker',
            'Holon Phantoms', 'Crystal Guardians', 'Dragon Frontiers', 'Power Keepers'
        ]
    );
    console.log(`📊 Total Gen III cards: ${total.count}`);

    // Check cards with valid images
    const withImages = await database.get(
        `SELECT COUNT(*) as count FROM cards 
         WHERE set_name IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         AND api_id IS NOT NULL
         AND (image_url_large IS NOT NULL OR image_url_small IS NOT NULL 
              OR image_large IS NOT NULL OR image_small IS NOT NULL)`,
        [
            'Ruby & Sapphire', 'Sandstorm', 'Dragon', 'Team Magma vs Team Aqua',
            'Hidden Legends', 'FireRed & LeafGreen', 'Team Rocket Returns', 'Deoxys',
            'Emerald', 'Unseen Forces', 'Delta Species', 'Legend Maker',
            'Holon Phantoms', 'Crystal Guardians', 'Dragon Frontiers', 'Power Keepers'
        ]
    );
    console.log(`🖼️ Gen III cards with valid images: ${withImages.count}`);

    // Check breakdown by set
    const bySet = await database.all(
        `SELECT set_name, 
                COUNT(*) as total,
                SUM(CASE WHEN api_id IS NOT NULL 
                    AND (image_url_large IS NOT NULL OR image_url_small IS NOT NULL 
                         OR image_large IS NOT NULL OR image_small IS NOT NULL) 
                    THEN 1 ELSE 0 END) as valid
         FROM cards 
         WHERE set_name IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         GROUP BY set_name`,
        [
            'Ruby & Sapphire', 'Sandstorm', 'Dragon', 'Team Magma vs Team Aqua',
            'Hidden Legends', 'FireRed & LeafGreen', 'Team Rocket Returns', 'Deoxys',
            'Emerald', 'Unseen Forces', 'Delta Species', 'Legend Maker',
            'Holon Phantoms', 'Crystal Guardians', 'Dragon Frontiers', 'Power Keepers'
        ]
    );

    console.log('\n📋 Breakdown by set:');
    for (const set of bySet) {
        console.log(`  ${set.set_name}: ${set.valid}/${set.total} valid cards`);
    }

    // Check a sample card
    const sample = await database.get(
        `SELECT * FROM cards 
         WHERE set_name = 'Ruby & Sapphire' 
         AND api_id IS NOT NULL
         LIMIT 1`
    );

    if (sample) {
        console.log('\n🎴 Sample card from Ruby & Sapphire:');
        console.log(`  Name: ${sample.name}`);
        console.log(`  API ID: ${sample.api_id}`);
        console.log(`  Set: ${sample.set_name}`);
        console.log(`  image_small: ${sample.image_small ? 'YES' : 'NO'}`);
        console.log(`  image_large: ${sample.image_large ? 'YES' : 'NO'}`);
        console.log(`  image_url_small: ${sample.image_url_small ? 'YES' : 'NO'}`);
        console.log(`  image_url_large: ${sample.image_url_large ? 'YES' : 'NO'}`);
    }

    await database.close();
    await dbManager.close();
}

checkGenIII().catch(console.error);
