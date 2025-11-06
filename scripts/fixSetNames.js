const Database = require('../database/Database.js');

/**
 * Migration script to populate set_name field for existing cards
 * This fixes the issue where cards have set_id but empty set_name
 */

// Mapping of set_id to set_name from Pokemon TCG API
const SET_ID_TO_NAME = {
    'base1': 'Base Set',
    'base2': 'Jungle',
    'base3': 'Fossil',
    'base4': 'Base Set 2',
    'base5': 'Team Rocket',
    'gym1': 'Gym Heroes',
    'gym2': 'Gym Challenge',
    'neo1': 'Neo Genesis',
    'neo2': 'Neo Discovery',
    'neo3': 'Neo Revelation',
    'neo4': 'Neo Destiny',
    'ecard1': 'Expedition Base Set',
    'ecard2': 'Aquapolis',
    'ecard3': 'Skyridge',
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
    'ex16': 'EX Power Keepers',
    'dp1': 'Diamond & Pearl',
    'dp2': 'Mysterious Treasures',
    'dp3': 'Secret Wonders',
    'dp4': 'Great Encounters',
    'dp5': 'Majestic Dawn',
    'dp6': 'Legends Awakened',
    'dp7': 'Stormfront',
    'pl1': 'Platinum',
    'pl2': 'Rising Rivals',
    'pl3': 'Supreme Victors',
    'pl4': 'Arceus',
    'hgss1': 'HeartGold & SoulSilver',
    'hgss2': 'HS—Unleashed',
    'hgss3': 'HS—Undaunted',
    'hgss4': 'HS—Triumphant',
    'col1': 'Call of Legends',
    'bw1': 'Black & White',
    'bw2': 'Emerging Powers',
    'bw3': 'Noble Victories',
    'bw4': 'Next Destinies',
    'bw5': 'Dark Explorers',
    'bw6': 'Dragons Exalted',
    'bw7': 'Boundaries Crossed',
    'bw8': 'Plasma Storm',
    'bw9': 'Plasma Freeze',
    'bw10': 'Plasma Blast',
    'bw11': 'Legendary Treasures',
    'xy1': 'XY',
    'xy2': 'Flashfire',
    'xy3': 'Furious Fists',
    'xy4': 'Phantom Forces',
    'xy5': 'Primal Clash',
    'xy6': 'Roaring Skies',
    'xy7': 'Ancient Origins',
    'xy8': 'BREAKthrough',
    'xy9': 'BREAKpoint',
    'xy10': 'Fates Collide',
    'xy11': 'Steam Siege',
    'xy12': 'Evolutions',
    'sm1': 'Sun & Moon',
    'sm2': 'Guardians Rising',
    'sm3': 'Burning Shadows',
    'sm4': 'Crimson Invasion',
    'sm5': 'Ultra Prism',
    'sm6': 'Forbidden Light',
    'sm7': 'Celestial Storm',
    'sm8': 'Lost Thunder',
    'sm9': 'Team Up',
    'sm10': 'Unbroken Bonds',
    'sm11': 'Unified Minds',
    'sm12': 'Cosmic Eclipse',
    'swsh1': 'Sword & Shield',
    'swsh2': 'Rebel Clash',
    'swsh3': 'Darkness Ablaze',
    'swsh4': 'Vivid Voltage',
    'swsh5': 'Battle Styles',
    'swsh6': 'Chilling Reign',
    'swsh7': 'Evolving Skies',
    'swsh8': 'Fusion Strike',
    'swsh9': 'Brilliant Stars',
    'swsh10': 'Astral Radiance',
    'swsh11': 'Lost Origin',
    'swsh12': 'Silver Tempest',
    'swsh12pt5': 'Crown Zenith',
    'sv1': 'Scarlet & Violet',
    'sv2': 'Paldea Evolved',
    'sv3': 'Obsidian Flames',
    'sv3pt5': '151',
    'sv4': 'Paradox Rift',
    'sv4pt5': 'Paldean Fates',
    'sv5': 'Temporal Forces',
    'sv6': 'Twilight Masquerade',
    'sv6pt5': 'Shrouded Fable',
    'sv7': 'Stellar Crown',
    'sv8': 'Surging Sparks'
};

async function fixSetNames() {
    console.log('🔧 Starting set_name migration...\n');
    
    const db = new Database();
    await db.initialize();

    try {
        // Get all cards with set_id but empty/null set_name
        const cardsToFix = await db.all(`
            SELECT card_id, set_id, set_name 
            FROM cards 
            WHERE set_id IS NOT NULL 
            AND set_id != ''
            AND (set_name IS NULL OR set_name = '')
        `);

        console.log(`📊 Found ${cardsToFix.length} cards with missing set_name\n`);

        if (cardsToFix.length === 0) {
            console.log('✅ All cards already have set_name populated!');
            await db.close();
            return;
        }

        let updatedCount = 0;
        let notFoundCount = 0;
        const notFoundSets = new Set();

        // Update each card
        for (const card of cardsToFix) {
            const setName = SET_ID_TO_NAME[card.set_id];
            
            if (setName) {
                await db.run(
                    'UPDATE cards SET set_name = ? WHERE card_id = ?',
                    [setName, card.card_id]
                );
                updatedCount++;
            } else {
                notFoundSets.add(card.set_id);
                notFoundCount++;
            }
        }

        console.log('✅ Migration complete!\n');
        console.log(`📊 Results:`);
        console.log(`   ✅ Updated: ${updatedCount} cards`);
        console.log(`   ⚠️  Skipped: ${notFoundCount} cards (set_id not in mapping)`);
        
        if (notFoundSets.size > 0) {
            console.log(`\n⚠️  Unknown set_ids:`, Array.from(notFoundSets));
        }

        // Verify the fix worked for Generation I
        const genICards = await db.all(`
            SELECT COUNT(*) as count, set_name 
            FROM cards 
            WHERE set_name IN ('Base Set', 'Jungle', 'Fossil', 'Base Set 2', 'Team Rocket')
            GROUP BY set_name
            ORDER BY set_name
        `);

        console.log(`\n🎯 Generation I cards after fix:`);
        genICards.forEach(row => {
            console.log(`   ${row.set_name}: ${row.count} cards`);
        });

        await db.close();
        console.log('\n✅ Database closed successfully');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        await db.close();
        process.exit(1);
    }
}

// Run the migration
if (require.main === module) {
    fixSetNames()
        .then(() => {
            console.log('\n🎉 Set name migration completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Migration failed:', error);
            process.exit(1);
        });
}

module.exports = fixSetNames;
