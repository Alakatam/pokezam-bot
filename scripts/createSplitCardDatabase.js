/**
 * Split Card Database Creator for Render Deployment
 * 
 * This script creates a smaller "core" card database for initial deployment
 * and organizes remaining cards for progressive loading from GitHub.
 * 
 * Strategy:
 * 1. Core Database (1000 cards) - Essential cards for immediate functionality
 * 2. Extended Sets - Remaining cards organized by popularity/recency
 * 3. GitHub API Integration - Load additional cards after deployment
 */

const fs = require('fs').promises;
const path = require('path');

class SplitCardDatabaseCreator {
    constructor() {
        this.coreCardLimit = 1000;
        this.prioritySets = [
            // Most popular/recent sets first
            'sv8', 'sv7', 'sv6', 'sv5', 'sv4', 'sv3', 'sv2', 'sv1',  // Scarlet Violet
            'swsh12', 'swsh11', 'swsh10', 'swsh9', 'swsh8',          // Recent Sword Shield
            'sm12', 'sm11', 'sm10',                                   // Popular Sun Moon
            'base1', 'base2', 'base3',                                // Classic Base sets
            'xy12', 'xy11', 'xy10'                                    // Recent XY
        ];
        
        this.coreCards = [];
        this.extendedCards = [];
        this.cardsBySet = new Map();
    }

    async loadAllCards() {
        console.log('📚 Loading all card data...');
        const cardsDir = path.join(__dirname, '..', 'tcg-data', 'cards', 'en');
        const files = await fs.readdir(cardsDir);
        
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            
            try {
                const filePath = path.join(cardsDir, file);
                const content = await fs.readFile(filePath, 'utf8');
                const cards = JSON.parse(content);
                const setId = file.replace('.json', '');
                
                console.log(`   ✅ ${setId}: ${cards.length} cards`);
                this.cardsBySet.set(setId, cards);
                
            } catch (error) {
                console.log(`   ⚠️  Failed to load ${file}: ${error.message}`);
            }
        }
        
        console.log(`📊 Loaded ${this.cardsBySet.size} sets`);
    }

    selectCoreCards() {
        console.log('🎯 Selecting core cards for deployment...');
        
        // Strategy: Get diverse cards from priority sets
        let coreCount = 0;
        
        for (const setId of this.prioritySets) {
            if (coreCount >= this.coreCardLimit) break;
            
            const setCards = this.cardsBySet.get(setId);
            if (!setCards) continue;
            
            // Take a sampling from each priority set
            const sampleSize = Math.min(
                Math.floor((this.coreCardLimit - coreCount) / (this.prioritySets.length - this.prioritySets.indexOf(setId))),
                setCards.length,
                80 // Max per set to maintain diversity
            );
            
            const selectedCards = this.selectDiverseCards(setCards, sampleSize);
            this.coreCards.push(...selectedCards);
            coreCount += selectedCards.length;
            
            console.log(`   📦 ${setId}: ${selectedCards.length} cards (${coreCount}/${this.coreCardLimit})`);
        }
        
        // Fill remaining slots with cards from other sets
        if (coreCount < this.coreCardLimit) {
            const remainingSets = Array.from(this.cardsBySet.keys())
                .filter(setId => !this.prioritySets.includes(setId));
            
            for (const setId of remainingSets) {
                if (coreCount >= this.coreCardLimit) break;
                
                const setCards = this.cardsBySet.get(setId);
                const needed = Math.min(this.coreCardLimit - coreCount, 20, setCards.length);
                
                const selectedCards = this.selectDiverseCards(setCards, needed);
                this.coreCards.push(...selectedCards);
                coreCount += selectedCards.length;
                
                console.log(`   📦 ${setId}: ${selectedCards.length} cards (${coreCount}/${this.coreCardLimit})`);
            }
        }
        
        console.log(`✅ Core cards selected: ${this.coreCards.length}`);
    }

    selectDiverseCards(cards, count) {
        if (cards.length <= count) return [...cards];
        
        // Strategy: Get diverse rarities and types
        const rarityGroups = new Map();
        
        for (const card of cards) {
            const rarity = card.rarity || 'Common';
            if (!rarityGroups.has(rarity)) {
                rarityGroups.set(rarity, []);
            }
            rarityGroups.get(rarity).push(card);
        }
        
        const selected = [];
        const rarities = Array.from(rarityGroups.keys()).sort((a, b) => {
            // Prioritize rare cards
            const rarityPriority = { 'Rare Holo': 5, 'Rare': 4, 'Uncommon': 3, 'Common': 2 };
            return (rarityPriority[b] || 1) - (rarityPriority[a] || 1);
        });
        
        let remaining = count;
        for (const rarity of rarities) {
            if (remaining <= 0) break;
            
            const rarityCards = rarityGroups.get(rarity);
            const takeCount = Math.min(remaining, Math.ceil(rarityCards.length * (remaining / cards.length)));
            
            // Shuffle and take
            const shuffled = rarityCards.sort(() => Math.random() - 0.5);
            selected.push(...shuffled.slice(0, takeCount));
            remaining -= takeCount;
        }
        
        return selected.slice(0, count);
    }

    organizeExtendedCards() {
        console.log('📋 Organizing extended cards...');
        
        const coreCardIds = new Set(this.coreCards.map(card => card.id));
        
        for (const [setId, cards] of this.cardsBySet) {
            const extendedSetCards = cards.filter(card => !coreCardIds.has(card.id));
            
            if (extendedSetCards.length > 0) {
                this.extendedCards.push({
                    setId,
                    setName: extendedSetCards[0]?.set?.name || setId,
                    cardCount: extendedSetCards.length,
                    cards: extendedSetCards,
                    priority: this.prioritySets.includes(setId) ? this.prioritySets.indexOf(setId) : 999
                });
            }
        }
        
        // Sort by priority
        this.extendedCards.sort((a, b) => a.priority - b.priority);
        
        const totalExtended = this.extendedCards.reduce((sum, set) => sum + set.cardCount, 0);
        console.log(`📊 Extended cards: ${totalExtended} cards in ${this.extendedCards.length} sets`);
    }

    async createSplitFiles() {
        console.log('💾 Creating split database files...');
        
        // Create output directory
        const outputDir = path.join(__dirname, '..', 'database-split');
        await fs.mkdir(outputDir, { recursive: true });
        
        // 1. Core database for deployment
        const coreData = {
            version: '1.0',
            type: 'core-cards',
            created: new Date().toISOString(),
            description: 'Essential cards for initial deployment',
            cardCount: this.coreCards.length,
            cards: this.coreCards
        };
        
        await fs.writeFile(
            path.join(outputDir, 'core-cards.json'),
            JSON.stringify(coreData, null, 2)
        );
        
        console.log(`   ✅ core-cards.json: ${this.coreCards.length} cards`);
        
        // 2. Extended cards by priority
        for (let i = 0; i < this.extendedCards.length; i++) {
            const setData = this.extendedCards[i];
            const fileName = `extended-${String(i + 1).padStart(2, '0')}-${setData.setId}.json`;
            
            const extendedData = {
                version: '1.0',
                type: 'extended-cards',
                setId: setData.setId,
                setName: setData.setName,
                priority: setData.priority,
                cardCount: setData.cardCount,
                cards: setData.cards
            };
            
            await fs.writeFile(
                path.join(outputDir, fileName),
                JSON.stringify(extendedData, null, 2)
            );
            
            console.log(`   ✅ ${fileName}: ${setData.cardCount} cards`);
        }
        
        // 3. Loading manifest
        const manifest = {
            version: '1.0',
            created: new Date().toISOString(),
            description: 'Progressive card loading manifest for Render deployment',
            coreCards: {
                file: 'core-cards.json',
                count: this.coreCards.length,
                required: true
            },
            extendedSets: this.extendedCards.map((set, index) => ({
                file: `extended-${String(index + 1).padStart(2, '0')}-${set.setId}.json`,
                setId: set.setId,
                setName: set.setName,
                priority: set.priority,
                count: set.cardCount,
                loadOrder: index + 1
            })),
            totalCards: this.coreCards.length + this.extendedCards.reduce((sum, set) => sum + set.cardCount, 0),
            loadingStrategy: 'progressive',
            githubRepository: 'your-repo/pokezam', // Update this with your repo
            githubPath: 'database-split'
        };
        
        await fs.writeFile(
            path.join(outputDir, 'loading-manifest.json'),
            JSON.stringify(manifest, null, 2)
        );
        
        console.log(`   ✅ loading-manifest.json: Deployment strategy`);
        
        // 4. Create compact core backup for Render
        const compactBackup = {
            timestamp: new Date().toISOString(),
            type: "render_deployment",
            description: "Compact backup for Render deployment with progressive loading",
            data: {
                cards: this.coreCards.slice(0, 1000), // Ensure exactly 1000 for backup compatibility
                // Include minimal essential data only
                quests: [], // Will be initialized by bot
                users: [], // Empty for fresh deployment
                userItems: [],
                userQuests: [],
                activeEffects: [],
                userCards: []
            },
            progressiveLoading: {
                enabled: true,
                manifestFile: 'loading-manifest.json',
                totalCardsAvailable: manifest.totalCards
            }
        };
        
        await fs.writeFile(
            path.join(outputDir, 'render-deployment-backup.json'),
            JSON.stringify(compactBackup, null, 2)
        );
        
        console.log(`   ✅ render-deployment-backup.json: Compact deployment backup`);
    }

    async createProgressiveLoader() {
        console.log('🔧 Creating progressive card loader...');
        
        const loaderCode = `/**
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
        this.githubRepo = 'your-username/pokezam'; // UPDATE THIS!
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
            console.log(\`📊 Current cards in database: \${currentCount.count}\`);
            
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
        const manifestUrl = \`https://raw.githubusercontent.com/\${this.githubRepo}/\${this.githubBranch}/\${this.githubPath}/loading-manifest.json\`;
        
        try {
            console.log('📋 Loading manifest from GitHub...');
            const response = await axios.get(manifestUrl, { timeout: 10000 });
            this.manifest = response.data;
            this.loadingState.totalSetsAvailable = this.manifest.extendedSets.length;
            console.log(\`✅ Manifest loaded: \${this.manifest.totalCards} total cards available\`);
        } catch (error) {
            console.error('❌ Failed to load manifest:', error.message);
            throw new Error('Cannot load card manifest from GitHub');
        }
    }

    async loadExtendedCards() {
        if (!this.manifest) {
            throw new Error('Manifest not loaded');
        }

        console.log(\`🚀 Starting progressive card loading (\${this.manifest.extendedSets.length} sets)...\`);
        
        for (const setInfo of this.manifest.extendedSets) {
            try {
                await this.loadExtendedSet(setInfo);
                this.loadingState.extendedSetsLoaded++;
                
                // Small delay between sets to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(\`❌ Failed to load set \${setInfo.setId}:\`, error.message);
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
        console.log(\`🎉 Progressive loading complete! Final card count: \${finalCount.count}\`);
    }

    async loadExtendedSet(setInfo) {
        const setUrl = \`https://raw.githubusercontent.com/\${this.githubRepo}/\${this.githubBranch}/\${this.githubPath}/\${setInfo.file}\`;
        
        try {
            console.log(\`📦 Loading \${setInfo.setId} (\${setInfo.count} cards)...\`);
            const response = await axios.get(setUrl, { timeout: 15000 });
            const setData = response.data;
            
            // Check if we already have cards from this set
            const existingCount = await this.database.get(
                'SELECT COUNT(*) as count FROM cards WHERE set_id = ?', 
                [setInfo.setId]
            );
            
            if (existingCount.count >= setData.cardCount * 0.9) {
                console.log(\`   ✅ \${setInfo.setId} already loaded (\${existingCount.count} cards)\`);
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
            
            console.log(\`   ✅ \${setInfo.setId}: +\${newCards} new cards\`);
            
        } catch (error) {
            throw new Error(\`Failed to load \${setInfo.setId}: \${error.message}\`);
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
`;

        await fs.writeFile(
            path.join(__dirname, '..', 'database', 'ProgressiveCardLoader.js'),
            loaderCode
        );
        
        console.log(`   ✅ ProgressiveCardLoader.js created`);
    }

    async generateDeploymentInstructions() {
        const instructions = `# 🚀 Render Deployment with Progressive Card Loading

## Problem Solved
Render deployment size limits prevented loading all 14,926+ cards at once. This solution:
- Deploys with 1000 essential cards immediately  
- Loads remaining cards progressively from GitHub after deployment
- Maintains full functionality while respecting platform limits

## Files Created

### 1. Core Database (\`database-split/\`)
- \`core-cards.json\` - 1000 essential cards for immediate deployment
- \`extended-XX-setname.json\` - Remaining cards organized by set priority  
- \`loading-manifest.json\` - Deployment and loading strategy
- \`render-deployment-backup.json\` - Compact backup for Render

### 2. Progressive Loader
- \`database/ProgressiveCardLoader.js\` - Loads cards from GitHub after deployment

## Deployment Steps

### 1. Update GitHub Repository
\`\`\`bash
# Upload split database files to GitHub
git add database-split/
git commit -m "Add progressive card loading system for Render deployment"
git push origin main
\`\`\`

### 2. Update Repository URL
Edit \`database/ProgressiveCardLoader.js\` line 15:
\`\`\`javascript
this.githubRepo = 'YOUR-USERNAME/pokezam'; // Update this!
\`\`\`

### 3. Update Bot Startup
Add to \`index.js\` after database initialization:
\`\`\`javascript
// Progressive card loading for cloud deployment
if (process.env.NODE_ENV === 'production' || process.env.PORT) {
    const ProgressiveCardLoader = require('./database/ProgressiveCardLoader');
    const cardLoader = new ProgressiveCardLoader(this.database);
    
    // Load additional cards in background (non-blocking)
    cardLoader.checkAndLoadCards().catch(error => {
        console.error('Progressive loading failed:', error.message);
    });
}
\`\`\`

### 4. Deploy to Render
- Use \`render-deployment-backup.json\` as your backup file
- Bot starts with 1000 cards immediately
- Remaining cards load automatically from GitHub within ~5 minutes

## Benefits
✅ **Immediate Functionality** - Bot works instantly with core cards  
✅ **Full Card Database** - All cards load progressively  
✅ **No Deployment Limits** - Works within Render's constraints  
✅ **Automatic Updates** - Push new cards to GitHub, they load automatically  
✅ **Fallback Safe** - Bot works even if progressive loading fails  

## Monitoring
Check progressive loading status:
\`\`\`javascript
// In your admin command, add:
const cardLoader = new ProgressiveCardLoader(database);
const status = cardLoader.getLoadingStatus();
console.log('Progressive loading:', status);
\`\`\`

Generated: ${new Date().toISOString()}
`;

        await fs.writeFile(
            path.join(__dirname, '..', 'RENDER_DEPLOYMENT_GUIDE.md'),
            instructions
        );
        
        console.log(`   ✅ RENDER_DEPLOYMENT_GUIDE.md created`);
    }

    async run() {
        console.log('🚀 SPLIT CARD DATABASE CREATOR');
        console.log('================================');
        console.log('Creating progressive loading system for Render deployment...\n');
        
        try {
            await this.loadAllCards();
            this.selectCoreCards();
            this.organizeExtendedCards();
            await this.createSplitFiles();
            await this.createProgressiveLoader();
            await this.generateDeploymentInstructions();
            
            console.log('\n🎉 SPLIT DATABASE CREATION COMPLETE!');
            console.log('====================================');
            console.log(`✅ Core cards: ${this.coreCards.length}`);
            console.log(`✅ Extended sets: ${this.extendedCards.length}`);
            console.log(`✅ Total cards: ${this.coreCards.length + this.extendedCards.reduce((sum, set) => sum + set.cardCount, 0)}`);
            console.log('\n📋 Next Steps:');
            console.log('1. Review RENDER_DEPLOYMENT_GUIDE.md');
            console.log('2. Update GitHub repository URL in ProgressiveCardLoader.js');
            console.log('3. Upload database-split/ folder to GitHub');
            console.log('4. Deploy to Render with progressive loading enabled');
            
        } catch (error) {
            console.error('❌ Error creating split database:', error);
            process.exit(1);
        }
    }
}

// Run if called directly
if (require.main === module) {
    const creator = new SplitCardDatabaseCreator();
    creator.run();
}

module.exports = SplitCardDatabaseCreator;