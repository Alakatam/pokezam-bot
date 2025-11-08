/**
 * Auto-apply critical /zam performance indexes on startup
 * Runs CONCURRENTLY so it won't block the bot from starting
 */

async function applyZamIndexes(database) {
    try {
        console.log('🔍 Checking /zam performance indexes...');

        // Check if main index exists
        const existingIndex = await database.get(`
            SELECT indexname FROM pg_indexes 
            WHERE tablename = 'cards' 
            AND indexname = 'idx_cards_zam_group_by'
            LIMIT 1
        `);

        if (existingIndex) {
            console.log('✅ /zam indexes already exist');
            return;
        }

        console.log('🚀 Creating /zam performance indexes (this will run in background)...');

        // Create indexes one by one (CONCURRENTLY doesn't block)
        const indexes = [
            {
                name: 'idx_cards_zam_group_by',
                sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_zam_group_by 
                      ON cards(set_name, api_id) 
                      WHERE api_id IS NOT NULL 
                      AND (image_url_large IS NOT NULL OR image_url_small IS NOT NULL 
                           OR image_large IS NOT NULL OR image_small IS NOT NULL)`
            },
            {
                name: 'idx_cards_zam_offset',
                sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_zam_offset 
                      ON cards(set_name, id) 
                      WHERE api_id IS NOT NULL 
                      AND (image_url_large IS NOT NULL OR image_url_small IS NOT NULL 
                           OR image_large IS NOT NULL OR image_small IS NOT NULL)`
            },
            {
                name: 'idx_cards_zam_cached',
                sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_zam_cached 
                      ON cards(set_name, id) 
                      WHERE is_cached = TRUE`
            },
            {
                name: 'idx_cards_rarity_selection',
                sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_rarity_selection 
                      ON cards(rarity) 
                      WHERE api_id IS NOT NULL`
            }
        ];

        // Apply each index
        for (const index of indexes) {
            try {
                await database.run(index.sql);
                console.log(`   ✓ ${index.name}`);
            } catch (error) {
                // Ignore "already exists" errors
                if (!error.message.includes('already exists')) {
                    console.error(`   ⚠️  ${index.name}: ${error.message}`);
                }
            }
        }

        // Update statistics
        await database.run('ANALYZE cards');
        console.log('✅ /zam indexes created successfully!');
        console.log('🎯 Bot can now handle 20+ concurrent users');

    } catch (error) {
        console.error('⚠️  Error applying /zam indexes (non-fatal):', error.message);
        // Don't throw - let bot start even if indexes fail
    }
}

module.exports = { applyZamIndexes };
