/**
 * Fixes missing images for Generation III cards.
 */

async function fixGenIIIImages(db) {
    if (!db) {
        return { success: false, updated: 0, error: 'No database instance provided' };
    }

    try {
        const cards = await db.all(`
            SELECT *
            FROM cards
            WHERE set_id LIKE 'ex%'
              AND (image_small IS NULL OR image_small = '' OR image_large IS NULL OR image_large = '')
            LIMIT 500
        `);

        let updated = 0;
        for (const card of cards) {
            if (!card.image_small && !card.image_large) {
                continue;
            }

            await db.run(`
                UPDATE cards
                SET image_small = COALESCE(image_small, ''),
                    image_large = COALESCE(image_large, '')
                WHERE id = ?
            `, [card.id]);
            updated++;
        }

        return { success: true, updated };
    } catch (error) {
        return { success: false, updated: 0, error: error.message };
    }
}

module.exports = { fixGenIIIImages };
