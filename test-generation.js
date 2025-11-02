const Database = require('./database/Database');
const CardManager = require('./database/CardManager');

async function testGenerationFiltering() {
    const database = new Database();
    const cardManager = new CardManager(database);
    
    try {
        await database.connect();
        console.log('Testing Generation I card availability...');
        
        // Test direct SQL query for Generation I cards
        const gen1Cards = await database.all(`SELECT * FROM cards WHERE set_name IN ('Base Set', 'Jungle', 'Fossil', 'base1', 'base2', 'base3') LIMIT 5`);
        console.log('Direct Gen I cards found:', gen1Cards.length);
        if (gen1Cards.length > 0) {
            console.log('Sample cards:', gen1Cards.map(c => `${c.name} (${c.set_name})`));
        }
        
        // Test CardManager methods
        const availableGens = cardManager.getAvailableGenerationsByLevel(2);
        console.log('Available generations for level 2:', availableGens);
        
        const genSets = [];
        for (const gen of availableGens) {
            const sets = cardManager.getSetsByGeneration(gen);
            genSets.push(...sets);
        }
        console.log('Sets for generations:', genSets);
        
        // Test with actual CardManager
        const randomCard = await cardManager.getRandomCard(2);
        console.log('CardManager getRandomCard result:', !!randomCard);
        if (randomCard) {
            console.log('Card found:', randomCard.name, 'from', randomCard.set_name);
        }
        
    } catch (error) {
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        database.close();
    }
}

testGenerationFiltering();