/**
 * Progressive Card Loader for Local / Render Deployment
 * 
 * Loads cards from bundled local tcg-data/cards/en/*.json files
 * in background batches after deployment.
 */

const fs = require('fs').promises;
const path = require('path');

class ProgressiveCardLoader {
    constructor(database) {
        this.database = database;
        this.dataDir = path.resolve(__dirname, '..', 'tcg-data', 'cards', 'en');
        this.loadingState = {
            coreLoaded: false,
            extendedSetsLoaded: 0,
            totalSetsAvailable: 0,
            lastLoadAttempt: null,
            errors: []
        };
    }

    async checkAndLoadCards() {
        try {
            console.log('🔄 Checking card database status...');
            
            // Check current card count
            const currentCount = await this.database.get('SELECT COUNT(*) as count FROM cards');
            const total = parseInt(currentCount?.count || '0', 10);
            console.log(`📊 Current cards in database: ${total}`);
            
            // If database has fewer than 10,000 cards, load bundled sets
            if (total < 10000) {
                console.log('📚 Database incomplete, starting local progressive loading from tcg-data...');
                await this.loadLocalSets();
            } else {
                console.log('✅ Database appears complete, skipping progressive loading');
            }
            
        } catch (error) {
            console.error('❌ Progressive loading error:', error.message);
            this.loadingState.errors.push({
                timestamp: new Date().toISOString(),
                error: error.message
            });
        }
    }

    async loadLocalSets() {
        try {
            const files = await fs.readdir(this.dataDir);
            const jsonFiles = files.filter(f => f.endsWith('.json')).sort();
            this.loadingState.totalSetsAvailable = jsonFiles.length;
            console.log(`🚀 Found ${jsonFiles.length} local set files to check/load...`);

            for (const file of jsonFiles) {
                try {
                    const filePath = path.join(this.dataDir, file);
                    const fileContent = await fs.readFile(filePath, 'utf8');
                    const rawData = JSON.parse(fileContent);
                    const cards = Array.isArray(rawData) ? rawData : (rawData.cards || []);

                    if (!cards.length) continue;

                    const defaultSetId = file.replace(/\.json$/, '');
                    await this.loadSetCards(defaultSetId, cards);
                    this.loadingState.extendedSetsLoaded++;

                    // Small delay to keep event loop responsive
                    await new Promise(resolve => setTimeout(resolve, 50));
                } catch (error) {
                    console.error(`❌ Failed to load local set file ${file}:`, error.message);
                    this.loadingState.errors.push({
                        timestamp: new Date().toISOString(),
                        file,
                        error: error.message
                    });
                }
            }

            const finalCount = await this.database.get('SELECT COUNT(*) as count FROM cards');
            console.log(`🎉 Progressive loading complete! Final card count: ${finalCount?.count || 0}`);
        } catch (error) {
            console.error('❌ Failed to read tcg-data directory:', error.message);
        }
    }

    async loadSetCards(defaultSetId, cards) {
        const setId = cards[0]?.set?.id || defaultSetId;
        const setName = cards[0]?.set?.name || setId;

        // Check if we already have cards from this set
        const existingCountResult = await this.database.get(
            'SELECT COUNT(*) as count FROM cards WHERE set_id = ?', 
            [setId]
        );
        const existingCount = parseInt(existingCountResult?.count || '0', 10);

        if (existingCount >= Math.floor(cards.length * 0.9)) {
            return;
        }

        console.log(`📦 Loading set ${setId} (${cards.length} cards)...`);

        let newCards = 0;
        const BATCH_SIZE = 50;

        for (let i = 0; i < cards.length; i += BATCH_SIZE) {
            const batch = cards.slice(i, i + BATCH_SIZE);

            const insertPromises = batch.map(async (card) => {
                try {
                    const apiId = String(card.id || `${setId}-${card.number || Math.random()}`);
                    const nowSec = Math.floor(Date.now() / 1000);

                    const sql = `
                        INSERT INTO cards (
                            api_id, name, set_id, set_name, set_series, number, rarity,
                            supertype, subtypes, hp, types, attacks, weaknesses, resistances,
                            retreat_cost, artist, flavor_text, national_pokedex_numbers,
                            image_small, image_large, tcgplayer_url, cardmarket_url,
                            release_date, unlock_level, holo_chance, is_cached, last_updated,
                            created_at, variant_normal, variant_reverse, variant_holo,
                            variant_first_edition, variant_promo
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT (api_id) DO NOTHING
                    `;

                    const res = await this.database.run(sql, [
                        apiId,
                        card.name || 'Unknown Card',
                        card.set?.id || setId,
                        card.set?.name || setName,
                        card.set?.series || null,
                        card.number || null,
                        card.rarity || 'Common',
                        card.supertype || null,
                        card.subtypes ? JSON.stringify(card.subtypes) : null,
                        card.hp ? parseInt(card.hp) : null,
                        card.types ? JSON.stringify(card.types) : null,
                        card.attacks ? JSON.stringify(card.attacks) : null,
                        card.weaknesses ? JSON.stringify(card.weaknesses) : null,
                        card.resistances ? JSON.stringify(card.resistances) : null,
                        card.retreatCost ? JSON.stringify(card.retreatCost) : null,
                        card.artist || null,
                        card.flavorText || null,
                        card.nationalPokedexNumbers ? JSON.stringify(card.nationalPokedexNumbers) : null,
                        card.images?.small || card.image_small || null,
                        card.images?.large || card.image_large || null,
                        card.tcgplayer?.url || null,
                        card.cardmarket?.url || null,
                        card.set?.releaseDate || null,
                        this.calculateUnlockLevel(card.set?.releaseDate),
                        this.calculateHoloChance(card.rarity),
                        true, // is_cached 
                        nowSec, // last_updated
                        nowSec, // created_at  
                        card.variant_normal !== false,
                        card.variant_reverse !== false,
                        card.variant_holo !== false,
                        card.variant_first_edition === true,
                        card.variant_promo === true
                    ]);

                    return (res && res.changes > 0) ? 1 : 0;
                } catch (error) {
                    return 0;
                }
            });

            const results = await Promise.all(insertPromises);
            newCards += results.reduce((sum, r) => sum + r, 0);
        }

        if (newCards > 0) {
            console.log(`   ✅ ${setId}: +${newCards} new cards added`);
        }
    }

    calculateUnlockLevel(releaseDate) {
        if (!releaseDate) return 1;
        
        try {
            const year = new Date(releaseDate).getFullYear();
            if (year >= 2023) return 1;      // Recent sets
            if (year >= 2020) return 3;      // Sword & Shield era  
            if (year >= 2017) return 5;      // Sun & Moon era
            if (year >= 2014) return 8;      // XY era
            if (year >= 2011) return 12;     // Black & White era
            if (year >= 2007) return 15;     // Diamond & Pearl era
            if (year >= 2003) return 20;     // Ruby & Sapphire era
            return 25;                       // Classic sets
        } catch (error) {
            return 1;
        }
    }

    calculateHoloChance(rarity) {
        if (!rarity) return 0.1;
        
        const rarityLower = rarity.toLowerCase();
        if (rarityLower.includes('rare holo') || rarityLower.includes('ultra rare')) return 0.8;
        if (rarityLower.includes('rare')) return 0.3;
        if (rarityLower.includes('uncommon')) return 0.1;
        return 0.05; // Common
    }

    getLoadingStatus() {
        return {
            ...this.loadingState,
            completionPercentage: this.loadingState.totalSetsAvailable > 0 
                ? Math.round((this.loadingState.extendedSetsLoaded / this.loadingState.totalSetsAvailable) * 100)
                : 0
        };
    }
}

module.exports = ProgressiveCardLoader;
