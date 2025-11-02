const pokemon = require('pokemontcgsdk');

class TCGDataManager {
    constructor(database) {
        this.db = database;
        this.cacheExpiryDays = 30; // Cache data for 30 days
        
        // Rate limiting configuration
        this.rateLimits = {
            requestsPerSecond: 2, // Conservative limit (API allows ~10/sec)
            requestsPerMinute: 100, // Conservative limit
            batchDelay: 1500, // 1.5 seconds between batches
            retryDelay: 5000, // 5 seconds initial retry delay
            maxRetries: 3, // Maximum retry attempts
            backoffMultiplier: 2 // Exponential backoff
        };
        
        // Request tracking
        this.requestHistory = [];
        this.lastRequestTime = 0;
        
        // Error tracking
        this.consecutiveErrors = 0;
        this.isThrottled = false;
        this.throttleUntil = 0;
    }

    /**
     * Populate database with real TCG cards from specific sets
     */
    async populateCardsFromTCG() {
        console.log('🎴 Starting TCG data population with rate limiting...');
        console.log(`⚡ Rate limits: ${this.rateLimits.requestsPerSecond}/sec, ${this.rateLimits.requestsPerMinute}/min`);
        
        // Start with just Base Set to test and avoid overwhelming the API
        const setMappings = [
            { setId: 'base1', setName: 'Base Set', unlockLevel: 1, series: 'Base', priority: 1 }
        ];

        let totalAdded = 0;
        let totalUpdated = 0;
        let totalErrors = 0;

        for (const setMapping of setMappings) {
            try {
                // Check if we're being throttled
                if (this.isThrottled) {
                    const waitTime = Math.max(0, this.throttleUntil - Date.now());
                    if (waitTime > 0) {
                        console.log(`⏸️  Throttled, waiting ${Math.ceil(waitTime / 1000)}s...`);
                        await this.delay(waitTime);
                        this.isThrottled = false;
                    }
                }
                
                console.log(`📦 Processing set: ${setMapping.setName}...`);
                
                const cards = await this.makeRateLimitedRequest(() => 
                    pokemon.card.where({ 
                        q: `set.id:${setMapping.setId}`,
                        pageSize: 25 // Much smaller batches to be respectful
                    })
                );

                if (!cards || !cards.data || cards.data.length === 0) {
                    console.log(`⚠️  No cards found for set ${setMapping.setId}`);
                    continue;
                }

                console.log(`📋 Found ${cards.data.length} cards in ${setMapping.setName}`);
                
                // Process cards one by one with delays
                for (let i = 0; i < cards.data.length; i++) {
                    const card = cards.data[i];
                    
                    try {
                        const result = await this.cacheCard(card, setMapping);
                        if (result.action === 'added') totalAdded++;
                        if (result.action === 'updated') totalUpdated++;
                        
                        // Progress update every 5 cards
                        if ((i + 1) % 5 === 0) {
                            console.log(`   📊 Progress: ${i + 1}/${cards.data.length} cards (${totalAdded} added, ${totalUpdated} updated)`);
                        }
                        
                        // Respectful delay between each card
                        await this.delay(500);
                        
                    } catch (error) {
                        console.error(`❌ Error caching card ${card.name}:`, error.message);
                        totalErrors++;
                        
                        // Don't let individual card errors stop the process
                        await this.delay(1000);
                    }
                }

                console.log(`✅ Completed ${setMapping.setName}: ${totalAdded} added, ${totalUpdated} updated`);
                
            } catch (error) {
                console.error(`❌ Error processing set ${setMapping.setName}:`, error.message);
                totalErrors++;
                
                // Handle rate limiting errors
                if (this.isRateLimitError(error)) {
                    console.log('⚠️  Rate limit detected, implementing backoff...');
                    await this.handleRateLimitError(error);
                }
            }
        }

        console.log(`\n🎉 TCG Population Complete!`);
        console.log(`📈 Total cards added: ${totalAdded}`);
        console.log(`🔄 Total cards updated: ${totalUpdated}`);
        console.log(`❌ Total errors: ${totalErrors}`);
        
        // Show final rate limit status
        const rateLimitStatus = this.getRateLimitStatus();
        console.log(`📊 Final API usage: ${rateLimitStatus.requestsInLastMinute}/${rateLimitStatus.maxRequestsPerMinute} requests in last minute`);
        
        return { added: totalAdded, updated: totalUpdated, errors: totalErrors };
    }

    /**
     * Cache a single card with all its data
     */
    async cacheCard(tcgCard, setMapping) {
        try {
            // Check if card already exists
            const existingCard = await this.db.get(
                'SELECT id, last_updated FROM cards WHERE api_id = ?',
                [tcgCard.id]
            );

            const cardData = this.extractCardData(tcgCard, setMapping);
            const now = Math.floor(Date.now() / 1000);

            if (existingCard) {
                // Update existing card if it's older than cache expiry
                const daysSinceUpdate = (now - existingCard.last_updated) / (24 * 60 * 60);
                
                if (daysSinceUpdate > this.cacheExpiryDays) {
                    await this.updateCard(existingCard.id, cardData);
                    return { action: 'updated', cardId: existingCard.id };
                } else {
                    return { action: 'skipped', cardId: existingCard.id };
                }
            } else {
                // Add new card
                const result = await this.insertCard(cardData);
                return { action: 'added', cardId: result.lastID };
            }

        } catch (error) {
            console.error(`Error caching card ${tcgCard.name}:`, error.message);
            return { action: 'error', error: error.message };
        }
    }

    /**
     * Extract and format card data from TCG API response
     */
    extractCardData(tcgCard, setMapping) {
        return {
            api_id: tcgCard.id,
            name: tcgCard.name,
            set_id: tcgCard.set?.id || setMapping.setId,
            set_name: tcgCard.set?.name || setMapping.setName,
            set_series: tcgCard.set?.series || setMapping.series,
            number: tcgCard.number,
            rarity: tcgCard.rarity,
            supertype: tcgCard.supertype,
            subtypes: tcgCard.subtypes ? JSON.stringify(tcgCard.subtypes) : null,
            hp: tcgCard.hp ? parseInt(tcgCard.hp) : null,
            types: tcgCard.types ? JSON.stringify(tcgCard.types) : null,
            attacks: tcgCard.attacks ? JSON.stringify(tcgCard.attacks) : null,
            weaknesses: tcgCard.weaknesses ? JSON.stringify(tcgCard.weaknesses) : null,
            resistances: tcgCard.resistances ? JSON.stringify(tcgCard.resistances) : null,
            retreat_cost: tcgCard.retreatCost ? tcgCard.retreatCost.length : 0,
            artist: tcgCard.artist,
            flavor_text: tcgCard.flavorText,
            national_pokedex_numbers: tcgCard.nationalPokedexNumbers ? JSON.stringify(tcgCard.nationalPokedexNumbers) : null,
            image_small: tcgCard.images?.small,
            image_large: tcgCard.images?.large,
            tcgplayer_url: tcgCard.tcgplayer?.url,
            cardmarket_url: tcgCard.cardmarket?.url,
            release_date: tcgCard.set?.releaseDate,
            unlock_level: setMapping.unlockLevel,
            holo_chance: this.calculateHoloChance(tcgCard.rarity),
            is_cached: true,
            last_updated: Math.floor(Date.now() / 1000)
        };
    }

    /**
     * Calculate holo chance based on rarity
     */
    calculateHoloChance(rarity) {
        const rarityLower = (rarity || '').toLowerCase();
        
        if (rarityLower.includes('secret')) return 0.014; // 1.4%
        if (rarityLower.includes('ultra')) return 0.04;   // 4%
        if (rarityLower.includes('holo')) return 0.2;     // 20%
        if (rarityLower.includes('rare')) return 0.05;    // 5%
        if (rarityLower.includes('uncommon')) return 0.20; // 20%
        return 0.70; // Common - 70%
    }

    /**
     * Insert new card into database
     */
    async insertCard(cardData) {
        const fields = Object.keys(cardData);
        const placeholders = fields.map(() => '?').join(', ');
        const values = Object.values(cardData);

        return await this.db.run(
            `INSERT INTO cards (${fields.join(', ')}) VALUES (${placeholders})`,
            values
        );
    }

    /**
     * Update existing card in database
     */
    async updateCard(cardId, cardData) {
        const fields = Object.keys(cardData);
        const setClause = fields.map(field => `${field} = ?`).join(', ');
        const values = [...Object.values(cardData), cardId];

        return await this.db.run(
            `UPDATE cards SET ${setClause} WHERE id = ?`,
            values
        );
    }

    /**
     * Get card by API ID with caching check
     */
    async getCardByApiId(apiId, forceRefresh = false) {
        const card = await this.db.get(
            'SELECT * FROM cards WHERE api_id = ?',
            [apiId]
        );

        if (!card || !card.is_cached || forceRefresh) {
            // Fetch from API and cache
            try {
                const tcgCard = await pokemon.card.find(apiId);
                if (tcgCard.data) {
                    const setMapping = { 
                        unlockLevel: card?.unlock_level || 1,
                        series: card?.set_series || 'Unknown'
                    };
                    await this.cacheCard(tcgCard.data, setMapping);
                    
                    // Return updated card
                    return await this.db.get('SELECT * FROM cards WHERE api_id = ?', [apiId]);
                }
            } catch (error) {
                console.error(`Error fetching card ${apiId} from API:`, error.message);
            }
        }

        return card;
    }

    /**
     * Refresh outdated cache entries
     */
    async refreshOutdatedCache() {
        const cutoffTime = Math.floor(Date.now() / 1000) - (this.cacheExpiryDays * 24 * 60 * 60);
        
        const outdatedCards = await this.db.all(
            'SELECT api_id FROM cards WHERE is_cached = TRUE AND last_updated < ?',
            [cutoffTime]
        );

        console.log(`🔄 Refreshing ${outdatedCards.length} outdated cards...`);

        for (const card of outdatedCards) {
            if (card.api_id) {
                await this.getCardByApiId(card.api_id, true);
                await this.delay(100); // Rate limiting
            }
        }

        return outdatedCards.length;
    }

    /**
     * Utility function for delays
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Respect API rate limits before making requests
     */
    async respectRateLimit() {
        const now = Date.now();
        
        // Clean old request history (older than 1 minute)
        this.requestHistory = this.requestHistory.filter(time => now - time < 60000);
        
        // Check if we've made too many requests recently
        if (this.requestHistory.length >= this.rateLimits.requestsPerMinute) {
            const oldestRequest = Math.min(...this.requestHistory);
            const waitTime = 60000 - (now - oldestRequest);
            if (waitTime > 0) {
                console.log(`⏳ Rate limit: waiting ${Math.ceil(waitTime / 1000)}s...`);
                await this.delay(waitTime);
            }
        }
        
        // Ensure minimum time between requests
        const timeSinceLastRequest = now - this.lastRequestTime;
        const minInterval = 1000 / this.rateLimits.requestsPerSecond;
        
        if (timeSinceLastRequest < minInterval) {
            const waitTime = minInterval - timeSinceLastRequest;
            await this.delay(waitTime);
        }
        
        // Record this request
        this.lastRequestTime = Date.now();
        this.requestHistory.push(this.lastRequestTime);
    }

    /**
     * Make a rate-limited API request with retry logic
     */
    async makeRateLimitedRequest(requestFn, retryCount = 0) {
        try {
            await this.respectRateLimit();
            
            const result = await requestFn();
            
            // Reset error tracking on success
            this.consecutiveErrors = 0;
            
            return result;
            
        } catch (error) {
            this.consecutiveErrors++;
            
            console.error(`🚫 API request failed (attempt ${retryCount + 1}):`, error.message);
            
            // Check if this is a rate limiting error
            if (this.isRateLimitError(error)) {
                return await this.handleRateLimitError(error, requestFn, retryCount);
            }
            
            // Check if this is a server error that we should retry
            if (this.isRetryableError(error) && retryCount < this.rateLimits.maxRetries) {
                const backoffDelay = this.rateLimits.retryDelay * Math.pow(this.rateLimits.backoffMultiplier, retryCount);
                console.log(`⏳ Server error, retrying in ${backoffDelay / 1000}s...`);
                await this.delay(backoffDelay);
                return this.makeRateLimitedRequest(requestFn, retryCount + 1);
            }
            
            throw error;
        }
    }

    /**
     * Check if error is related to rate limiting
     */
    isRateLimitError(error) {
        const message = error.message?.toLowerCase() || '';
        const status = error.response?.status || error.status;
        
        return status === 429 || 
               status === 503 ||
               message.includes('rate limit') ||
               message.includes('too many requests') ||
               message.includes('throttle');
    }

    /**
     * Check if error is retryable (server errors, timeouts, etc.)
     */
    isRetryableError(error) {
        const status = error.response?.status || error.status;
        const message = error.message?.toLowerCase() || '';
        
        return status >= 500 || 
               status === 408 || // Request Timeout
               message.includes('timeout') ||
               message.includes('network') ||
               message.includes('connect');
    }

    /**
     * Handle rate limiting errors with exponential backoff
     */
    async handleRateLimitError(error, requestFn = null, retryCount = 0) {
        // Mark as throttled
        this.isThrottled = true;
        
        // Calculate backoff time (start with 30 seconds for rate limits)
        const baseDelay = 30000; // 30 seconds
        const backoffDelay = baseDelay * Math.pow(this.rateLimits.backoffMultiplier, this.consecutiveErrors - 1);
        const maxDelay = 300000; // Cap at 5 minutes
        const actualDelay = Math.min(backoffDelay, maxDelay);
        
        this.throttleUntil = Date.now() + actualDelay;
        
        console.log(`🛑 Rate limited! Backing off for ${Math.ceil(actualDelay / 1000)}s...`);
        console.log(`📊 Consecutive errors: ${this.consecutiveErrors}`);
        
        await this.delay(actualDelay);
        
        // Clear throttle flag
        this.isThrottled = false;
        
        // Retry if we have a request function and haven't exceeded max retries
        if (requestFn && retryCount < this.rateLimits.maxRetries) {
            return this.makeRateLimitedRequest(requestFn, retryCount + 1);
        }
        
        throw error;
    }

    /**
     * Get current rate limit status
     */
    getRateLimitStatus() {
        const now = Date.now();
        const recentRequests = this.requestHistory.filter(time => now - time < 60000);
        
        return {
            requestsInLastMinute: recentRequests.length,
            maxRequestsPerMinute: this.rateLimits.requestsPerMinute,
            timeSinceLastRequest: now - this.lastRequestTime,
            isThrottled: this.isThrottled,
            throttledUntil: this.isThrottled ? new Date(this.throttleUntil) : null,
            consecutiveErrors: this.consecutiveErrors
        };
    }

    /**
     * Populate cards from a specific set
     */
    async populateSetCards(setId, maxCards = 25) {
        console.log(`🎴 Populating cards from set: ${setId}`);
        console.log(`📊 Max cards: ${maxCards}`);
        console.log(`⚡ Rate limits: ${this.rateLimits.requestsPerSecond}/sec, ${this.rateLimits.requestsPerMinute}/min`);
        
        // Set mappings for different sets
        const setMappings = {
            'base1': { setName: 'Base Set', unlockLevel: 1, series: 'Base' },
            'base2': { setName: 'Jungle', unlockLevel: 5, series: 'Base' },
            'base3': { setName: 'Fossil', unlockLevel: 10, series: 'Base' },
            'gym1': { setName: 'Gym Heroes', unlockLevel: 25, series: 'Gym' },
            'gym2': { setName: 'Gym Challenge', unlockLevel: 30, series: 'Gym' },
            'neo1': { setName: 'Neo Genesis', unlockLevel: 35, series: 'Neo' }
        };
        
        const setMapping = setMappings[setId];
        if (!setMapping) {
            throw new Error(`Unknown set ID: ${setId}`);
        }
        
        let totalAdded = 0;
        let totalUpdated = 0;
        let totalErrors = 0;

        try {
            // Check if we're being throttled
            if (this.isThrottled) {
                const waitTime = Math.max(0, this.throttleUntil - Date.now());
                if (waitTime > 0) {
                    console.log(`⏸️  Throttled, waiting ${Math.ceil(waitTime / 1000)}s...`);
                    await this.delay(waitTime);
                    this.isThrottled = false;
                }
            }
            
            console.log(`📦 Processing set: ${setMapping.setName}...`);
            
            const cards = await this.makeRateLimitedRequest(() => 
                pokemon.card.where({ 
                    q: `set.id:${setId}`,
                    pageSize: Math.min(maxCards, 50) // Respect maxCards but cap at 50
                })
            );

            if (!cards || !cards.data || cards.data.length === 0) {
                console.log(`⚠️  No cards found for set ${setId}`);
                return { newCards: 0, updatedCards: 0, errors: 0 };
            }

            console.log(`📋 Found ${cards.data.length} cards in ${setMapping.setName}`);
            
            // Process up to maxCards
            const cardsToProcess = cards.data.slice(0, maxCards);
            
            // Process cards one by one with delays
            for (let i = 0; i < cardsToProcess.length; i++) {
                const card = cardsToProcess[i];
                
                try {
                    const result = await this.cacheCard(card, setMapping);
                    if (result.action === 'added') totalAdded++;
                    if (result.action === 'updated') totalUpdated++;
                    
                    // Progress indicator
                    if ((i + 1) % 5 === 0 || i === cardsToProcess.length - 1) {
                        console.log(`📈 Progress: ${i + 1}/${cardsToProcess.length} cards processed`);
                    }
                    
                    // Rate limiting: wait between cards
                    if (i < cardsToProcess.length - 1) {
                        await this.respectRateLimit();
                    }
                    
                } catch (cardError) {
                    console.error(`❌ Error caching card ${card.name}:`, cardError.message);
                    totalErrors++;
                }
            }
            
            console.log(`✅ Set ${setMapping.setName} complete!`);
            console.log(`   📊 Added: ${totalAdded}, Updated: ${totalUpdated}, Errors: ${totalErrors}`);
            
        } catch (error) {
            console.error(`❌ Error processing set ${setId}:`, error.message);
            totalErrors++;
        }
        
        return {
            newCards: totalAdded,
            updatedCards: totalUpdated,
            errors: totalErrors
        };
    }

    /**
     * Get cache statistics
     */
    async getCacheStats() {
        const stats = await this.db.get(`
            SELECT 
                COUNT(*) as total_cards,
                SUM(CASE WHEN is_cached = 1 THEN 1 ELSE 0 END) as cached_cards,
                SUM(CASE WHEN image_large IS NOT NULL THEN 1 ELSE 0 END) as cards_with_images,
                COUNT(DISTINCT set_name) as unique_sets,
                AVG(last_updated) as avg_last_update
            FROM cards
        `);

        return {
            totalCards: stats.total_cards,
            cachedCards: stats.cached_cards,
            cardsWithImages: stats.cards_with_images,
            uniqueSets: stats.unique_sets,
            cachePercentage: stats.total_cards > 0 ? (stats.cached_cards / stats.total_cards * 100).toFixed(1) : 0,
            imagePercentage: stats.total_cards > 0 ? (stats.cards_with_images / stats.total_cards * 100).toFixed(1) : 0
        };
    }
}

module.exports = TCGDataManager;