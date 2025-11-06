/**
 * Check current base sets status and investigate missing Jungle/Fossil
 */

const Database = require('../database/Database');

async function checkBaseSets() {
    console.log('🔍 Checking Base Sets Status...\n');
    
    const db = new Database();
    await db.initialize();

    try {
        // Check total cards by set
        console.log('📊 CARDS BY SET:');
        const setStats = await db.all(`
            SELECT set_id, set_name, COUNT(*) as count 
            FROM cards 
            WHERE set_id IN ('base1', 'base2', 'base3', 'base4', 'base5')
            GROUP BY set_id, set_name
            ORDER BY set_id
        `);
        
        if (setStats && setStats.length > 0) {
            setStats.forEach(set => {
                console.log(`   ${set.set_id}: ${set.set_name || 'NULL'} - ${set.count} cards`);
            });
        } else {
            console.log('   ❌ No base sets found!');
        }
        
        console.log('\n📊 TOTAL BASE SETS (base1, base2, base3):');
        const totalBase = await db.get(`
            SELECT COUNT(*) as count 
            FROM cards 
            WHERE set_id IN ('base1', 'base2', 'base3')
        `);
        console.log(`   Total: ${totalBase.count} cards`);
        console.log(`   Expected: ~228 cards`);
        
        // Check if files exist
        console.log('\n📁 LOCAL FILES:');
        const fs = require('fs');
        const path = require('path');
        
        ['base1.json', 'base2.json', 'base3.json'].forEach(fileName => {
            const filePath = path.resolve(__dirname, '..', 'tcg-data', 'cards', 'en', fileName);
            if (fs.existsSync(filePath)) {
                const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                console.log(`   ✅ ${fileName}: ${content.length} cards`);
            } else {
                console.log(`   ❌ ${fileName}: NOT FOUND`);
            }
        });
        
        // Check for reload flag
        console.log('\n🚩 RELOAD FLAG:');
        const flagPath = path.resolve(__dirname, '..', '.force_reload_base_sets');
        if (fs.existsSync(flagPath)) {
            console.log('   ✅ Flag exists - will trigger on next startup');
        } else {
            console.log('   ❌ Flag not found - already processed or not created');
        }
        
        // Sample some cards to see what's there
        console.log('\n🃏 SAMPLE CARDS FROM EACH SET:');
        const samples = await db.all(`
            SELECT set_id, set_name, name, number 
            FROM cards 
            WHERE set_id IN ('base1', 'base2', 'base3')
            ORDER BY set_id, CAST(REPLACE(number, '/', '') AS INTEGER)
            LIMIT 10
        `);
        
        if (samples && samples.length > 0) {
            samples.forEach(card => {
                console.log(`   ${card.set_id} #${card.number}: ${card.name} (set_name: ${card.set_name})`);
            });
        }
        
        await db.close();
        
    } catch (error) {
        console.error('❌ Error checking base sets:', error);
        await db.close();
        process.exit(1);
    }
}

if (require.main === module) {
    checkBaseSets()
        .then(() => {
            console.log('\n✅ Check complete!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Failed:', error);
            process.exit(1);
        });
}

module.exports = checkBaseSets;
