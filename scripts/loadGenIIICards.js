/**
 * Loads Generation III EX-series cards into the database when missing.
 */

const fs = require('fs');
const path = require('path');

async function loadGenIIICards(db) {
    if (!db) {
        return { success: false, error: 'No database instance provided' };
    }

    try {
        const exFiles = fs.readdirSync(path.resolve(__dirname, '..', 'tcg-data', 'cards', 'en'))
            .filter((file) => /^ex\d+\.json$/i.test(file))
            .sort();

        if (!exFiles.length) {
            return { success: true, alreadyLoaded: true, count: 0 };
        }

        const countResult = await db.get(`
            SELECT COUNT(*) AS count
            FROM cards
            WHERE set_id LIKE 'ex%'
        `);

        const total = Number(countResult?.count || 0);
        if (total > 200) {
            return { success: true, alreadyLoaded: true, count: total };
        }

        let loaded = 0;
        for (const file of exFiles) {
            const fullPath = path.resolve(__dirname, '..', 'tcg-data', 'cards', 'en', file);
            const raw = fs.readFileSync(fullPath, 'utf8');
            const cards = JSON.parse(raw);

            for (const card of cards) {
                try {
                    const setId = card.set?.id || file.replace(/\.json$/i, '');
                    const setName = card.set?.name || 'EX Series';
                    const cardId = String(card.id || `${setId}-${card.number || Date.now()}`);

                    await db.run(`
                        INSERT OR IGNORE INTO cards (
                            card_id, name, supertype, subtype, level, hp,
                            rarity, artist, set_id, set_name, number,
                            flavor_text, national_pokedex_number, image_small,
                            image_large, tcgplayer_url, cardmarket_url,
                            variant_normal, variant_reverse, variant_holo,
                            variant_first_edition, variant_promo, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        cardId,
                        card.name || 'Unknown',
                        card.supertype || '',
                        (card.subtypes || []).join(', '),
                        card.level ? Number(card.level) : null,
                        card.hp ? Number(card.hp) : null,
                        card.rarity || 'Common',
                        card.artist || '',
                        setId,
                        setName,
                        card.number || '',
                        card.flavorText || '',
                        Array.isArray(card.nationalPokedexNumbers) ? card.nationalPokedexNumbers[0] : null,
                        card.images?.small || '',
                        card.images?.large || '',
                        card.tcgplayer?.url || '',
                        card.cardmarket?.url || '',
                        true,
                        false,
                        false,
                        false,
                        false,
                        Date.now(),
                        Date.now()
                    ]);
                    loaded++;
                } catch (error) {
                    // Duplicate or malformed card is non-fatal.
                }
            }
        }

        return { success: true, alreadyLoaded: false, loaded, count: total + loaded };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = loadGenIIICards;
