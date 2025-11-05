const Database = require('./database/Database');

async function testBaseSets() {
    console.log('🔍 Testing Base Set 2 and 3 card access...');
    
    const database = new Database();
    await database.connect();
    await database.initialize();
    
    try {
        // Test Base Set 2 (Jungle) cards
        console.log('\n📊 Base Set 2 (Jungle) Cards:');
        const base2Cards = await database.all(
            'SELECT name, rarity, set_id FROM cards WHERE set_id = ? LIMIT 10',
            ['base2']
        );
        base2Cards.forEach(card => {
            console.log(`   🎴 ${card.name} (${card.rarity}) - ${card.set_id}`);
        });
        
        // Test Base Set 3 (Fossil) cards  
        console.log('\n📊 Base Set 3 (Fossil) Cards:');
        const base3Cards = await database.all(
            'SELECT name, rarity, set_id FROM cards WHERE set_id = ? LIMIT 10', 
            ['base3']
        );
        base3Cards.forEach(card => {
            console.log(`   🎴 ${card.name} (${card.rarity}) - ${card.set_id}`);
        });
        
        // Count total cards in base sets
        console.log('\n📈 Base Set Totals:');
        const baseCounts = await database.all(`
            SELECT set_id, COUNT(*) as count 
            FROM cards 
            WHERE set_id IN ('base1', 'base2', 'base3') 
            GROUP BY set_id
            ORDER BY set_id
        `);
        baseCounts.forEach(set => {
            console.log(`   📦 ${set.set_id}: ${set.count} cards`);
        });
        
        console.log('\n✅ Base Sets Successfully Loaded and Accessible!');
        
    } catch (error) {
        console.error('❌ Error testing base sets:', error.message);
    }
    
    await database.close();
}

testBaseSets().catch(console.error);