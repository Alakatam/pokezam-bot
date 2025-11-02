// Direct database setup without bot initialization
const sqlite3 = require('sqlite3').verbose();

// Shop items data
const SHOP_ITEMS = [
    // Gold Boost Items
    { itemId: 'amulet_coin', name: 'Amulet Coin', description: 'Doubles gold earned from packs for 1 hour', category: 'gold_boost', price: 500, sortOrder: 1 },
    { itemId: 'golden_horseshoe', name: 'Golden Horseshoe', description: 'Triples gold earned from packs for 30 minutes', category: 'gold_boost', price: 1000, sortOrder: 2 },
    { itemId: 'fortune_charm', name: 'Fortune Charm', description: '5x gold from packs for 15 minutes', category: 'gold_boost', price: 2000, sortOrder: 3 },

    // Luck Boost Items
    { itemId: 'collectors_charm', name: "Collector's Charm", description: '2x chance of rare cards for 1 hour', category: 'luck_boost', price: 750, sortOrder: 4 },
    { itemId: 'shiny_charm', name: 'Shiny Charm', description: '3x chance of rare cards for 30 minutes', category: 'luck_boost', price: 1500, sortOrder: 5 },
    { itemId: 'rainbow_feather', name: 'Rainbow Feather', description: '5x chance of rare cards for 15 minutes', category: 'luck_boost', price: 3000, sortOrder: 6 },

    // Quality of Life Items
    { itemId: 'quick_ball', name: 'Quick Ball', description: 'Skip cooldowns on next 10 card draws', category: 'quality_filter', price: 300, sortOrder: 7 },
    { itemId: 'master_ball', name: 'Master Ball', description: 'Skip cooldowns on next 25 card draws', category: 'quality_filter', price: 600, sortOrder: 8 },
    { itemId: 'premier_ball', name: 'Premier Ball', description: 'Skip cooldowns on next 50 card draws', category: 'quality_filter', price: 1000, sortOrder: 9 },

    // Container Items
    { itemId: 'mystery_box', name: 'Mystery Box', description: 'Contains random valuable items worth 200-800 gold', category: 'container', price: 400, sortOrder: 10 },
    { itemId: 'treasure_chest', name: 'Treasure Chest', description: 'Contains random valuable items worth 500-2000 gold', category: 'container', price: 1000, sortOrder: 11 },
    { itemId: 'legendary_vault', name: 'Legendary Vault', description: 'Contains random valuable items worth 1500-5000 gold', category: 'container', price: 2500, sortOrder: 12 },

    // Multi-Effect Items
    { itemId: 'lucky_coin', name: 'Lucky Coin', description: '1.5x gold AND 1.5x luck for 2 hours', category: 'multi_boost', price: 1200, sortOrder: 13 },
    { itemId: 'sacred_orb', name: 'Sacred Orb', description: '2x gold AND 2x luck for 1 hour', category: 'multi_boost', price: 2500, sortOrder: 14 },
    { itemId: 'divine_blessing', name: 'Divine Blessing', description: '3x gold AND 3x luck for 30 minutes', category: 'multi_boost', price: 5000, sortOrder: 15 },

    // Special Items (Not purchasable - starter rewards)
    { itemId: 'welcome_charm', name: 'Welcome Charm', description: '+25% gold & 2x rare chance for 125 card draws', category: 'special', price: 0, sortOrder: 16 }
];

async function setupShopItems() {
    console.log('Setting up shop items...');
    
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database('./bot.db', (err) => {
            if (err) {
                console.error('Error connecting to database:', err);
                reject(err);
                return;
            }
            console.log('Connected to database');
        });

        function addItems() {
            // Add all shop items
            const stmt = db.prepare(`INSERT OR REPLACE INTO shop_items 
                (item_id, name, description, category, price, max_stock, current_stock, sort_order) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

            let completed = 0;
            
            SHOP_ITEMS.forEach((item, index) => {
                stmt.run([
                    item.itemId,
                    item.name,
                    item.description,
                    item.category,
                    item.price,
                    null, // max_stock
                    null, // current_stock
                    item.sortOrder
                ], (err) => {
                    if (err) {
                        console.error(`Error adding ${item.name}:`, err);
                        reject(err);
                        return;
                    }
                    console.log(`Added shop item: ${item.name}`);
                    completed++;
                    
                    if (completed === SHOP_ITEMS.length) {
                        stmt.finalize();
                        
                        // Verify the setup
                        db.all('SELECT * FROM shop_items', (err, rows) => {
                            if (err) {
                                console.error('Error verifying setup:', err);
                                reject(err);
                                return;
                            }
                            
                            console.log(`Successfully added ${SHOP_ITEMS.length} items to the shop!`);
                            console.log(`Verified: ${rows.length} items in shop database`);
                            
                            db.close((err) => {
                                if (err) {
                                    console.error('Error closing database:', err);
                                    reject(err);
                                } else {
                                    console.log('Database connection closed');
                                    resolve();
                                }
                            });
                        });
                    }
                });
            });
        }

        // Check if shop_items table has data and clear if needed
        db.all('SELECT COUNT(*) as count FROM shop_items', (err, result) => {
            if (err) {
                console.error('Error checking shop items:', err);
                reject(err);
                return;
            }
            
            const existingCount = result[0].count;
            console.log(`Found ${existingCount} existing shop items`);
            
            if (existingCount > 0) {
                db.run('DELETE FROM shop_items', (err) => {
                    if (err) {
                        console.error('Error clearing shop items:', err);
                        reject(err);
                        return;
                    }
                    console.log('Cleared existing shop items');
                    addItems();
                });
            } else {
                console.log('No existing items to clear');
                addItems();
            }
        });
    });
}

// Run the setup if this file is executed directly
if (require.main === module) {
    setupShopItems();
}

module.exports = setupShopItems;