const fs = require('fs');
const path = require('path');
const Database = require('../database/Database.js');

/**
 * Production TCG Data Loader for Render PostgreSQL Database
 * Robust loader designed specifically for Base Set 2 and 3 production deployment
 */

/**
 * Loads all Pokémon TCG data from a specified directory with enhanced error handling.
 * @param {string} directory - The relative path to the directory (e.g., '../tcg-data/cards/en').
 * @returns {Array<Object>} An array of all items loaded from that directory.
 */
function loadDataFromDirectory(directory) {
    // Handle both relative and absolute paths more robustly
    let dataPath;
    if (path.isAbsolute(directory)) {
        dataPath = directory;
    } else {
        dataPath = path.resolve(__dirname, directory);
    }
    
    const allItems = [];

    console.log(`📁 Attempting to load from: ${dataPath}`);

    try {
        if (!fs.existsSync(dataPath)) {
            console.error(`❌ Directory does not exist: ${dataPath}`);
            
            // Try alternative paths
            const altPaths = [
                path.resolve(__dirname, '../tcg-data/cards/en'),
                path.resolve(__dirname, '../tcg-data/sets/en'),
                path.resolve(process.cwd(), 'tcg-data/cards/en'),
                path.resolve(process.cwd(), 'tcg-data/sets/en')
            ];
            
            for (const altPath of altPaths) {
                console.log(`🔍 Trying alternative path: ${altPath}`);
                if (fs.existsSync(altPath) && altPath.includes(directory.split('/').pop())) {
                    dataPath = altPath;
                    console.log(`✅ Found alternative path: ${dataPath}`);
                    break;
                }
            }
            
            if (!fs.existsSync(dataPath)) {
                console.error('❌ No valid data path found');
                return [];
            }
        }

        const files = fs.readdirSync(dataPath);
        const jsonFiles = files.filter(file => path.extname(file) === '.json');

        console.log(`📁 Found ${jsonFiles.length} JSON files in ${dataPath}...`);

        for (const file of jsonFiles) {
            const filePath = path.join(dataPath, file);

            try {
                const fileContent = fs.readFileSync(filePath, 'utf8');
                
                // Handle empty files
                if (!fileContent.trim()) {
                    console.log(`   ⚠️  Empty file: ${file}`);
                    continue;
                }
                
                const items = JSON.parse(fileContent);

                if (Array.isArray(items)) {
                    allItems.push(...items);
                    console.log(`   ✅ ${file}: ${items.length} items`);
                } else if (items && typeof items === 'object') {
                    allItems.push(items);
                    console.log(`   ✅ ${file}: 1 item`);
                } else {
                    console.log(`   ⚠️  Invalid data structure in ${file}`);
                }
            } catch (fileError) {
                console.log(`   ⚠️  Failed to parse ${file}: ${fileError.message}`);
            }
        }

    } catch (error) {
        console.error('💥 Error reading directory:', error.message);
        return [];
    }

    console.log(`📊 Total items loaded from ${directory}: ${allItems.length}`);
    return allItems;
}

class ProductionTCGLoader {
    constructor() {
        this.db = null;
        this.createdConnection = false;
        this.totalSetsAdded = 0;
        this.totalCardsAdded = 0;
        this.totalCardsUpdated = 0;
    }

    async initialize() {
        // Only initialize if database connection not provided
        if (!this.db) {
            console.log('🔧 Initializing Production Database Connection...');
            console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`📡 Database URL: ${process.env.DATABASE_URL ? 'CONFIGURED ✅' : 'LOCAL SQLITE 🏠'}`);
            
            // Show database type detection
            const dbType = process.env.DATABASE_URL ? 'PostgreSQL' : 'SQLite';
            console.log(`🗃️ Detected database type: ${dbType}`);

            try {
                this.db = new Database();
                await this.db.connect();
                await this.db.initialize();
                this.createdConnection = true;
                
                console.log('✅ Database initialized successfully');
            
                // Verify connection by checking database type
                if (this.db.dbType) {
                    console.log(`🔗 Connected to: ${this.db.dbType.toUpperCase()}`);
                }
                
            } catch (error) {
                console.error('❌ Database initialization failed:', error.message);
                throw error;
            }
        } else {
            console.log('✅ Using existing database connection');
            console.log(`🔗 Database type: ${this.db.dbType ? this.db.dbType.toUpperCase() : 'Unknown'}`);
        }
        }
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
            // Validate set data
            if (!set || !set.id) {
                console.log(`   ⚠️  Invalid set data, skipping`);
                return;
            }

            // Check if set exists using the proper method
            let existingSet;
            try {
                existingSet = await this.db.get(
                    'SELECT set_id FROM pokemon_sets WHERE set_id = ?',
                    [set.id]
                );
            } catch (queryError) {
                // If table doesn't exist, it will be created
                console.log(`   📋 Sets table check: ${queryError.message}`);
                existingSet = null;
            }

            if (!existingSet) {
                await this.db.run(`
                    INSERT INTO pokemon_sets (
                        set_id, name, series, printed_total, total, 
                        release_date, ptcgo_code, symbol_url, logo_url, 
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    set.id || 'unknown',
                    set.name || 'Unknown Set',
                    set.series || '',
                    parseInt(set.printedTotal) || 0,
                    parseInt(set.total) || 0,
                    set.releaseDate || '',
                    set.ptcgoCode || '',
                    set.images?.symbol || '',
                    set.images?.logo || '',
                    Date.now(),
                    Date.now()
                ]);

                this.totalSetsAdded++;
                console.log(`   ✅ Added set: ${set.name || 'Unknown'} (${set.id})`);
            } else {
                console.log(`   📋 Set already exists: ${set.name} (${set.id})`);
            }
        } catch (error) {
            console.error(`   ❌ Error processing set ${set?.id || 'unknown'}:`, error.message);
        }
    }

    async processCard(card) {
        try {
            // Validate card data
            if (!card || !card.id) {
                console.log(`   ⚠️  Invalid card data, skipping`);
                return;
            }

            // Check if card exists
            let existingCard;
            try {
                existingCard = await this.db.get(
                    'SELECT id FROM cards WHERE card_id = ?',
                    [card.id]
                );
            } catch (queryError) {
                // Cards table might not exist yet
                console.log(`   📋 Cards table check: ${queryError.message}`);
                existingCard = null;
            }

            if (!existingCard) {
                // Handle HP conversion more safely
                let hp = null;
                if (card.hp) {
                    const hpNum = parseInt(card.hp);
                    hp = isNaN(hpNum) ? null : hpNum;
                }

                // Handle level conversion
                let level = null;
                if (card.level) {
                    const levelNum = parseInt(card.level);
                    level = isNaN(levelNum) ? null : levelNum;
                }

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
                    level,
                    hp,
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
            } else {
                // Card already exists, could update if needed
                this.totalCardsUpdated++;
            }
        } catch (error) {
            console.error(`   ❌ Error processing card ${card?.id || 'unknown'}:`, error.message);
            console.error(`   📋 Card details:`, {
                name: card?.name,
                set: card?.set?.id,
                rarity: card?.rarity
            });
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
        // Only close database if we created the connection
        if (this.db && this.createdConnection) {
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
        
        // Create sets table if needed (handle both SQLite and PostgreSQL)
        console.log('🔧 Ensuring database tables exist...');
        
        if (loader.db.dbType === 'postgresql') {
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
        } else {
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
        }
        
        console.log('✅ Database tables ready');
        
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