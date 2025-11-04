/**
 * Progressive Card Loader for Render Deployment
 * 
 * Loads additional cards from GitHub after initial deployment
 * to work around Render's deployment size limitations.
 */

const axios = require('axios');
const Database = require('./Database');

class ProgressiveCardLoader {
    constructor(database) {
        this.database = database;
        this.githubRepo = 'Alakatam/pokezam-bot'; // Your actual repo
        this.githubPath = 'database-split';
        this.githubBranch = 'main';
        this.loadingState = {
            coreLoaded: false,
            extendedSetsLoaded: 0,
            totalSetsAvailable: 0,
            lastLoadAttempt: null,
            errors: []
        };
    }

    async checkAndLoadCards() {
        try {
            console.log('🔄 Checking card database status...');
            
            // Check current card count
            const currentCount = await this.database.get('SELECT COUNT(*) as count FROM cards');
            console.log(`📊 Current cards in database: ${currentCount.count}`);
            
            // If we have less than 2000 cards, try to load more
            if (currentCount.count < 2000) {
                console.log('📚 Database appears incomplete, starting progressive loading...');
                await this.loadManifest();
                await this.loadExtendedCards();
            } else {
                console.log('✅ Database appears complete, skipping progressive loading');
            }
            
        } catch (error) {
            console.error('❌ Progressive loading error:', error.message);
            this.loadingState.errors.push({
                timestamp: new Date().toISOString(),
                error: error.message
            });
        }
    }

    async loadManifest() {
        const manifestUrl = `https://raw.githubusercontent.com/${this.githubRepo}/${this.githubBranch}/${this.githubPath}/loading-manifest.json`;
        
        try {
            console.log('📋 Loading manifest from GitHub...');
            const response = await axios.get(manifestUrl, { timeout: 10000 });
            this.manifest = response.data;
            this.loadingState.totalSetsAvailable = this.manifest.extendedSets.length;
            console.log(`✅ Manifest loaded: ${this.manifest.totalCards} total cards available`);
        } catch (error) {
            console.error('❌ Failed to load manifest:', error.message);
            throw new Error('Cannot load card manifest from GitHub');
        }
    }

    async loadExtendedCards() {
        if (!this.manifest) {
            throw new Error('Manifest not loaded');
        }

        console.log(`🚀 Starting progressive card loading (${this.manifest.extendedSets.length} sets)...`);
        
        for (const setInfo of this.manifest.extendedSets) {
            try {
                await this.loadExtendedSet(setInfo);
                this.loadingState.extendedSetsLoaded++;
                
                // Small delay between sets to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`❌ Failed to load set ${setInfo.setId}:`, error.message);
                this.loadingState.errors.push({
                    timestamp: new Date().toISOString(),
                    setId: setInfo.setId,
                    error: error.message
                });
                
                // Continue loading other sets even if one fails
                continue;
            }
        }
        
        // Final count
        const finalCount = await this.database.get('SELECT COUNT(*) as count FROM cards');
        console.log(`🎉 Progressive loading complete! Final card count: ${finalCount.count}`);
    }

    async loadExtendedSet(setInfo) {
        const setUrl = `https://raw.githubusercontent.com/${this.githubRepo}/${this.githubBranch}/${this.githubPath}/${setInfo.file}`;
        
        try {
            console.log(`📦 Loading ${setInfo.setId} (${setInfo.count} cards)...`);
            const response = await axios.get(setUrl, { timeout: 15000 });
            const setData = response.data;
            
            // Check if we already have cards from this set
            const existingCount = await this.database.get(
                'SELECT COUNT(*) as count FROM cards WHERE set_id = ?', 
                [setInfo.setId]
            );
            
            if (existingCount.count >= setData.cardCount * 0.9) {
                console.log(`   ✅ ${setInfo.setId} already loaded (${existingCount.count} cards)`);
                return;
            }
            
            // Load cards using existing CardManager logic
            const CardManager = require('./CardManager');
            const cardManager = new CardManager(this.database);
            
            let newCards = 0;
            for (const card of setData.cards) {
                const existing = await this.database.get('SELECT id FROM cards WHERE api_id = ?', [card.id]);
                if (!existing) {
                    await cardManager.insertCard(card);
                    newCards++;
                }
            }
            
            console.log(`   ✅ ${setInfo.setId}: +${newCards} new cards`);
            
        } catch (error) {
            throw new Error(`Failed to load ${setInfo.setId}: ${error.message}`);
        }
    }

    getLoadingStatus() {
        return {
            ...this.loadingState,
            completionPercentage: this.loadingState.totalSetsAvailable > 0 
                ? Math.round((this.loadingState.extendedSetsLoaded / this.loadingState.totalSetsAvailable) * 100)
                : 0
        };
    }
}

module.exports = ProgressiveCardLoader;
