const Database = require('../database/Database.js');

(async () => {
    const db = new Database();
    await db.connect();
    await db.initialize();
    
    const sets = await db.all(`
        SELECT DISTINCT set_id, set_name, COUNT(*) as card_count 
        FROM cards 
        WHERE set_id IS NOT NULL 
        GROUP BY set_id, set_name 
        ORDER BY set_id
    `);
    
    console.log('📊 Sets in your database:');
    console.log('Total sets:', sets.length);
    console.log('');
    console.log('Set ID   | Set Name                  | Cards');
    console.log('---------|---------------------------|-------');
    
    sets.forEach(set => {
        const setId = set.set_id.padEnd(8);
        const setName = set.set_name.substring(0, 25).padEnd(25);
        console.log(`${setId} | ${setName} | ${set.card_count}`);
    });
    
    db.close();
})().catch(console.error);