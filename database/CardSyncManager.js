const PokemonTCGAPI = require('../utils/PokemonTCGAPI');

class CardSyncManager {
    constructor(database) {
        this.db = database;
        this.api = new PokemonTCGAPI();
        this.syncInProgress = false;
    }

    async syncCardsFromAPI(setIds = null, forceUpdate = false) {
        if (this.syncInProgress) {
            console.log('Card sync already in progress...');
            return { success: false, message: 'Sync already in progress' };
        }

        this.syncInProgress = true;
        const results = {
            setsProcessed: 0,
            cardsAdded: 0,
            cardsUpdated: 0,
            errors: []
        };

        try {
            console.log('Starting card sync from Pokemon TCG API...');

            // Use provided setIds or default to classic sets
            const targetSetIds = setIds || this.api.getClassicSetIds();
            
            for (const setId of targetSetIds) {
                try {
                    console.log(`Processing set: ${setId}`);
                    
                    // Fetch all cards from this set
                    const apiCards = await this.api.fetchAllCardsFromSet(setId);
                    
                    if (apiCards.length === 0) {
                        console.log(`No cards found for set ${setId}`);
                        continue;
                    }

                    // Process each card
                    for (const apiCard of apiCards) {
                        try {
                            const normalizedCard = this.api.normalizeCardData(apiCard);
                            const existingCard = await this.getCardByApiId(normalizedCard.api_id);

                            if (existingCard) {
                                if (forceUpdate || this.shouldUpdateCard(existingCard, normalizedCard)) {
                                    await this.updateCard(existingCard.id, normalizedCard);
                                    results.cardsUpdated++;
                                }
                            } else {
                                await this.insertCard(normalizedCard);
                                results.cardsAdded++;
                            }
                        } catch (cardError) {
                            console.error(`Error processing card ${apiCard.id}:`, cardError.message);
                            results.errors.push(`Card ${apiCard.id}: ${cardError.message}`);
                        }
                    }

                    results.setsProcessed++;
                    console.log(`Completed set ${setId}: ${apiCards.length} cards processed`);
                    
                } catch (setError) {
                    console.error(`Error processing set ${setId}:`, setError.message);
                    results.errors.push(`Set ${setId}: ${setError.message}`);
                }
            }

            console.log('Card sync completed:', results);
            return { success: true, results };

        } catch (error) {
            console.error('Card sync failed:', error);
            return { success: false, message: error.message, results };
        } finally {
            this.syncInProgress = false;
        }
    }

    async getCardByApiId(apiId) {
        return await this.db.get('SELECT * FROM cards WHERE api_id = ?', [apiId]);
    }

    async insertCard(cardData) {
        const fields = Object.keys(cardData);
        const placeholders = fields.map(() => '?').join(', ');
        const values = Object.values(cardData);

        const query = `INSERT INTO cards (${fields.join(', ')}, is_cached, last_updated) 
                      VALUES (${placeholders}, TRUE, strftime('%s', 'now'))`;
        
        return await this.db.run(query, values);
    }

    async updateCard(cardId, cardData) {
        const fields = Object.keys(cardData);
        const setClause = fields.map(field => `${field} = ?`).join(', ');
        const values = [...Object.values(cardData), cardId];

        const query = `UPDATE cards SET ${setClause}, is_cached = TRUE, last_updated = strftime('%s', 'now') 
                      WHERE id = ?`;
        
        return await this.db.run(query, values);
    }

    shouldUpdateCard(existingCard, newCard) {
        // Update if card hasn't been updated in 7 days
        const oneWeekAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
        return existingCard.last_updated < oneWeekAgo;
    }

    async getCachedSets() {
        return await this.db.all(`
            SELECT set_id, set_name, set_series, COUNT(*) as card_count,
                   MAX(last_updated) as last_sync
            FROM cards 
            WHERE is_cached = TRUE AND set_id IS NOT NULL
            GROUP BY set_id, set_name, set_series
            ORDER BY set_name
        `);
    }

    async getCardStats() {
        const stats = await this.db.get(`
            SELECT 
                COUNT(*) as total_cards,
                COUNT(CASE WHEN is_cached = TRUE THEN 1 END) as cached_cards,
                COUNT(DISTINCT set_id) as unique_sets,
                COUNT(CASE WHEN image_large IS NOT NULL THEN 1 END) as cards_with_images
            FROM cards
        `);

        const rarityStats = await this.db.all(`
            SELECT rarity, COUNT(*) as count
            FROM cards 
            WHERE is_cached = TRUE
            GROUP BY rarity
            ORDER BY count DESC
        `);

        return { ...stats, rarityBreakdown: rarityStats };
    }

    async searchCachedCards(query, limit = 25) {
        return await this.db.all(`
            SELECT api_id, name, set_name, rarity, image_small, unlock_level
            FROM cards 
            WHERE is_cached = TRUE 
            AND (name LIKE ? OR set_name LIKE ?)
            ORDER BY name
            LIMIT ?
        `, [`%${query}%`, `%${query}%`, limit]);
    }

    async getRandomCachedCard(unlockedSets, guildLuckBonus = 0) {
        // First try to get from cached cards
        const cachedCards = await this.db.all(`
            SELECT * FROM cards 
            WHERE is_cached = TRUE 
            AND set_name IN (${unlockedSets.map(() => '?').join(',')})
            ORDER BY RANDOM()
            LIMIT 1
        `, unlockedSets);

        if (cachedCards.length > 0) {
            return cachedCards[0];
        }

        // Fallback to original card system if no cached cards available
        console.log('No cached cards available, falling back to original cards');
        return null;
    }

    isSyncInProgress() {
        return this.syncInProgress;
    }
}

module.exports = CardSyncManager;