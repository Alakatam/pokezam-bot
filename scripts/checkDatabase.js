const sqlite3 = require('sqlite3').verbose();

function checkDatabase() {
    const db = new sqlite3.Database('./bot.db', (err) => {
        if (err) {
            console.error('Error connecting to database:', err);
            return;
        }
        console.log('Connected to database');
    });

    // Check what tables exist
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
        if (err) {
            console.error('Error getting tables:', err);
            return;
        }
        
        console.log('Existing tables:');
        tables.forEach(table => {
            console.log(`- ${table.name}`);
        });

        // Check if shop_items table exists and create it if needed
        const shopTableExists = tables.some(table => table.name === 'shop_items');
        
        if (!shopTableExists) {
            console.log('\nCreating shop_items table...');
            
            const createTableSQL = `CREATE TABLE IF NOT EXISTS shop_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                category TEXT NOT NULL,
                price INTEGER NOT NULL,
                max_stock INTEGER DEFAULT NULL,
                current_stock INTEGER DEFAULT NULL,
                is_available BOOLEAN DEFAULT TRUE,
                sort_order INTEGER DEFAULT 0,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            )`;

            db.run(createTableSQL, (err) => {
                if (err) {
                    console.error('Error creating shop_items table:', err);
                    return;
                }
                console.log('shop_items table created successfully');
                db.close();
            });
        } else {
            console.log('shop_items table already exists');
            db.close();
        }
    });
}

checkDatabase();