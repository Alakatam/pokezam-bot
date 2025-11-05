class CardManager {
    constructor(database) {
        this.db = database;
    }

    async getAllCards() {
        return await this.db.all('SELECT * FROM cards ORDER BY set_name, name');
    }

    async getTotalCardCount() {
        const result = await this.db.get('SELECT COUNT(*) as count FROM cards');
        return result ? result.count : 0;
    }

    async getCardsBySet(setName) {
        return await this.db.all('SELECT * FROM cards WHERE set_name = ? ORDER BY name', [setName]);
    }

    async getCard(cardId) {
        return await this.db.get('SELECT * FROM cards WHERE id = ?', [cardId]);
    }

    async getRandomCard(userLevel, guildLuckBonus = 0) {
        console.log('\n🔍 ===== CARD SELECTION DEBUG =====');
        console.log('🎯 User Level:', userLevel);
        console.log('🎯 Guild Luck Bonus:', guildLuckBonus);
        
        // Get available generations based on user level
        const availableGenerations = this.getAvailableGenerationsByLevel(userLevel);
        console.log('🎯 Available Generations:', availableGenerations);
        
        // Convert generation names to set names that exist in our database
        const availableSets = [];
        for (const generation of availableGenerations) {
            const genSets = this.getSetsByGeneration(generation);
            console.log(`🎯 Sets for ${generation}:`, genSets);
            availableSets.push(...genSets);
        }
        console.log('🎯 Total Available Sets:', availableSets);
        console.log('🎯 Available Sets Count:', availableSets.length);

        if (availableSets.length === 0) {
            console.log('❌ NO AVAILABLE SETS! This is why no cards are found!');
            console.log('===== CARD SELECTION DEBUG END =====\n');
            return null;
        }

        // Prioritize cards with complete API data (proper images and numbers)
        let cards = await this.db.all(
            `SELECT * FROM cards 
             WHERE set_name IN (${availableSets.map(() => '?').join(',')})
             AND api_id IS NOT NULL
             AND (image_large IS NOT NULL OR image_small IS NOT NULL)
             ORDER BY RANDOM()`,
            availableSets
        );
        console.log('🎯 Cards with complete API data:', cards.length);

        // Fallback to cached cards if no complete ones found
        if (cards.length === 0) {
            console.log('🎯 No complete API cards, trying cached cards...');
            cards = await this.db.all(
                `SELECT * FROM cards 
                 WHERE set_name IN (${availableSets.map(() => '?').join(',')})
                 AND is_cached = TRUE 
                 ORDER BY RANDOM()`,
                availableSets
            );
            console.log('🎯 Cached cards found:', cards.length);
        }

        // Final fallback - any cards from available sets
        if (cards.length === 0) {
            console.log('🎯 No cached cards, trying ANY cards from available sets...');
            cards = await this.db.all(
                `SELECT * FROM cards 
                 WHERE set_name IN (${availableSets.map(() => '?').join(',')})
                 ORDER BY RANDOM()`,
                availableSets
            );
            console.log('🎯 Any cards found:', cards.length);
        }
        
        console.log('🎯 Final card selection result:', cards.length > 0 ? `Found ${cards.length} cards` : 'NO CARDS FOUND');
        console.log('===== CARD SELECTION DEBUG END =====\n');

        // Final fallback to any available cards from unlocked sets
        if (cards.length === 0) {
            cards = await this.db.all(
                `SELECT * FROM cards WHERE set_name IN (${availableSets.map(() => '?').join(',')})`,
                availableSets
            );
        }

        if (cards.length === 0) return null;

        // Apply advanced rarity system with realistic odds
        return this.selectCardWithRarityOdds(cards, guildLuckBonus);
    }

    getAvailableGenerationsByLevel(userLevel) {
        const generations = [];
        
        // Generation-based progression system (Pokemon Generations I-IX)
        if (userLevel >= 1) generations.push('Generation I');          // Original Series - Kanto
        if (userLevel >= 10) generations.push('Generation II');        // Neo Series - Johto
        if (userLevel >= 20) generations.push('Generation II (e-Card)'); // e-Card Series - End of Gen II
        if (userLevel >= 35) generations.push('Generation III');       // EX Series - Hoenn
        if (userLevel >= 60) generations.push('Generation IV (D&P)');  // Diamond & Pearl - Sinnoh
        if (userLevel >= 80) generations.push('Generation IV (Platinum)'); // Platinum Series
        if (userLevel >= 90) generations.push('Generation IV (HGSS)'); // HeartGold & SoulSilver
        if (userLevel >= 110) generations.push('Generation V');        // Black & White - Unova
        if (userLevel >= 130) generations.push('Generation VI');       // XY Series - Kalos
        if (userLevel >= 150) generations.push('Generation VII');      // Sun & Moon - Alola
        if (userLevel >= 170) generations.push('Generation VIII');     // Sword & Shield - Galar
        if (userLevel >= 200) generations.push('Generation IX');       // Scarlet & Violet - Paldea
        
        return generations;
    }

    getSetsByGeneration(generation) {
        const generationSets = {
            // 1. Original Series (Generation I) - Kanto Region
            'Generation I': [
                'Base Set', 'Base', 'Jungle', 'Fossil', 'Base Set 2', 
                'Team Rocket', 'Gym Heroes', 'Gym Challenge'
            ],
            
            // 2. Neo Series (Generation II) - Johto Region
            'Generation II': [
                'Neo Genesis', 'Neo Discovery', 'Neo Revelation', 'Neo Destiny'
            ],
            
            // 3. e-Card Series (End of Generation II)
            'Generation II (e-Card)': [
                'Expedition', 'Expedition Base Set', 'Aquapolis', 'Skyridge'
            ],
            
            // 4. EX Series (Generation III) - Hoenn Region
            'Generation III': [
                'Ruby & Sapphire', 'Sandstorm', 'Dragon', 'Team Magma vs Team Aqua', 
                'Hidden Legends', 'FireRed & LeafGreen', 'Team Rocket Returns', 'Deoxys', 
                'Emerald', 'Unseen Forces', 'Delta Species', 'Legend Maker', 
                'Holon Phantoms', 'Crystal Guardians', 'Dragon Frontiers', 'Power Keepers'
            ],
            
            // 5. Diamond & Pearl Series (Generation IV) - Sinnoh Region
            'Generation IV (D&P)': [
                'Diamond & Pearl', 'Mysterious Treasures', 'Secret Wonders', 
                'Great Encounters', 'Majestic Dawn', 'Legends Awakened', 'Stormfront'
            ],
            
            // 6. Platinum Series (Generation IV continuation)
            'Generation IV (Platinum)': [
                'Platinum', 'Rising Rivals', 'Supreme Victors', 'Arceus'
            ],
            
            // 7. HeartGold & SoulSilver Series (Generation IV)
            'Generation IV (HGSS)': [
                'HeartGold & SoulSilver', 'Unleashed', 'Undaunted', 'Triumphant', 'Call of Legends'
            ],
            
            // 8. Black & White Series (Generation V) - Unova Region
            'Generation V': [
                'Black & White', 'Emerging Powers', 'Noble Victories', 'Next Destinies', 
                'Dark Explorers', 'Dragons Exalted', 'Dragon Vault', 'Boundaries Crossed', 
                'Plasma Storm', 'Plasma Freeze', 'Plasma Blast', 'Legendary Treasures'
            ],
            
            // 9. XY Series (Generation VI) - Kalos Region
            'Generation VI': [
                'XY', 'Flashfire', 'Furious Fists', 'Phantom Forces', 'Primal Clash', 
                'Double Crisis', 'Roaring Skies', 'Ancient Origins', 'BREAKthrough', 
                'BREAKpoint', 'Generations', 'Fates Collide', 'Steam Siege', 'Evolutions'
            ],
            
            // 10. Sun & Moon Series (Generation VII) - Alola Region
            'Generation VII': [
                'Sun & Moon', 'Guardians Rising', 'Burning Shadows', 'Shining Legends', 
                'Crimson Invasion', 'Ultra Prism', 'Forbidden Light', 'Celestial Storm', 
                'Dragon Majesty', 'Lost Thunder', 'Team Up', 'Detective Pikachu', 
                'Unbroken Bonds', 'Unified Minds', 'Hidden Fates', 'Cosmic Eclipse'
            ],
            
            // 11. Sword & Shield Series (Generation VIII) - Galar Region
            'Generation VIII': [
                'Sword & Shield', 'Rebel Clash', 'Darkness Ablaze', 'Champions Path', 
                'Vivid Voltage', 'Shining Fates', 'Battle Styles', 'Chilling Reign', 
                'Evolving Skies', 'Celebrations', 'Fusion Strike', 'Brilliant Stars', 
                'Astral Radiance', 'Pokemon GO', 'Lost Origin', 'Silver Tempest', 'Crown Zenith'
            ],
            
            // 12. Scarlet & Violet Series (Generation IX) - Paldea Region
            'Generation IX': [
                'Scarlet & Violet', 'Paldea Evolved', 'Obsidian Flames', 'Pokemon 151', 
                'Paradox Rift', 'Paldean Fates', 'Temporal Forces', 'Twilight Masquerade', 
                'Shrouded Fable', 'Stellar Crown', 'Surging Sparks'
            ]
        };

        return generationSets[generation] || [];
    }

    selectCardWithRarityOdds(cards, guildLuckBonus = 0) {
        // Define rarity percentages (cumulative from 0 to 100) - increased rare odds by 10%
        const rarityThresholds = [
            { rarity: 'Secret Rare', threshold: 0.0154 + (guildLuckBonus * 0.01) }, // 0.014 * 1.1 = 0.0154
            { rarity: 'Ultra Rare', threshold: 0.0594 + (guildLuckBonus * 0.02) },  // 0.0154 + (0.04 * 1.1)
            { rarity: 'Holo Rare', threshold: 0.2794 + (guildLuckBonus * 0.05) },   // 0.0594 + (0.2 * 1.1)
            { rarity: 'Rare', threshold: 5.2794 + (guildLuckBonus * 0.5) },         // 0.2794 + 5
            { rarity: 'Uncommon', threshold: 25.2794 + (guildLuckBonus * 1.0) },    // 5.2794 + 20
            { rarity: 'Common', threshold: 100 }                                    // Everything else
        ];

        // Generate random number from 0 to 100
        const roll = Math.random() * 100;
        
        // Find which rarity this roll falls into
        for (const { rarity, threshold } of rarityThresholds) {
            if (roll <= threshold) {
                // Find cards of this exact rarity
                const rarityCards = cards.filter(card => card.rarity === rarity);
                
                if (rarityCards.length > 0) {
                    const randomIndex = Math.floor(Math.random() * rarityCards.length);
                    return rarityCards[randomIndex];
                }
            }
        }

        // Ultimate fallback - should never reach here
        const fallbackIndex = Math.floor(Math.random() * cards.length);
        return cards[fallbackIndex];
    }

    async addCardToUser(userId, cardId, quantity = 1, starLevel = 0) {
        // Check if user already has this card
        const existing = await this.db.get(
            'SELECT * FROM user_cards WHERE user_id = ? AND card_id = ? AND star_level = ?',
            [userId, cardId, starLevel]
        );

        if (existing) {
            // Update quantity
            return await this.db.run(
                'UPDATE user_cards SET quantity = quantity + ? WHERE id = ?',
                [quantity, existing.id]
            );
        } else {
            // Create new entry
            return await this.db.run(
                'INSERT INTO user_cards (user_id, card_id, quantity, star_level) VALUES (?, ?, ?, ?)',
                [userId, cardId, quantity, starLevel]
            );
        }
    }

    /**
     * Get detailed card information with all cached data
     */
    async getDetailedCard(cardId) {
        return await this.db.get(`
            SELECT 
                c.*,
                CASE 
                    WHEN c.image_large IS NOT NULL THEN c.image_large
                    WHEN c.image_small IS NOT NULL THEN c.image_small
                    ELSE NULL
                END as primary_image
            FROM cards c
            WHERE c.id = ?
        `, [cardId]);
    }

    /**
     * Get cards by set with caching information
     */
    async getCardsBySetCached(setName) {
        return await this.db.all(`
            SELECT *,
                CASE 
                    WHEN image_large IS NOT NULL THEN 'large'
                    WHEN image_small IS NOT NULL THEN 'small'
                    ELSE 'none'
                END as image_quality
            FROM cards 
            WHERE set_name = ? 
            ORDER BY 
                CASE 
                    WHEN rarity LIKE '%Secret%' THEN 1
                    WHEN rarity LIKE '%Ultra%' THEN 2
                    WHEN rarity LIKE '%Holo%' THEN 3
                    WHEN rarity LIKE '%Rare%' THEN 4
                    WHEN rarity LIKE '%Uncommon%' THEN 5
                    ELSE 6
                END,
                name
        `, [setName]);
    }

    /**
     * Get cache statistics for cards
     */
    async getCacheStats() {
        return await this.db.get(`
            SELECT 
                COUNT(*) as total_cards,
                SUM(CASE WHEN is_cached = 1 THEN 1 ELSE 0 END) as cached_cards,
                SUM(CASE WHEN image_large IS NOT NULL THEN 1 ELSE 0 END) as cards_with_large_images,
                SUM(CASE WHEN image_small IS NOT NULL THEN 1 ELSE 0 END) as cards_with_small_images,
                COUNT(DISTINCT set_name) as unique_sets
            FROM cards
        `);
    }

    async getUserCard(userId, cardId, starLevel = 0) {
        return await this.db.get(
            'SELECT * FROM user_cards WHERE user_id = ? AND card_id = ? AND star_level = ?',
            [userId, cardId, starLevel]
        );
    }

    async fuseCards(userId, cardId) {
        const baseCard = await this.getUserCard(userId, cardId, 0);
        const bronzeCard = await this.getUserCard(userId, cardId, 1);
        const silverCard = await this.getUserCard(userId, cardId, 2);

        // Check for bronze fusion (3 base cards -> 1 bronze)
        if (baseCard && baseCard.quantity >= 3) {
            // Remove 3 base cards
            await this.db.run(
                'UPDATE user_cards SET quantity = quantity - 3 WHERE id = ?',
                [baseCard.id]
            );
            
            // Add 1 bronze card
            await this.addCardToUser(userId, cardId, 1, 1);
            return { type: 'bronze', success: true };
        }

        // Check for silver fusion (3 bronze cards -> 1 silver)
        if (bronzeCard && bronzeCard.quantity >= 3) {
            await this.db.run(
                'UPDATE user_cards SET quantity = quantity - 3 WHERE id = ?',
                [bronzeCard.id]
            );
            
            await this.addCardToUser(userId, cardId, 1, 2);
            return { type: 'silver', success: true };
        }

        // Check for gold fusion (3 silver cards -> 1 gold)
        if (silverCard && silverCard.quantity >= 3) {
            await this.db.run(
                'UPDATE user_cards SET quantity = quantity - 3 WHERE id = ?',
                [silverCard.id]
            );
            
            await this.addCardToUser(userId, cardId, 1, 3);
            return { type: 'gold', success: true };
        }

        return { success: false, reason: 'Insufficient cards for fusion' };
    }

    async searchCards(query) {
        return await this.db.all(
            'SELECT * FROM cards WHERE name LIKE ? ORDER BY name',
            [`%${query}%`]
        );
    }

    getStarDisplay(starLevel) {
        switch (starLevel) {
            case 1: return '★';
            case 2: return '★★';
            case 3: return '★★★';
            default: return '';
        }
    }

    getCardDisplayName(card, starLevel = 0) {
        const stars = this.getStarDisplay(starLevel);
        return stars ? `${card.name} ${stars}` : card.name;
    }

    // === MASTER SET VARIANT METHODS ===

    /**
     * Determines which variant to draw based on probabilities and card availability
     * @param {Object} card - The card object with variant availability flags
     * @param {string} packType - 'basic', 'premium', 'master', or 'vintage'
     * @returns {string} - 'normal', 'reverse', 'holo', 'first_edition', or 'promo'
     */
    determineVariant(card, packType = 'basic') {
        const rand = Math.random();
        
        // Check which variants are available for this card
        const availableVariants = [];
        if (card.variant_normal) availableVariants.push('normal');
        if (card.variant_reverse) availableVariants.push('reverse');
        if (card.variant_holo) availableVariants.push('holo');
        if (card.variant_first_edition) availableVariants.push('first_edition');
        if (card.variant_promo) availableVariants.push('promo');
        
        // If only normal is available, return it
        if (availableVariants.length === 1 && availableVariants[0] === 'normal') {
            return 'normal';
        }
        
        // Determine variant based on pack type and availability
        let targetVariant;
        
        switch (packType) {
            case 'premium': // Premium Pack odds (better chances)
                if (rand < 0.05 && card.variant_first_edition) targetVariant = 'first_edition';
                else if (rand < 0.25 && card.variant_holo) targetVariant = 'holo';
                else if (rand < 0.60 && card.variant_reverse) targetVariant = 'reverse';
                else targetVariant = 'normal';
                break;
                
            case 'master': // Master Pack odds (guaranteed rare)
                if (rand < 0.15 && card.variant_first_edition) targetVariant = 'first_edition';
                else if (rand < 0.50 && card.variant_holo) targetVariant = 'holo';
                else if (rand < 0.80 && card.variant_reverse) targetVariant = 'reverse';
                else targetVariant = 'normal';
                break;
                
            case 'vintage': // Vintage Pack odds (1st Edition focus)
                if (rand < 0.40 && card.variant_first_edition) targetVariant = 'first_edition';
                else if (rand < 0.70 && card.variant_holo) targetVariant = 'holo';
                else if (rand < 0.90 && card.variant_reverse) targetVariant = 'reverse';
                else targetVariant = 'normal';
                break;
                
            default: // Basic draw odds
                if (rand < 0.005 && card.variant_first_edition) targetVariant = 'first_edition';
                else if (rand < 0.030 && card.variant_holo) targetVariant = 'holo';
                else if (rand < 0.150 && card.variant_reverse) targetVariant = 'reverse';
                else targetVariant = 'normal';
                break;
        }
        
        // If target variant is not available for this card, fall back to normal
        return availableVariants.includes(targetVariant) ? targetVariant : 'normal';
    }

    /**
     * Gets the variant display information
     * @param {string} variant - The variant type
     * @returns {Object} Display info for the variant
     */
    getVariantInfo(variant) {
        switch (variant) {
            case 'reverse':
                return {
                    displayName: 'REVERSE HOLO',
                    emoji: '🔸✨',
                    color: '#E1BEE7',
                    description: 'Reverse Holographic shine!',
                    goldMultiplier: 1.5,
                    xpBonus: 0
                };
            case 'holo':
                return {
                    displayName: 'HOLOGRAPHIC',
                    emoji: '✨🌈',
                    color: '#9B59B6',
                    description: 'Rainbow holographic brilliance!',
                    goldMultiplier: 3.0,
                    xpBonus: 1
                };
            case 'first_edition':
                return {
                    displayName: '1ST EDITION',
                    emoji: '🥇🏆',
                    color: '#FFD700',
                    description: 'First Edition - Museum Quality!',
                    goldMultiplier: 6.0,
                    xpBonus: 4
                };
            case 'promo':
                return {
                    displayName: 'PROMOTIONAL',
                    emoji: '🎁💎',
                    color: '#FF6B6B',
                    description: 'Special Promotional Card!',
                    goldMultiplier: 4.0,
                    xpBonus: 2
                };
            default: // normal
                return {
                    displayName: 'Normal',
                    emoji: '🔹',
                    color: '#3498DB',
                    description: 'Standard card quality',
                    goldMultiplier: 1.0,
                    xpBonus: 0
                };
        }
    }

    /**
     * Adds a Master Set variant card to user's collection
     * @param {string} userId - User ID
     * @param {number} cardId - Card ID
     * @param {string} variant - Variant type
     */
    async addVariantToUser(userId, cardId, variant) {
        const variantColumn = `owns_${variant}`;
        
        // Check if user already has this card entry
        let userCard = await this.db.get(
            'SELECT * FROM user_cards WHERE user_id = ? AND card_id = ?',
            [userId, cardId]
        );

        if (userCard) {
            // Update existing entry to mark this variant as owned
            await this.db.run(
                `UPDATE user_cards SET ${variantColumn} = 1, quantity = quantity + 1 WHERE id = ?`,
                [userCard.id]
            );
        } else {
            // Create new entry with this variant
            const columns = ['user_id', 'card_id', 'quantity', variantColumn];
            const values = [userId, cardId, 1, 1];
            const placeholders = columns.map(() => '?').join(',');
            
            await this.db.run(
                `INSERT INTO user_cards (${columns.join(',')}) VALUES (${placeholders})`,
                values
            );
        }
    }

    /**
     * Gets user's Master Set collection stats
     * @param {string} userId - User ID
     * @returns {Object} Collection statistics
     */
    async getUserMasterSetStats(userId) {
        const stats = await this.db.get(`
            SELECT 
                COUNT(DISTINCT card_id) as unique_cards,
                SUM(owns_normal) as normal_variants,
                SUM(owns_reverse) as reverse_variants,
                SUM(owns_holo) as holo_variants,
                SUM(owns_first_edition) as first_edition_variants,
                SUM(owns_promo) as promo_variants,
                SUM(quantity) as total_cards
            FROM user_cards 
            WHERE user_id = ?
        `, [userId]);
        
        // Calculate completion percentages
        const totalAvailable = await this.db.get(`
            SELECT 
                COUNT(*) as total_cards,
                SUM(variant_normal) as normal_available,
                SUM(variant_reverse) as reverse_available,
                SUM(variant_holo) as holo_available,
                SUM(variant_first_edition) as first_edition_available,
                SUM(variant_promo) as promo_available
            FROM cards
        `);

        return {
            owned: stats,
            available: totalAvailable,
            completion: {
                normal: totalAvailable.normal_available > 0 ? 
                    ((stats.normal_variants || 0) / totalAvailable.normal_available * 100).toFixed(1) : 0,
                reverse: totalAvailable.reverse_available > 0 ? 
                    ((stats.reverse_variants || 0) / totalAvailable.reverse_available * 100).toFixed(1) : 0,
                holo: totalAvailable.holo_available > 0 ? 
                    ((stats.holo_variants || 0) / totalAvailable.holo_available * 100).toFixed(1) : 0,
                first_edition: totalAvailable.first_edition_available > 0 ? 
                    ((stats.first_edition_variants || 0) / totalAvailable.first_edition_available * 100).toFixed(1) : 0,
                promo: totalAvailable.promo_available > 0 ? 
                    ((stats.promo_variants || 0) / totalAvailable.promo_available * 100).toFixed(1) : 0
            }
        };
    }
}

module.exports = CardManager;