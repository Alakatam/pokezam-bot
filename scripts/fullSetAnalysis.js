const Database = require('../database/Database.js');

// Complete list of English Pokemon TCG main sets (as of 2024)
const ALL_TCG_SETS = {
    // Classic Era (1998-2003)
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
    
    // e-Card Era (2002-2003)
    'ecard1': 'Expedition Base Set',
    'ecard2': 'Aquapolis',
    'ecard3': 'Skyridge',
    
    // EX Era (2003-2007)
    'ex1': 'Ruby & Sapphire',
    'ex2': 'Sandstorm', 
    'ex3': 'Dragon',
    'ex4': 'Team Magma vs Team Aqua',
    'ex5': 'Hidden Legends',
    'ex6': 'FireRed & LeafGreen',
    'ex7': 'Team Rocket Returns',
    'ex8': 'Deoxys',
    'ex9': 'Emerald',
    'ex10': 'Unseen Forces',
    'ex11': 'Delta Species',
    'ex12': 'Legend Maker',
    'ex13': 'Holon Phantoms',
    'ex14': 'Crystal Guardians',
    'ex15': 'Dragon Frontiers',
    'ex16': 'Power Keepers',
    
    // Diamond & Pearl Era (2007-2009)
    'dp1': 'Diamond & Pearl',
    'dp2': 'Mysterious Treasures',
    'dp3': 'Secret Wonders', 
    'dp4': 'Great Encounters',
    'dp5': 'Majestic Dawn',
    'dp6': 'Legends Awakened',
    'dp7': 'Stormfront',
    
    // Platinum Era (2009-2010)
    'pl1': 'Platinum',
    'pl2': 'Rising Rivals',
    'pl3': 'Supreme Victors', 
    'pl4': 'Arceus',
    
    // HeartGold & SoulSilver Era (2010-2011)
    'hgss1': 'HeartGold & SoulSilver',
    'hgss2': 'Unleashed',
    'hgss3': 'Undaunted',
    'hgss4': 'Triumphant',
    'col1': 'Call of Legends',
    
    // Black & White Era (2011-2013)
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
    
    // XY Era (2013-2016)
    'xy1': 'XY Base Set',
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
    
    // Sun & Moon Era (2017-2019)
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
    
    // Sword & Shield Era (2020-2022)
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
    
    // Scarlet & Violet Era (2023-2024)
    'sv1': 'Scarlet & Violet Base Set',
    'sv2': 'Paldea Evolved',
    'sv3': 'Obsidian Flames',
    'sv4': 'Paradox Rift',
    'sv5': 'Temporal Forces',
    'sv6': 'Twilight Masquerade',
    'sv7': 'Stellar Crown',
    'sv8': 'Surging Sparks'
};

(async () => {
    const db = new Database();
    await db.connect();
    await db.initialize();
    
    const currentSets = await db.all(`
        SELECT DISTINCT set_id, set_name, COUNT(*) as card_count 
        FROM cards 
        WHERE set_id IS NOT NULL 
        GROUP BY set_id, set_name 
        ORDER BY set_id
    `);
    
    const currentSetIds = new Set(currentSets.map(s => s.set_id));
    const allSetIds = new Set(Object.keys(ALL_TCG_SETS));
    
    console.log('🃏 POKEMON TCG SET ANALYSIS');
    console.log('============================');
    console.log(`📊 Total possible main sets: ${Object.keys(ALL_TCG_SETS).length}`);
    console.log(`✅ Sets you have: ${currentSets.length}`);
    console.log(`❌ Sets missing: ${Object.keys(ALL_TCG_SETS).length - currentSets.length}`);
    
    const coverage = (currentSets.length / Object.keys(ALL_TCG_SETS).length * 100).toFixed(1);
    console.log(`📈 Coverage: ${coverage}%`);
    
    // Find missing sets
    const missingSets = [];
    for (const setId of Object.keys(ALL_TCG_SETS)) {
        if (!currentSetIds.has(setId)) {
            missingSets.push({id: setId, name: ALL_TCG_SETS[setId]});
        }
    }
    
    if (missingSets.length > 0) {
        console.log('\n❌ MISSING SETS:');
        console.log('================');
        missingSets.forEach(set => {
            console.log(`${set.id.padEnd(8)} | ${set.name}`);
        });
        
        // Group missing sets by era
        console.log('\n📊 MISSING BY ERA:');
        const eraGroups = {
            'EX Era Missing': missingSets.filter(s => s.id.startsWith('ex') && parseInt(s.id.slice(2)) > 10),
            'HGSS Era Missing': missingSets.filter(s => s.id === 'col1'),
            'Scarlet & Violet Missing': missingSets.filter(s => s.id.startsWith('sv'))
        };
        
        Object.entries(eraGroups).forEach(([era, sets]) => {
            if (sets.length > 0) {
                console.log(`\n${era}:`);
                sets.forEach(set => console.log(`  ${set.id} - ${set.name}`));
            }
        });
    } else {
        console.log('\n🎉 YOU HAVE ALL MAIN SETS!');
    }
    
    // Show total cards by era
    console.log('\n📊 YOUR COLLECTION BY ERA:');
    console.log('===========================');
    
    const eras = {
        'Classic (1998-2003)': ['base', 'gym', 'neo', 'ecard'],
        'EX Era (2003-2007)': ['ex'],
        'Diamond & Pearl (2007-2010)': ['dp', 'pl'], 
        'HGSS (2010-2011)': ['hgss', 'col'],
        'Black & White (2011-2013)': ['bw'],
        'XY Era (2013-2016)': ['xy'],
        'Sun & Moon (2017-2019)': ['sm'],
        'Sword & Shield (2020-2022)': ['swsh'],
        'Scarlet & Violet (2023-2024)': ['sv']
    };
    
    for (const [eraName, prefixes] of Object.entries(eras)) {
        const eraSets = currentSets.filter(s => prefixes.some(p => s.set_id.startsWith(p)));
        const totalCards = eraSets.reduce((sum, s) => sum + s.card_count, 0);
        console.log(`${eraName.padEnd(25)} | ${eraSets.length.toString().padStart(2)} sets | ${totalCards.toString().padStart(4)} cards`);
    }
    
    db.close();
})().catch(console.error);