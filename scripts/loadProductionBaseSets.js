/**
 * Production-safe loader for the original Base Set / Jungle / Fossil cards.
 * This is used by the main bot startup when a fresh Render database is missing base sets.
 */

const fs = require('fs');
const path = require('path');

class ProductionTCGLoader {
    constructor() {
        this.db = null;
        this.baseFiles = ['base1.json', 'base2.json', 'base3.json'];
    }

    async loadBaseSetsOnly() {
        if (!this.db) {
            throw new Error('ProductionTCGLoader requires a database instance via loader.db = database');
        }

        let totalLoaded = 0;

        for (const fileName of this.baseFiles) {
            const filePath = path.resolve(__dirname, '..', 'tcg-data', 'cards', 'en', fileName);
            if (!fs.existsSync(filePath)) {
                continue;
            }

            const content = fs.readFileSync(filePath, 'utf8');
            const cards = JSON.parse(content);

            for (const rawCard of cards) {
                try {
                    const card = this.normalizeCard(rawCard);
                    const sql = this.db.dbType === 'postgresql'
                        ? `
                            INSERT INTO cards (
                                card_id, name, supertype, subtype, level, hp,
                                rarity, artist, set_id, set_name, number,
                                flavor_text, national_pokedex_number, image_small,
                                image_large, tcgplayer_url, cardmarket_url,
                                variant_normal, variant_reverse, variant_holo,
                                variant_first_edition, variant_promo, created_at, updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `
                        : `
                            INSERT OR IGNORE INTO cards (
                                card_id, name, supertype, subtype, level, hp,
                                rarity, artist, set_id, set_name, number,
                                flavor_text, national_pokedex_number, image_small,
                                image_large, tcgplayer_url, cardmarket_url,
                                variant_normal, variant_reverse, variant_holo,
                                variant_first_edition, variant_promo, created_at, updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `;

                    await this.db.run(sql, [
                        card.card_id,
                        card.name,
                        card.supertype,
                        card.subtype,
                        card.level,
                        card.hp,
                        card.rarity,
                        card.artist,
                        card.set_id,
                        card.set_name,
                        card.number,
                        card.flavor_text,
                        card.national_pokedex_number,
                        card.image_small,
                        card.image_large,
                        card.tcgplayer_url,
                        card.cardmarket_url,
                        card.variant_normal,
                        card.variant_reverse,
                        card.variant_holo,
                        card.variant_first_edition,
                        card.variant_promo,
                        Date.now(),
                        Date.now()
                    ]);

                    totalLoaded++;
                } catch (error) {
                    // Duplicate rows or malformed card entries are non-fatal.
                }
            }
        }

        return { loaded: totalLoaded };
    }

    normalizeCard(rawCard) {
        const setId = rawCard.set?.id || rawCard.set_id || 'base1';
        const setName = rawCard.set?.name || rawCard.set_name || this.fileNameToSetName(setId);
        const cardId = String(rawCard.id || rawCard.card_id || `${setId}-${rawCard.number || Math.random()}`);

        return {
            card_id: cardId,
            name: rawCard.name || 'Unknown',
            supertype: rawCard.supertype || '',
            subtype: Array.isArray(rawCard.subtypes) ? rawCard.subtypes.join(', ') : (rawCard.subtype || ''),
            level: rawCard.level ? Number(rawCard.level) : null,
            hp: rawCard.hp ? Number(rawCard.hp) : null,
            rarity: rawCard.rarity || 'Common',
            artist: rawCard.artist || '',
            set_id: setId,
            set_name: setName,
            number: rawCard.number || '',
            flavor_text: rawCard.flavorText || '',
            national_pokedex_number: Array.isArray(rawCard.nationalPokedexNumbers) ? rawCard.nationalPokedexNumbers[0] : null,
            image_small: rawCard.images?.small || '',
            image_large: rawCard.images?.large || '',
            tcgplayer_url: rawCard.tcgplayer?.url || '',
            cardmarket_url: rawCard.cardmarket?.url || '',
            variant_normal: true,
            variant_reverse: false,
            variant_holo: false,
            variant_first_edition: false,
            variant_promo: false
        };
    }

    fileNameToSetName(setId) {
        const names = { base1: 'Base Set', base2: 'Jungle', base3: 'Fossil' };
        return names[setId] || setId;
    }
}

module.exports = { ProductionTCGLoader };
