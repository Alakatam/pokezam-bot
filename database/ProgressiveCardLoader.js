/**
 * Progressive Card Loader for Render Deployment
 * 
 * Loads additional cards from GitHub after initial deployment
 * to work around Render's deployment size limitations.
 */

const axios = require('axios');

class ProgressiveCardLoader {
    constructor(database) {
        this.database = database;
        this.githubRepo = 'Alakatam/pokezam-bot'; // Your actual repo
        this.githubPath = 'database-split';
        this.githubBranch = 'main';
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
            console.log(`📊 Current cards in database: ${currentCount.count}`);
            
            // If we have less than 2000 cards, try to load more
            if (currentCount.count < 2000) {
                console.log('📚 Database appears incomplete, starting progressive loading...');
                await this.loadManifest();
                await this.loadExtendedCards();
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

    async loadManifest() {
        const manifestUrl = `https://raw.githubusercontent.com/${this.githubRepo}/${this.githubBranch}/${this.githubPath}/loading-manifest.json`;
        
        try {
            console.log('📋 Loading manifest from GitHub...');
            const response = await axios.get(manifestUrl, { timeout: 10000 });
            this.manifest = response.data;
            this.loadingState.totalSetsAvailable = this.manifest.extendedSets.length;
            console.log(`✅ Manifest loaded: ${this.manifest.totalCards} total cards available`);
        } catch (error) {
            console.error('❌ Failed to load manifest:', error.message);
            throw new Error('Cannot load card manifest from GitHub');
        }
    }

    async loadExtendedCards() {
        if (!this.manifest) {
            throw new Error('Manifest not loaded');
        }

        console.log(`🚀 Starting progressive card loading (${this.manifest.extendedSets.length} sets)...`);
        
        for (const setInfo of this.manifest.extendedSets) {
            try {
                await this.loadExtendedSet(setInfo);
                this.loadingState.extendedSetsLoaded++;
                
                // Small delay between sets to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`❌ Failed to load set ${setInfo.setId}:`, error.message);
                this.loadingState.errors.push({
                    timestamp: new Date().toISOString(),
                    setId: setInfo.setId,
                    error: error.message
                });
                
                // Continue loading other sets even if one fails
                continue;
            }
        }
        
        // Final count
        const finalCount = await this.database.get('SELECT COUNT(*) as count FROM cards');
        console.log(`🎉 Progressive loading complete! Final card count: ${finalCount.count}`);
    }

    async loadExtendedSet(setInfo) {
        const setUrl = `https://raw.githubusercontent.com/${this.githubRepo}/${this.githubBranch}/${this.githubPath}/${setInfo.file}`;
        
        try {
            console.log(`📦 Loading ${setInfo.setId} (${setInfo.count} cards)...`);
            const response = await axios.get(setUrl, { timeout: 15000 });
            const setData = response.data;
            
            // Check if we already have cards from this set
            const existingCount = await this.database.get(
                'SELECT COUNT(*) as count FROM cards WHERE set_id = ?', 
                [setInfo.setId]
            );
            
            if (existingCount.count >= setData.cardCount * 0.9) {
                console.log(`   ✅ ${setInfo.setId} already loaded (${existingCount.count} cards)`);
                return;
            }
            
            // Load cards using direct database insertion
            let newCards = 0;
            const now = Math.floor(Date.now() / 1000);
            
            for (const card of setData.cards) {
                const existing = await this.database.get('SELECT id FROM cards WHERE api_id = ?', [card.id]);
                if (!existing) {
                    try {
                        // Insert card with same structure as loadTCGData.js
                        await this.database.run(`
                            INSERT INTO cards (
                                api_id, name, set_id, set_name, set_series, number, rarity,
                                supertype, subtypes, hp, types, attacks, weaknesses, resistances,
                                retreat_cost, artist, flavor_text, national_pokedex_numbers,
                                image_small, image_large, tcgplayer_url, cardmarket_url,
                                release_date, unlock_level, holo_chance, is_cached, last_updated,
                                created_at, variant_normal, variant_reverse, variant_holo,
                                variant_first_edition, variant_promo
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ON CONFLICT (api_id) DO NOTHING
                        `, [
                            card.id,
                            card.name || 'Unknown Card',
                            card.set?.id || setInfo.setId,
                            card.set?.name || setInfo.setName,
                            card.set?.series || null,
                            card.number || null,
                            card.rarity || 'Common',
                            card.supertype || null,
                            card.subtypes ? JSON.stringify(card.subtypes) : null,
                            card.hp || null,
                            card.types ? JSON.stringify(card.types) : null,
                            card.attacks ? JSON.stringify(card.attacks) : null,
                            card.weaknesses ? JSON.stringify(card.weaknesses) : null,
                            card.resistances ? JSON.stringify(card.resistances) : null,
                            card.retreatCost ? JSON.stringify(card.retreatCost) : null,
                            card.artist || null,
                            card.flavorText || null,
                            card.nationalPokedexNumbers ? JSON.stringify(card.nationalPokedexNumbers) : null,
                            card.images?.small || null,
                            card.images?.large || null,
                            card.tcgplayer?.url || null,
                            card.cardmarket?.url || null,
                            card.set?.releaseDate || null,
                            this.calculateUnlockLevel(card.set?.releaseDate),
                            this.calculateHoloChance(card.rarity),
                            true, // is_cached 
                            Math.floor(Date.now() / 1000), // last_updated
                            Math.floor(Date.now() / 1000), // created_at  
                            card.variant_normal !== false ? true : false, // boolean conversion
                            card.variant_reverse !== false ? true : false, // boolean conversion
                            card.variant_holo !== false ? true : false, // boolean conversion
                            card.variant_first_edition === true, // boolean conversion
                            card.variant_promo === true // boolean conversion
                        ]);
                        newCards++;
                    } catch (error) {
                        console.error(`Failed to insert card ${card.name}:`, error.message);
                    }
                }
            }
            
            console.log(`   ✅ ${setInfo.setId}: +${newCards} new cards`);
            
        } catch (error) {
            throw new Error(`Failed to load ${setInfo.setId}: ${error.message}`);
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
