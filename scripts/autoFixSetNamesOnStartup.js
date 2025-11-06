const Database = require('../database/Database.js');

/**
 * Auto-run migration to fix set_name on bot startup (one-time fix)
 * This will run once and create a flag file to prevent re-running
 */

const fs = require('fs');
const path = require('path');

// Flag file to track if migration has been run
const MIGRATION_FLAG_FILE = path.join(__dirname, '..', '.set_name_migration_complete');

// Mapping of set_id to set_name
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

async function autoFixSetNames(database) {
    // Check if migration has already been completed
    if (fs.existsSync(MIGRATION_FLAG_FILE)) {
        console.log('✅ Set name migration already completed (skipping)');
        return;
    }

    console.log('🔧 Auto-running set_name migration...');
    
    try {
        // Debug: Check what's actually in the database
        const sampleCards = await database.all(`
            SELECT card_id, set_id, set_name 
            FROM cards 
            LIMIT 5
        `);
        console.log('📋 Sample cards:', sampleCards);
        
        // Get count of cards needing fix
        const cardsToFixCount = await database.get(`
            SELECT COUNT(*) as count 
            FROM cards 
            WHERE set_id IS NOT NULL 
            AND set_id != ''
            AND (set_name IS NULL OR set_name = '')
        `);

        console.log(`📊 Cards needing fix: ${cardsToFixCount.count}`);

        if (cardsToFixCount.count === 0) {
            // Check if Generation I cards exist with proper set_name
            const genICheck = await database.get(`
                SELECT COUNT(*) as count 
                FROM cards 
                WHERE set_name IN ('Base Set', 'Jungle', 'Fossil', 'Base Set 2', 'Team Rocket')
            `);
            
            console.log(`🎯 Generation I cards found: ${genICheck.count}`);
            
            if (genICheck.count > 0) {
                console.log('✅ Database already has proper set_name values!');
                // Create flag file to prevent re-running
                fs.writeFileSync(MIGRATION_FLAG_FILE, new Date().toISOString());
                return;
            } else {
                console.log('⚠️  No Generation I cards found with set_name - checking set_id...');
                const setIdCheck = await database.all(`
                    SELECT DISTINCT set_id 
                    FROM cards 
                    WHERE set_id IN ('base1', 'base2', 'base3', 'base4', 'base5')
                    ORDER BY set_id
                `);
                console.log('🔍 Generation I set_ids found:', setIdCheck.map(s => s.set_id));
                
                if (setIdCheck.length === 0) {
                    console.log('❌ No Generation I cards found at all!');
                    // Don't create flag file - something is wrong
                    return;
                }
                
                // Cards exist but set_name is not NULL/empty - it might be equal to set_id
                console.log('💡 Attempting to fix cards where set_name = set_id...');
            }
        }

        console.log(`🔄 Fixing cards...`);

        let updatedCount = 0;

        // Update each set_id to set_name
        for (const [setId, setName] of Object.entries(SET_ID_TO_NAME)) {
            try {
                // Update cards where set_name is NULL, empty, or equal to set_id
                const result = await database.run(
                    "UPDATE cards SET set_name = ? WHERE set_id = ? AND (set_name IS NULL OR set_name = '' OR set_name = set_id)",
                    [setName, setId]
                );
                // PostgreSQL returns rowCount, SQLite returns changes
                const changed = result.changes || result.rowCount || 0;
                if (changed > 0) {
                    updatedCount += changed;
                    console.log(`   ✅ ${setId} → ${setName}: ${changed} cards`);
                }
            } catch (error) {
                console.error(`   ⚠️  Error updating ${setId}:`, error.message);
            }
        }

        console.log(`✅ Migration complete! Updated ${updatedCount} cards`);

        // Verify Generation I cards
        const genICards = await database.all(`
            SELECT COUNT(*) as count, set_name 
            FROM cards 
            WHERE set_name IN ('Base Set', 'Jungle', 'Fossil', 'Base Set 2', 'Team Rocket')
            GROUP BY set_name
            ORDER BY set_name
        `);

        console.log('🎯 Generation I verification:');
        genICards.forEach(row => {
            console.log(`   ${row.set_name}: ${row.count} cards`);
        });

        // Create flag file to prevent re-running
        fs.writeFileSync(MIGRATION_FLAG_FILE, new Date().toISOString());
        console.log('✅ Migration flag created - will not run again');
        
    } catch (error) {
        console.error('❌ Auto-migration failed:', error.message);
        // Don't create flag file on failure, so it will retry next startup
    }
}

module.exports = autoFixSetNames;
