/**
 * Check what rarities exist in the database
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function checkRarities() {
    console.log('🔍 Checking rarities in database...\n');
    
    const { Client } = require('pg');
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL?.includes('localhost') ? false : {
            rejectUnauthorized: false
        }
    });

    try {
        await client.connect();
        console.log('✅ Connected to PostgreSQL\n');

        const result = await client.query(`
            SELECT DISTINCT rarity, COUNT(*) as count 
            FROM cards 
            WHERE api_id IS NOT NULL 
            AND (image_url_large IS NOT NULL OR image_url_small IS NOT NULL)
            GROUP BY rarity
            ORDER BY count DESC
        `);

        console.log('📋 AVAILABLE RARITIES:\n');
        result.rows.forEach(row => {
            console.log(`   ${row.rarity.padEnd(35)} - ${row.count} cards`);
        });

        console.log(`\n📊 Total unique rarities: ${result.rows.length}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
    }
}

checkRarities();
