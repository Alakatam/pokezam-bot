const fs = require('fs');
const path = require('path');
const Database = require('../database/Database.js');

/**
 * Loads all Pokémon TCG data from a specified directory.
 * It reads every JSON file, parses it, and combines the contents.
 * @param {string} directory - The relative path to the directory (e.g., 'cards/en').
 * @returns {Array<Object>} An array of all items loaded from that directory.
 */
function loadDataFromDirectory(directory) {
    // Get the full, absolute path to the data directory
    const dataPath = path.resolve(__dirname, directory);
    const allItems = [];

    try {
        // Check if directory exists
        if (!fs.existsSync(dataPath)) {
            console.error(`❌ Directory does not exist: ${dataPath}`);
            console.error('Please run downloadTCGData.js first to download the data.');
            return [];
        }

        // Read all filenames in the directory
        const files = fs.readdirSync(dataPath);

        // Filter for .json files only
        const jsonFiles = files.filter(file => path.extname(file) === '.json');

        console.log(`📁 Found ${jsonFiles.length} JSON files in ${directory}...`);

        for (const file of jsonFiles) {
            const filePath = path.join(dataPath, file);

            try {
                // Read the content of the file
                const fileContent = fs.readFileSync(filePath, 'utf8');

                // Parse the JSON content (each file contains an array)
                const items = JSON.parse(fileContent);

                // Add the items from this file into our main array
                if (Array.isArray(items)) {
                    allItems.push(...items); // Use spread operator (...) to add each item individually
                    console.log(`   ✅ ${file}: ${items.length} items`);
                } else {
                    allItems.push(items); // For single-item JSONs (like some set files)
                    console.log(`   ✅ ${file}: 1 item`);
                }
            } catch (fileError) {
                console.log(`   ⚠️  Failed to parse ${file}: ${fileError.message}`);
            }
        }
    } catch (err) {
        console.error(`❌ Could not read directory ${dataPath}: ${err.message}`);
        console.error('Please make sure you have downloaded the TCG data first.');
        return []; // Return empty on error
    }

    return allItems;
}

class TCGDataLoader {
    constructor() {
        this.db = null;
        this.totalCardsProcessed = 0;
        this.totalCardsAdded = 0;
        this.totalCardsUpdated = 0;
        this.totalSetsProcessed = 0;
        this.totalSetsAdded = 0;
        this.totalErrors = 0;
        this.startTime = Date.now();
    }

    async initialize() {
        this.db = new Database();
        await this.db.connect();
        await this.db.initialize();
        console.log('✅ Database initialized');
    }

    async loadAllData() {
        console.log('🚀 POKEMON TCG DATA LOADER');
        console.log('===========================');
        console.log('📖 Loading data from local files...\n');

        // --- Load All English Sets ---
        console.log('📚 Loading sets...');
        const allSets = loadDataFromDirectory('../tcg-data/sets/en');

        // --- Load All English Cards ---
        console.log('\n🎴 Loading cards...');
        const allCards = loadDataFromDirectory('../tcg-data/cards/en');

        console.log('\n📊 LOADING SUMMARY:');
        console.log(`   Sets loaded: ${allSets.length}`);
        console.log(`   Cards loaded: ${allCards.length}`);

        if (allCards.length === 0 && allSets.length === 0) {
            console.log('\n❌ No data found! Please run downloadTCGData.js first.');
            return;
        }

        // Process sets first
        if (allSets.length > 0) {
            console.log('\n🔄 Processing sets...');
            await this.processSets(allSets);
        }

        // Process cards
        if (allCards.length > 0) {
            console.log('\n🔄 Processing cards...');
            await this.processCards(allCards);
        }

        await this.showFinalReport();
    }

    async processSets(sets) {
        console.log(`📚 Processing ${sets.length} sets...`);

        for (const set of sets) {
            try {
                await this.processSet(set);
                this.totalSetsProcessed++;

                if (this.totalSetsProcessed % 10 === 0) {
                    console.log(`   📊 Processed ${this.totalSetsProcessed} sets...`);
                }
            } catch (error) {
                console.log(`   ⚠️  Set error (${set.id}): ${error.message}`);
                this.totalErrors++;
            }
        }

        console.log(`✅ Sets complete: ${this.totalSetsProcessed} processed, +${this.totalSetsAdded} new`);
    }

    async processSet(tcgSet) {
        // Check if set already exists
        const existing = await this.db.get(
            'SELECT id FROM pokemon_sets WHERE set_id = ?',
            [tcgSet.id]
        );

        const now = Math.floor(Date.now() / 1000);

        if (!existing) {
            // Insert new set
            await this.db.run(`
                INSERT INTO pokemon_sets (
                    set_id, name, series, printed_total, total,
                    release_date, ptcgo_code, symbol_url, logo_url,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                tcgSet.id,
                tcgSet.name || null,
                tcgSet.series || null,
                tcgSet.printedTotal || null,
                tcgSet.total || null,
                tcgSet.releaseDate || null,
                tcgSet.ptcgoCode || null,
                tcgSet.images?.symbol || null,
                tcgSet.images?.logo || null,
                now,
                now
            ]);

            this.totalSetsAdded++;
        }
        // Note: We don't update existing sets to preserve any custom modifications
    }

    async processCards(cards) {
        console.log(`🎴 Processing ${cards.length} cards...`);

        for (const card of cards) {
            try {
                await this.processCard(card);
                this.totalCardsProcessed++;

                if (this.totalCardsProcessed % 100 === 0) {
                    console.log(`   📊 Processed ${this.totalCardsProcessed} cards (+${this.totalCardsAdded} new)...`);
                }
            } catch (error) {
                console.log(`   ⚠️  Card error (${card.id}): ${error.message}`);
                this.totalErrors++;
            }
        }

        console.log(`✅ Cards complete: ${this.totalCardsProcessed} processed, +${this.totalCardsAdded} new`);
    }

    async processCard(tcgCard) {
        // Check if card already exists
        const existing = await this.db.get(
            'SELECT id FROM cards WHERE api_id = ?',
            [tcgCard.id]
        );

        const now = Math.floor(Date.now() / 1000);

        // Extract set information from card ID if set object doesn't exist
        const setInfo = this.extractSetInfo(tcgCard);

        if (existing) {
            // Update existing card with new data
            await this.db.run(`
                UPDATE cards SET
                    name = ?, set_id = ?, set_name = ?, number = ?, rarity = ?,
                    hp = ?, types = ?, supertype = ?, subtypes = ?,
                    image_small = ?, image_large = ?, is_cached = 1, last_updated = ?
                WHERE api_id = ?
            `, [
                tcgCard.name || 'Unknown Card',
                setInfo.id,
                setInfo.name,
                tcgCard.number || null,
                tcgCard.rarity || 'Common',
                tcgCard.hp || null,
                tcgCard.types ? JSON.stringify(tcgCard.types) : null,
                tcgCard.supertype || null,
                tcgCard.subtypes ? JSON.stringify(tcgCard.subtypes) : null,
                tcgCard.images?.small || null,
                tcgCard.images?.large || null,
                now,
                tcgCard.id
            ]);

            this.totalCardsUpdated++;
        } else {
            // Insert new card
            await this.db.run(`
                INSERT INTO cards (
                    api_id, name, set_id, set_name, number, rarity,
                    hp, types, supertype, subtypes,
                    image_small, image_large, unlock_level, holo_chance,
                    is_cached, last_updated
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                tcgCard.id,
                tcgCard.name || 'Unknown Card',
                setInfo.id,
                setInfo.name,
                tcgCard.number || null,
                tcgCard.rarity || 'Common',
                tcgCard.hp || null,
                tcgCard.types ? JSON.stringify(tcgCard.types) : null,
                tcgCard.supertype || null,
                tcgCard.subtypes ? JSON.stringify(tcgCard.subtypes) : null,
                tcgCard.images?.small || null,
                tcgCard.images?.large || null,
                this.calculateUnlockLevel(setInfo.releaseDate),
                this.calculateHoloChance(tcgCard.rarity),
                1,
                now
            ]);

            this.totalCardsAdded++;
        }
    }

    extractSetInfo(tcgCard) {
        // If card has set object, use it
        if (tcgCard.set && tcgCard.set.name) {
            return {
                id: tcgCard.set.id || tcgCard.id.split('-')[0],
                name: tcgCard.set.name,
                releaseDate: tcgCard.set.releaseDate
            };
        }

        // Extract from card ID (e.g., "xy2-1" -> "xy2")
        const setId = tcgCard.id.split('-')[0];
        
        // Map common set IDs to names
        const setNameMap = {
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
            'hgss2': 'Unleashed',
            'hgss3': 'Undaunted',
            'hgss4': 'Triumphant',
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
            'swsh12': 'Silver Tempest'
        };

        return {
            id: setId,
            name: setNameMap[setId] || `Set ${setId.toUpperCase()}`,
            releaseDate: this.estimateReleaseDate(setId)
        };
    }

    estimateReleaseDate(setId) {
        // Rough release date estimation based on set ID
        if (setId.startsWith('base')) return '1999/01/09';
        if (setId.startsWith('gym')) return '2000/08/14';
        if (setId.startsWith('neo')) return '2000/12/16';
        if (setId.startsWith('ecard')) return '2002/09/15';
        if (setId.startsWith('ex')) return '2003/07/18';
        if (setId.startsWith('dp')) return '2007/05/01';
        if (setId.startsWith('pl')) return '2008/02/11';
        if (setId.startsWith('hgss')) return '2010/02/10';
        if (setId.startsWith('bw')) return '2011/04/25';
        if (setId.startsWith('xy')) return '2013/10/12';
        if (setId.startsWith('sm')) return '2017/02/03';
        if (setId.startsWith('swsh')) return '2020/02/07';
        return '2020/01/01'; // Default
    }

    calculateUnlockLevel(releaseDate) {
        if (!releaseDate) return 1;
        
        try {
            const year = parseInt(releaseDate.substring(0, 4));
            if (year <= 2000) return 1;
            if (year <= 2003) return 25;
            if (year <= 2007) return 50;
            if (year <= 2010) return 75;
            if (year <= 2013) return 100;
            if (year <= 2016) return 120;
            if (year <= 2019) return 140;
            if (year <= 2022) return 150;
            return 200;
        } catch {
            return 1;
        }
    }

    calculateHoloChance(rarity) {
        const rarityLower = (rarity || '').toLowerCase();
        if (rarityLower.includes('secret')) return 0.014;
        if (rarityLower.includes('ultra')) return 0.04;
        if (rarityLower.includes('holo')) return 0.20;
        if (rarityLower.includes('rare')) return 0.10;
        if (rarityLower.includes('uncommon')) return 0.25;
        return 0.60; // Common
    }

    async showFinalReport() {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        
        // Get database stats
        const cardStats = await this.db.get(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN api_id IS NOT NULL THEN 1 ELSE 0 END) as with_api,
                COUNT(DISTINCT set_name) as sets,
                COUNT(DISTINCT name) as unique_names
            FROM cards
        `);

        const setStats = await this.db.get('SELECT COUNT(*) as total FROM pokemon_sets');

        console.log('\n🎉 DATA LOADING COMPLETE!');
        console.log('==========================');
        console.log(`⏱️  Runtime: ${Math.floor(elapsed/60)}m ${elapsed%60}s`);
        console.log('');
        console.log('📊 PROCESSING RESULTS:');
        console.log(`   Sets processed: ${this.totalSetsProcessed}`);
        console.log(`   Sets added: ${this.totalSetsAdded}`);
        console.log(`   Cards processed: ${this.totalCardsProcessed}`);
        console.log(`   Cards added: ${this.totalCardsAdded}`);
        console.log(`   Cards updated: ${this.totalCardsUpdated}`);
        console.log(`   Errors: ${this.totalErrors}`);
        console.log('');
        console.log('🗄️  DATABASE STATUS:');
        console.log(`   Total cards: ${cardStats.total}`);
        console.log(`   With API data: ${cardStats.with_api}`);
        console.log(`   Unique names: ${cardStats.unique_names}`);
        console.log(`   Different sets: ${cardStats.sets}`);
        console.log(`   Sets in database: ${setStats.total}`);
        
        if (this.totalCardsAdded > 500) {
            console.log('\n✅ EXCELLENT! Major database expansion successful!');
            console.log('🎴 Your card variety should be dramatically improved!');
        } else if (this.totalCardsAdded > 0) {
            console.log('\n📈 SUCCESS! New cards added to your database!');
        } else {
            console.log('\n📋 All data was already in your database.');
        }
    }

    async cleanup() {
        if (this.db) {
            this.db.close();
        }
    }
}

// --- Main Script Execution ---
async function main() {
    console.log('🚀 Starting Pokemon TCG data loading from local files...\n');

    const loader = new TCGDataLoader();
    
    try {
        await loader.initialize();
        
        // Create sets table if it doesn't exist
        await loader.db.run(`
            CREATE TABLE IF NOT EXISTS pokemon_sets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                set_id TEXT UNIQUE,
                name TEXT,
                series TEXT,
                printed_total INTEGER,
                total INTEGER,
                release_date TEXT,
                ptcgo_code TEXT,
                symbol_url TEXT,
                logo_url TEXT,
                created_at INTEGER,
                updated_at INTEGER
            )
        `);
        
        await loader.loadAllData();
        
    } catch (error) {
        console.error('💥 Fatal error:', error);
    } finally {
        await loader.cleanup();
    }
}

// Run the main function
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { loadDataFromDirectory, TCGDataLoader };