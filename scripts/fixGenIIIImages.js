const fs = require('fs').promises;
const path = require('path');

/**
 * Fix Generation III cards that are missing image URLs
 * Updates existing cards with images from local JSON files
 */
async function fixGenIIIImages(database) {
    try {
        console.log('🔍 Checking Generation III cards for missing images...');

        // Check how many Gen III cards are missing images
        const missingImages = await database.get(`
            SELECT COUNT(*) as count FROM cards 
            WHERE set_name IN (
                'EX Ruby & Sapphire', 'EX Sandstorm', 'EX Dragon', 'EX Team Magma vs Team Aqua',
                'EX Hidden Legends', 'EX FireRed & LeafGreen', 'EX Team Rocket Returns', 'EX Deoxys',
                'EX Emerald', 'EX Unseen Forces', 'EX Delta Species', 'EX Legend Maker',
                'EX Holon Phantoms', 'EX Crystal Guardians', 'EX Dragon Frontiers', 'EX Power Keepers'
            )
            AND api_id IS NOT NULL
            AND image_url_large IS NULL 
            AND image_url_small IS NULL
            AND image_large IS NULL
            AND image_small IS NULL
        `);

        if (missingImages.count === 0) {
            console.log('✅ All Generation III cards already have images!');
            return { success: true, updated: 0 };
        }

        console.log(`📸 Found ${missingImages.count} Gen III cards without images`);
        console.log('🔧 Updating with images from local files...\n');

        // EX series set mappings
        const exSetMappings = {
            'ex1': 'EX Ruby & Sapphire',
            'ex2': 'EX Sandstorm',
            'ex3': 'EX Dragon',
            'ex4': 'EX Team Magma vs Team Aqua',
            'ex5': 'EX Hidden Legends',
            'ex6': 'EX FireRed & LeafGreen',
            'ex7': 'EX Team Rocket Returns',
            'ex8': 'EX Deoxys',
            'ex9': 'EX Emerald',
            'ex10': 'EX Unseen Forces',
            'ex11': 'EX Delta Species',
            'ex12': 'EX Legend Maker',
            'ex13': 'EX Holon Phantoms',
            'ex14': 'EX Crystal Guardians',
            'ex15': 'EX Dragon Frontiers',
            'ex16': 'EX Power Keepers'
        };

        let totalUpdated = 0;
        const cardsDir = path.join(__dirname, '..', 'tcg-data', 'cards', 'en');

        for (const [setId, setName] of Object.entries(exSetMappings)) {
            const filePath = path.join(cardsDir, `${setId}.json`);

            try {
                await fs.access(filePath);
                const fileContent = await fs.readFile(filePath, 'utf-8');
                const cards = JSON.parse(fileContent);

                console.log(`📋 Processing ${setName} (${cards.length} cards)...`);

                for (const card of cards) {
                    try {
                        // Check if card exists and is missing images
                        const existing = await database.get(
                            `SELECT card_id FROM cards 
                             WHERE api_id = ? 
                             AND image_url_large IS NULL 
                             AND image_url_small IS NULL
                             AND image_large IS NULL
                             AND image_small IS NULL`,
                            [card.id]
                        );

                        if (existing) {
                            // Update with image URLs
                            await database.run(`
                                UPDATE cards 
                                SET image_small = ?,
                                    image_large = ?
                                WHERE card_id = ?
                            `, [
                                card.images?.small || null,
                                card.images?.large || null,
                                existing.card_id
                            ]);

                            totalUpdated++;
                        }
                    } catch (cardError) {
                        console.error(`  ⚠️ Error updating card ${card.name}:`, cardError.message);
                    }
                }

                console.log(`  ✅ ${setName} complete`);

            } catch (fileError) {
                console.error(`⚠️ Could not load ${setId}.json:`, fileError.message);
            }
        }

        console.log(`\n✨ Generation III image fix complete!`);
        console.log(`📸 Updated: ${totalUpdated} cards with images`);

        return { success: true, updated: totalUpdated };

    } catch (error) {
        console.error('❌ Error fixing Generation III images:', error);
        return { success: false, error: error.message };
    }
}

module.exports = { fixGenIIIImages };

// Allow running standalone
if (require.main === module) {
    const Database = require('../database/Database');
    
    async function run() {
        const database = new Database();
        await database.initialize();
        await fixGenIIIImages(database);
        await database.close();
    }
    
    run().catch(console.error);
}
