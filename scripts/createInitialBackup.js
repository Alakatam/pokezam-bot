/**
 * Create Initial Backup for Cloud Deployment
 * 
 * This script creates a backup file from your local database
 * that will be used to restore data on first cloud deployment
 */

const fs = require('fs').promises;
const path = require('path');
const Database = require('../database/Database');

async function createInitialBackup() {
    console.log('🔄 Creating initial backup for cloud deployment...');
    
    const db = new Database();
    
    try {
        // Force use local database
        db.dbPath = './pokezam.db';
        await db.connect();
        
        console.log('📊 Reading local database...');
        
        // Get all essential data
        const users = await db.all('SELECT * FROM users');
        const userItems = await db.all('SELECT * FROM user_items');
        const userQuests = await db.all('SELECT * FROM user_quests');
        const activeEffects = await db.all('SELECT * FROM active_effects');
        const userCards = await db.all('SELECT * FROM user_cards');
        const cards = await db.all('SELECT * FROM cards LIMIT 5000'); // First 5000 cards
        const quests = await db.all('SELECT * FROM quests');
        
        console.log('📋 Data Summary:');
        console.log('  Users:', users.length);
        console.log('  Cards (sample):', cards.length);
        console.log('  Quests:', quests.length);
        console.log('  User Items:', userItems.length);
        console.log('  User Quests:', userQuests.length);
        console.log('  Active Effects:', activeEffects.length);
        console.log('  User Cards:', userCards.length);
        
        // Create backup object
        const backup = {
            version: "1.0.0",
            timestamp: new Date().toISOString(),
            type: "initial_deployment",
            data: {
                users,
                userItems,
                userQuests, 
                activeEffects,
                userCards,
                cards: cards.slice(0, 1000), // Just essential cards for startup
                quests
            }
        };
        
        // Save as initial backup file
        const backupPath = path.join(__dirname, '..', 'initial_backup.json');
        await fs.writeFile(backupPath, JSON.stringify(backup, null, 2));
        
        console.log('✅ Initial backup created:', backupPath);
        console.log('📁 File size:', ((await fs.stat(backupPath)).size / 1024 / 1024).toFixed(2), 'MB');
        
    } catch (error) {
        console.error('❌ Error creating backup:', error);
    } finally {
        db.close();
    }
}

// Run the backup creation
createInitialBackup();