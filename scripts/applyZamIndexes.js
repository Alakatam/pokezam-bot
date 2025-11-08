#!/usr/bin/env node

/**
 * Apply critical performance indexes for /zam command optimization
 * Run this script on production to handle 20+ concurrent users
 */

const { Client } = require('pg');
require('dotenv').config();

async function applyZamIndexes() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        await client.connect();
        console.log('✅ Connected to database');

        // Check if indexes already exist
        const existingIndexes = await client.query(`
            SELECT indexname FROM pg_indexes 
            WHERE tablename = 'cards' 
            AND indexname LIKE 'idx_cards_zam%'
        `);

        if (existingIndexes.rows.length > 0) {
            console.log('⚠️  Some /zam indexes already exist:');
            existingIndexes.rows.forEach(row => console.log(`   - ${row.indexname}`));
        }

        // 1. Most critical: GROUP BY optimization
        console.log('\n🚀 Creating idx_cards_zam_group_by (GROUP BY optimization)...');
        await client.query(`
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_zam_group_by 
            ON cards(set_name, api_id) 
            WHERE api_id IS NOT NULL 
            AND (image_url_large IS NOT NULL OR image_url_small IS NOT NULL 
                 OR image_large IS NOT NULL OR image_small IS NOT NULL)
        `);
        console.log('   ✓ Created');

        // 2. OFFSET optimization
        console.log('\n⚡ Creating idx_cards_zam_offset (OFFSET optimization)...');
        await client.query(`
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_zam_offset 
            ON cards(set_name, id) 
            WHERE api_id IS NOT NULL 
            AND (image_url_large IS NOT NULL OR image_url_small IS NOT NULL 
                 OR image_large IS NOT NULL OR image_small IS NOT NULL)
        `);
        console.log('   ✓ Created');

        // 3. Cached cards fallback
        console.log('\n💾 Creating idx_cards_zam_cached (cached fallback)...');
        await client.query(`
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_zam_cached 
            ON cards(set_name, id) 
            WHERE is_cached = TRUE
        `);
        console.log('   ✓ Created');

        // 4. Rarity selection
        console.log('\n🎲 Creating idx_cards_rarity_selection (rarity optimization)...');
        await client.query(`
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_rarity_selection 
            ON cards(rarity) 
            WHERE api_id IS NOT NULL
        `);
        console.log('   ✓ Created');

        // Update statistics
        console.log('\n📊 Analyzing cards table...');
        await client.query('ANALYZE cards');
        console.log('   ✓ Statistics updated');

        // Check index sizes
        const indexSizes = await client.query(`
            SELECT 
                indexname, 
                pg_size_pretty(pg_relation_size(indexrelid)) as size
            FROM pg_indexes 
            JOIN pg_class ON pg_class.relname = indexname
            WHERE tablename = 'cards' 
            AND indexname LIKE 'idx_cards_zam%'
            ORDER BY pg_relation_size(indexrelid) DESC
        `);

        console.log('\n📦 Index sizes:');
        indexSizes.rows.forEach(row => {
            console.log(`   ${row.indexname}: ${row.size}`);
        });

        console.log('\n✅ All /zam performance indexes applied successfully!');
        console.log('🎯 Expected improvement: 2-5s → <300ms with 20+ concurrent users');

    } catch (error) {
        console.error('❌ Error applying indexes:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

// Run the script
applyZamIndexes().catch(console.error);
