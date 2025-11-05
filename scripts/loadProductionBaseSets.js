const fs = require('fs');
const path = require('path');
const Database = require('../database/Database.js');

/**
 * Production TCG Data Loader for Render PostgreSQL Database
 * Specifically designed to load Base Set 2 and 3 into production environment
 */

/**
 * Loads all Pokémon TCG data from a specified directory.
 * @param {string} directory - The relative path to the directory (e.g., 'cards/en').
 * @returns {Array<Object>} An array of all items loaded from that directory.
 */
function loadDataFromDirectory(directory) {
    const dataPath = path.resolve(__dirname, directory);
    const allItems = [];

    try {
        if (!fs.existsSync(dataPath)) {
            console.error(`❌ Directory does not exist: ${dataPath}`);
            return [];
        }

        const files = fs.readdirSync(dataPath);
        const jsonFiles = files.filter(file => path.extname(file) === '.json');

        console.log(`📁 Found ${jsonFiles.length} JSON files in ${directory}...`);

        for (const file of jsonFiles) {
            const filePath = path.join(dataPath, file);

            try {
                const fileContent = fs.readFileSync(filePath, 'utf8');
                const items = JSON.parse(fileContent);

                if (Array.isArray(items)) {
                    allItems.push(...items);
                    console.log(`   ✅ ${file}: ${items.length} items`);
                } else {
                    allItems.push(items);
                    console.log(`   ✅ ${file}: 1 item`);
                }
            } catch (fileError) {
                console.log(`   ⚠️  Failed to parse ${file}: ${fileError.message}`);
            }
        }

    } catch (error) {
        console.error('💥 Error reading directory:', error.message);
        return [];
    }

    return allItems;
}

class ProductionTCGLoader {
    constructor() {
        this.db = null;
        this.totalSetsAdded = 0;
        this.totalCardsAdded = 0;
        this.totalCardsUpdated = 0;
    }

    async initialize() {
        // Force PostgreSQL detection for production
        if (!process.env.DATABASE_URL && process.env.NODE_ENV === 'production') {
            throw new Error('❌ DATABASE_URL not found in production environment!');
        }

        console.log('🔧 Initializing Production Database Connection...');
        console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`📡 Database URL: ${process.env.DATABASE_URL ? 'CONFIGURED' : 'LOCAL SQLITE'}`);

        this.db = new Database();
        await this.db.connect();
        await this.db.initialize();
        
        console.log('✅ Production database initialized successfully');
    }

    async loadBaseSetsOnly() {
        console.log('🎯 PRODUCTION BASE SET LOADING');
        console.log('================================');
        console.log('📖 Loading Base Set 1, 2, and 3 for production...');

        // Load sets first
        const setsData = loadDataFromDirectory('../tcg-data/sets/en');
        const targetSets = ['base1', 'base2', 'base3'];
        const baseSets = setsData.filter(set => targetSets.includes(set.id));
        
        console.log(`\n🎴 Found ${baseSets.length} base sets to load`);
        
        // Load cards for base sets only
        const cardsData = loadDataFromDirectory('../tcg-data/cards/en');
        const baseCards = cardsData.filter(card => targetSets.includes(card.set?.id));
        
        console.log(`🎴 Found ${baseCards.length} base set cards to load`);

        // Process sets
        console.log('\n🔄 Processing base sets...');
        for (const set of baseSets) {
            await this.processSet(set);
        }

        // Process cards
        console.log('\n🔄 Processing base set cards...');
        let cardCount = 0;
        for (const card of baseCards) {
            await this.processCard(card);
            cardCount++;
            
            if (cardCount % 50 === 0) {
                console.log(`   📊 Processed ${cardCount} cards...`);
            }
        }

        console.log('\n📊 BASE SET LOADING SUMMARY:');
        console.log(`   Sets loaded: ${this.totalSetsAdded}`);
        console.log(`   Cards loaded: ${this.totalCardsAdded}`);
        console.log(`   Cards updated: ${this.totalCardsUpdated}`);
    }

    async processSet(set) {
        try {
            // Check if set exists
            const existingSet = await this.db.get(
                'SELECT set_id FROM pokemon_sets WHERE set_id = ?',
                [set.id]
            );

            if (!existingSet) {
                await this.db.run(`
                    INSERT INTO pokemon_sets (
                        set_id, name, series, printed_total, total, 
                        release_date, ptcgo_code, symbol_url, logo_url, 
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    set.id,
                    set.name,
                    set.series || '',
                    set.printedTotal || 0,
                    set.total || 0,
                    set.releaseDate || '',
                    set.ptcgoCode || '',
                    set.images?.symbol || '',
                    set.images?.logo || '',
                    Date.now(),
                    Date.now()
                ]);

                this.totalSetsAdded++;
                console.log(`   ✅ Added set: ${set.name} (${set.id})`);
            }
        } catch (error) {
            console.error(`   ❌ Error processing set ${set.id}:`, error.message);
        }
    }

    async processCard(card) {
        try {
            // Check if card exists
            const existingCard = await this.db.get(
                'SELECT id FROM cards WHERE card_id = ?',
                [card.id]
            );

            if (!existingCard) {
                await this.db.run(`
                    INSERT INTO cards (
                        card_id, name, supertype, subtype, level, hp, 
                        rarity, artist, set_id, set_name, number, 
                        flavor_text, national_pokedex_number, image_url_small, 
                        image_url_large, tcgplayer_url, cardmarket_url, 
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    card.id,
                    card.name || 'Unknown',
                    card.supertype || '',
                    (card.subtypes || []).join(', '),
                    card.level || null,
                    card.hp ? parseInt(card.hp) : null,
                    card.rarity || 'Common',
                    card.artist || '',
                    card.set?.id || '',
                    card.set?.name || '',
                    card.number || '',
                    card.flavorText || '',
                    card.nationalPokedexNumbers?.[0] || null,
                    card.images?.small || '',
                    card.images?.large || '',
                    card.tcgplayer?.url || '',
                    card.cardmarket?.url || '',
                    Date.now(),
                    Date.now()
                ]);

                this.totalCardsAdded++;
            }
        } catch (error) {
            console.error(`   ❌ Error processing card ${card.id}:`, error.message);
        }
    }

    async verifyLoading() {
        console.log('\n🔍 VERIFYING PRODUCTION LOADING...');
        
        // Check base set counts
        const setCountQuery = `
            SELECT set_id, COUNT(*) as count 
            FROM cards 
            WHERE set_id IN ('base1', 'base2', 'base3') 
            GROUP BY set_id 
            ORDER BY set_id
        `;
        
        const setCounts = await this.db.all(setCountQuery);
        
        console.log('📊 Base Set Card Counts:');
        setCounts.forEach(set => {
            console.log(`   📦 ${set.set_id}: ${set.count} cards`);
        });

        // Sample cards from each set
        for (const setId of ['base1', 'base2', 'base3']) {
            const sampleCards = await this.db.all(
                'SELECT name, rarity FROM cards WHERE set_id = ? LIMIT 3',
                [setId]
            );
            
            console.log(`\n🎴 Sample ${setId} cards:`);
            sampleCards.forEach(card => {
                console.log(`   • ${card.name} (${card.rarity})`);
            });
        }

        console.log('\n✅ PRODUCTION LOADING VERIFICATION COMPLETE!');
    }

    async cleanup() {
        if (this.db) {
            await this.db.close();
        }
    }
}

// Main execution
async function main() {
    console.log('🚀 PRODUCTION BASE SET LOADER FOR RENDER');
    console.log('==========================================');
    
    const loader = new ProductionTCGLoader();
    
    try {
        await loader.initialize();
        
        // Create sets table if needed
        await loader.db.run(`
            CREATE TABLE IF NOT EXISTS pokemon_sets (
                id SERIAL PRIMARY KEY,
                set_id TEXT UNIQUE,
                name TEXT,
                series TEXT,
                printed_total INTEGER,
                total INTEGER,
                release_date TEXT,
                ptcgo_code TEXT,
                symbol_url TEXT,
                logo_url TEXT,
                created_at BIGINT,
                updated_at BIGINT
            )
        `);
        
        await loader.loadBaseSetsOnly();
        await loader.verifyLoading();
        
        console.log('\n🎉 SUCCESS! Base Sets 1, 2, and 3 loaded into production!');
        
    } catch (error) {
        console.error('💥 Production loading failed:', error);
        throw error;
    } finally {
        await loader.cleanup();
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('Script failed:', error);
        process.exit(1);
    });
}

module.exports = { ProductionTCGLoader };