const fs = require('fs');
const path = require('path');
const { initializeDatabase } = require('./initDatabase');
const { seedCards } = require('./seedCards');

async function setup() {
    console.log('🚀 Setting up Pokezam TCG Bot...\n');

    // Check if .env exists
    const envPath = path.join(__dirname, '..', '.env');
    const envExamplePath = path.join(__dirname, '..', '.env.example');
    
    if (!fs.existsSync(envPath)) {
        console.log('📝 Creating .env file from template...');
        
        if (fs.existsSync(envExamplePath)) {
            fs.copyFileSync(envExamplePath, envPath);
            console.log('✅ .env file created! Please edit it with your bot credentials.\n');
        } else {
            console.log('⚠️  .env.example not found. Please create .env manually.\n');
        }
        
        console.log('🔧 Please update your .env file with:');
        console.log('   - DISCORD_TOKEN: Your bot token from Discord Developer Portal');
        console.log('   - CLIENT_ID: Your bot\'s client ID');
        console.log('   - GUILD_ID: Your test server ID (for development)\n');
        
        console.log('❌ Setup incomplete. Please configure .env and run setup again.');
        return;
    }

    try {
        // Load environment variables
        require('dotenv').config({ path: envPath });

        // Check required environment variables
        const requiredVars = ['DISCORD_TOKEN', 'CLIENT_ID'];
        const missingVars = requiredVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            console.log('❌ Missing required environment variables:');
            missingVars.forEach(varName => console.log(`   - ${varName}`));
            console.log('\nPlease update your .env file and run setup again.');
            return;
        }

        // Initialize database
        console.log('🗄️  Initializing database...');
        await initializeDatabase();
        console.log('✅ Database initialized successfully!\n');

        // Seed cards
        console.log('🃏 Seeding card data...');
        await seedCards();
        console.log('✅ Card data seeded successfully!\n');

        // Setup complete
        console.log('🎉 Setup completed successfully!\n');
        console.log('📚 Next steps:');
        console.log('   1. Run "npm start" to start the bot');
        console.log('   2. Invite the bot to your server with these permissions:');
        console.log('      - Send Messages');
        console.log('      - Use Slash Commands');
        console.log('      - Add Reactions');
        console.log('      - Read Message History');
        console.log('   3. Use /draw to start collecting cards!\n');
        
        console.log('🔗 Bot invite URL:');
        console.log(`https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=274877906944&scope=bot%20applications.commands\n`);

    } catch (error) {
        console.error('❌ Setup failed:', error);
        console.log('\nPlease check your configuration and try again.');
    }
}

// Run if called directly
if (require.main === module) {
    setup();
}

module.exports = { setup };