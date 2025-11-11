const fs = require('fs').promises;
const path = require('path');

/**
 * Load Generation III (EX series) cards from local JSON files into database
 * This runs automatically on bot startup if Gen III cards are missing
 */
async function loadGenIIICards(database) {
    try {
        console.log('🔍 Checking if Generation III cards need to be loaded...');

        // Check if we already have Gen III cards
        const genIIICheck = await database.get(`
            SELECT COUNT(*) as count FROM cards 
            WHERE set_name IN (
                'EX Ruby & Sapphire', 'EX Sandstorm', 'EX Dragon', 'EX Team Magma vs Team Aqua',
                'EX Hidden Legends', 'EX FireRed & LeafGreen', 'EX Team Rocket Returns', 'EX Deoxys',
                'EX Emerald', 'EX Unseen Forces', 'EX Delta Species', 'EX Legend Maker',
                'EX Holon Phantoms', 'EX Crystal Guardians', 'EX Dragon Frontiers', 'EX Power Keepers'
            )
        `);

        if (genIIICheck && genIIICheck.count > 0) {
            console.log(`✅ Generation III cards already loaded (${genIIICheck.count} cards found)`);
            return { success: true, alreadyLoaded: true, count: genIIICheck.count };
        }

        console.log('📦 Loading Generation III (EX series) cards from local files...');

        // EX series set mappings (ex1 through ex16)
        const exSetMappings = {
            'ex1': { name: 'EX Ruby & Sapphire', series: 'EX', unlockLevel: 35 },
            'ex2': { name: 'EX Sandstorm', series: 'EX', unlockLevel: 35 },
            'ex3': { name: 'EX Dragon', series: 'EX', unlockLevel: 35 },
            'ex4': { name: 'EX Team Magma vs Team Aqua', series: 'EX', unlockLevel: 35 },
            'ex5': { name: 'EX Hidden Legends', series: 'EX', unlockLevel: 35 },
            'ex6': { name: 'EX FireRed & LeafGreen', series: 'EX', unlockLevel: 35 },
            'ex7': { name: 'EX Team Rocket Returns', series: 'EX', unlockLevel: 35 },
            'ex8': { name: 'EX Deoxys', series: 'EX', unlockLevel: 35 },
            'ex9': { name: 'EX Emerald', series: 'EX', unlockLevel: 35 },
            'ex10': { name: 'EX Unseen Forces', series: 'EX', unlockLevel: 35 },
            'ex11': { name: 'EX Delta Species', series: 'EX', unlockLevel: 35 },
            'ex12': { name: 'EX Legend Maker', series: 'EX', unlockLevel: 35 },
            'ex13': { name: 'EX Holon Phantoms', series: 'EX', unlockLevel: 35 },
            'ex14': { name: 'EX Crystal Guardians', series: 'EX', unlockLevel: 35 },
            'ex15': { name: 'EX Dragon Frontiers', series: 'EX', unlockLevel: 35 },
            'ex16': { name: 'EX Power Keepers', series: 'EX', unlockLevel: 35 }
        };

        let totalLoaded = 0;
        let totalSkipped = 0;
        const cardsDir = path.join(__dirname, '..', 'tcg-data', 'cards', 'en');

        for (const [setId, setInfo] of Object.entries(exSetMappings)) {
            const filePath = path.join(cardsDir, `${setId}.json`);

            try {
                // Check if file exists
                await fs.access(filePath);
                
                const fileContent = await fs.readFile(filePath, 'utf-8');
                const cards = JSON.parse(fileContent);

                console.log(`📋 Loading ${setInfo.name} (${cards.length} cards)...`);

                for (const card of cards) {
                    try {
                        // Check if card already exists
                        const existing = await database.get(
                            'SELECT id FROM cards WHERE api_id = ?',
                            [card.id]
                        );

                        if (existing) {
                            totalSkipped++;
                            continue;
                        }

                        // Insert card
                        await database.run(`
                            INSERT INTO cards (
                                api_id, name, set_id, set_name, set_series, number, rarity,
                                supertype, subtypes, hp, types, attacks, weaknesses, resistances,
                                retreat_cost, artist, flavor_text, national_pokedex_numbers,
                                image_small, image_large, unlock_level
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `, [
                            card.id,
                            card.name,
                            setId,
                            setInfo.name,
                            setInfo.series,
                            card.number,
                            card.rarity || 'Common',
                            card.supertype,
                            card.subtypes ? JSON.stringify(card.subtypes) : null,
                            card.hp ? parseInt(card.hp) : null,
                            card.types ? JSON.stringify(card.types) : null,
                            card.attacks ? JSON.stringify(card.attacks) : null,
                            card.weaknesses ? JSON.stringify(card.weaknesses) : null,
                            card.resistances ? JSON.stringify(card.resistances) : null,
                            card.retreatCost ? card.retreatCost.length : 0,
                            card.artist,
                            card.flavorText || null,
                            card.nationalPokedexNumbers ? JSON.stringify(card.nationalPokedexNumbers) : null,
                            card.images?.small || null,
                            card.images?.large || null,
                            setInfo.unlockLevel
                        ]);

                        totalLoaded++;
                    } catch (cardError) {
                        console.error(`  ⚠️ Error loading card ${card.name}:`, cardError.message);
                    }
                }

                console.log(`  ✅ ${setInfo.name} complete`);

            } catch (fileError) {
                if (fileError.code === 'ENOENT') {
                    console.log(`  ⚠️ File not found: ${setId}.json`);
                } else {
                    console.error(`  ❌ Error reading ${setId}.json:`, fileError.message);
                }
            }
        }

        console.log(`\n✨ Generation III loading complete!`);
        console.log(`   📥 Loaded: ${totalLoaded} cards`);
        console.log(`   ⏭️  Skipped: ${totalSkipped} cards (already exist)`);

        return { success: true, loaded: totalLoaded, skipped: totalSkipped };

    } catch (error) {
        console.error('❌ Error loading Generation III cards:', error);
        return { success: false, error: error.message };
    }
}

module.exports = loadGenIIICards;
