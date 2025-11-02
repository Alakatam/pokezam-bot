const axios = require('axios');
const pokemon = require('pokemontcgsdk');

class PokemonTCGAPI {
    constructor() {
        this.apiKey = process.env.POKEMON_TCG_API_KEY;
        if (this.apiKey && this.apiKey !== 'your_api_key_here') {
            pokemon.configure({ apiKey: this.apiKey });
        }
        
        this.baseURL = 'https://api.pokemontcg.io/v2';
        this.rateLimitDelay = 1000; // 1 second between requests to respect rate limits
    }

    async fetchCardsBySet(setId, page = 1, pageSize = 250) {
        try {
            console.log(`Fetching cards from set ${setId}, page ${page}...`);
            
            const response = await pokemon.card.where({
                q: `set.id:${setId}`,
                page: page,
                pageSize: pageSize
            });

            return {
                cards: response.data || [],
                totalCount: response.totalCount || 0,
                hasMore: response.data && response.data.length === pageSize
            };
        } catch (error) {
            console.error(`Error fetching cards from set ${setId}:`, error.message);
            return { cards: [], totalCount: 0, hasMore: false };
        }
    }

    async fetchAllCardsFromSet(setId) {
        let allCards = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            const result = await this.fetchCardsBySet(setId, page);
            allCards = allCards.concat(result.cards);
            hasMore = result.hasMore;
            page++;

            // Respect rate limits
            if (hasMore) {
                await this.sleep(this.rateLimitDelay);
            }
        }

        console.log(`Fetched ${allCards.length} cards from set ${setId}`);
        return allCards;
    }

    async fetchSets() {
        try {
            console.log('Fetching available sets...');
            const response = await pokemon.set.all();
            return response.data || [];
        } catch (error) {
            console.error('Error fetching sets:', error.message);
            return [];
        }
    }

    async fetchSpecificSets(setIds) {
        const sets = [];
        for (const setId of setIds) {
            try {
                await this.sleep(this.rateLimitDelay);
                const set = await pokemon.set.find(setId);
                if (set) {
                    sets.push(set);
                    console.log(`Found set: ${set.name} (${set.id})`);
                }
            } catch (error) {
                console.error(`Error fetching set ${setId}:`, error.message);
            }
        }
        return sets;
    }

    normalizeCardData(apiCard) {
        return {
            api_id: apiCard.id,
            name: apiCard.name,
            set_id: apiCard.set.id,
            set_name: apiCard.set.name,
            set_series: apiCard.set.series || 'Unknown',
            number: apiCard.number,
            rarity: apiCard.rarity || 'Common',
            supertype: apiCard.supertype || 'Pokémon',
            subtypes: JSON.stringify(apiCard.subtypes || []),
            hp: apiCard.hp || null,
            types: JSON.stringify(apiCard.types || []),
            attacks: JSON.stringify(apiCard.attacks || []),
            weaknesses: JSON.stringify(apiCard.weaknesses || []),
            resistances: JSON.stringify(apiCard.resistances || []),
            retreat_cost: apiCard.convertedRetreatCost || 0,
            artist: apiCard.artist || null,
            flavor_text: apiCard.flavorText || null,
            national_pokedex_numbers: JSON.stringify(apiCard.nationalPokedexNumbers || []),
            image_small: apiCard.images?.small || null,
            image_large: apiCard.images?.large || null,
            tcgplayer_url: apiCard.tcgplayer?.url || null,
            cardmarket_url: apiCard.cardmarket?.url || null,
            release_date: apiCard.set.releaseDate || null,
            unlock_level: this.getUnlockLevel(apiCard.set.series, apiCard.set.name),
            holo_chance: this.getHoloChance(apiCard.rarity)
        };
    }

    getUnlockLevel(series, setName) {
        // Map sets to unlock levels based on release order
        const setMappings = {
            'Base': 1,
            'Jungle': 10,
            'Fossil': 25,
            'Team Rocket': 40,
            'Gym Heroes': 55,
            'Gym Challenge': 70,
            'Neo Genesis': 85,
            'Neo Discovery': 100
        };

        // Check for exact set name matches first
        for (const [key, level] of Object.entries(setMappings)) {
            if (setName.toLowerCase().includes(key.toLowerCase())) {
                return level;
            }
        }

        // Default based on series
        if (series && series.includes('Base')) return 1;
        if (series && series.includes('Neo')) return 85;
        
        // Default for newer sets
        return Math.min(100, Math.max(1, Math.floor(Math.random() * 100) + 1));
    }

    getHoloChance(rarity) {
        const rarityChances = {
            'Common': 0.60,
            'Uncommon': 0.25,
            'Rare': 0.10,
            'Rare Holo': 0.04,
            'Rare Holo EX': 0.01,
            'Rare Holo GX': 0.01,
            'Rare Holo V': 0.01,
            'Rare Holo VMAX': 0.005,
            'Rare Rainbow': 0.002,
            'Rare Secret': 0.001
        };

        return rarityChances[rarity] || 0.10;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Get classic sets that we want to prioritize
    getClassicSetIds() {
        return [
            'base1',      // Base Set
            'base2',      // Jungle
            'base3',      // Fossil
            'base4',      // Base Set 2
            'gym1',       // Gym Heroes
            'gym2',       // Gym Challenge
            'neo1',       // Neo Genesis
            'neo2',       // Neo Discovery
            'neo3',       // Neo Destiny
            'neo4'        // Neo Revelation
        ];
    }
}

module.exports = PokemonTCGAPI;