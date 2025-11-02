const https = require('https');
const fs = require('fs');
const path = require('path');

class MissingSetDownloader {
    constructor() {
        this.baseUrl = 'https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master';
        this.dataDir = path.join(__dirname, '..', 'tcg-data');
        this.cardsDir = path.join(this.dataDir, 'cards', 'en');
        this.setsDir = path.join(this.dataDir, 'sets', 'en');
        
        // Missing sets identified from analysis
        this.missingSets = [
            'ex11', 'ex12', 'ex13', 'ex14', 'ex15', 'ex16',  // EX Era
            'col1',  // HGSS Era
            'sv1', 'sv2', 'sv3', 'sv4', 'sv5', 'sv6', 'sv7', 'sv8'  // Scarlet & Violet Era
        ];
        
        // Set name mapping for missing sets
        this.setNameMap = {
            'ex11': 'EX Delta Species',
            'ex12': 'EX Legend Maker', 
            'ex13': 'EX Holon Phantoms',
            'ex14': 'EX Crystal Guardians',
            'ex15': 'EX Dragon Frontiers',
            'ex16': 'EX Power Keepers',
            'col1': 'Call of Legends',
            'sv1': 'Scarlet & Violet Base Set',
            'sv2': 'Paldea Evolved',
            'sv3': 'Obsidian Flames',
            'sv4': 'Paradox Rift',
            'sv5': 'Temporal Forces',
            'sv6': 'Twilight Masquerade',
            'sv7': 'Stellar Crown',
            'sv8': 'Surging Sparks'
        };
        
        this.downloadedSets = new Set();
    }

    async downloadFile(url, filePath) {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(filePath);
            
            https.get(url, (response) => {
                if (response.statusCode !== 200) {
                    fs.unlink(filePath, () => {});
                    reject(new Error(`HTTP ${response.statusCode}`));
                    return;
                }
                
                response.pipe(file);
                
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
                
                file.on('error', (err) => {
                    fs.unlink(filePath, () => {});
                    reject(err);
                });
                
            }).on('error', reject);
        });
    }

    createDirectories() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
        if (!fs.existsSync(this.cardsDir)) {
            fs.mkdirSync(this.cardsDir, { recursive: true });
        }
        if (!fs.existsSync(this.setsDir)) {
            fs.mkdirSync(this.setsDir, { recursive: true });
        }
    }

    async createSetFile(setInfo) {
        try {
            const setPath = path.join(this.setsDir, `${setInfo.id}.json`);
            
            // Create a single-item array for consistency with the loader
            const setData = [{
                id: setInfo.id,
                name: setInfo.name,
                series: setInfo.series || this.getSeriesForSet(setInfo.id),
                printedTotal: setInfo.printedTotal,
                total: setInfo.total,
                legalities: setInfo.legalities,
                ptcgoCode: setInfo.ptcgoCode,
                releaseDate: setInfo.releaseDate || this.estimateReleaseDate(setInfo.id),
                updatedAt: new Date().toISOString(),
                images: setInfo.images
            }];
            
            fs.writeFileSync(setPath, JSON.stringify(setData, null, 2));
            console.log(`   📚 Created set file: ${setInfo.name}`);
            
        } catch (error) {
            console.log(`   ⚠️  Failed to create set file: ${error.message}`);
        }
    }

    getSeriesForSet(setId) {
        if (setId.startsWith('ex')) return 'EX';
        if (setId.startsWith('col')) return 'HeartGold & SoulSilver';
        if (setId.startsWith('sv')) return 'Scarlet & Violet';
        return 'Base';
    }

    estimateReleaseDate(setId) {
        // Rough release date estimation
        if (setId.startsWith('ex1')) return '2005/02/14';
        if (setId === 'col1') return '2011/02/09';
        if (setId.startsWith('sv')) {
            const svNum = parseInt(setId.slice(2));
            const baseDate = new Date('2023-03-31');
            baseDate.setMonth(baseDate.getMonth() + (svNum - 1) * 3);
            return baseDate.toISOString().split('T')[0].replace(/-/g, '/');
        }
        return '2020/01/01';
    }

    async downloadMissingSets() {
        console.log('📥 Downloading missing Pokemon TCG sets...');
        console.log('==========================================');
        
        this.createDirectories();

        let successCount = 0;
        let errorCount = 0;
        let totalCards = 0;

        console.log(`🎯 Attempting to download ${this.missingSets.length} missing sets...`);

        for (const setId of this.missingSets) {
            try {
                console.log(`\n📦 Downloading ${setId} (${this.setNameMap[setId]})...`);
                
                // Download cards for this set
                const cardUrl = `${this.baseUrl}/cards/en/${setId}.json`;
                const cardPath = path.join(this.cardsDir, `${setId}.json`);
                
                await this.downloadFile(cardUrl, cardPath);
                
                // Read the cards to extract set info and count
                const cardData = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
                
                if (Array.isArray(cardData) && cardData.length > 0) {
                    console.log(`   ✅ Downloaded ${cardData.length} cards`);
                    totalCards += cardData.length;
                    
                    // Extract set information from the first card
                    const setInfo = cardData[0].set || {
                        id: setId,
                        name: this.setNameMap[setId],
                        printedTotal: cardData.length,
                        total: cardData.length
                    };
                    
                    if (!this.downloadedSets.has(setInfo.id || setId)) {
                        await this.createSetFile({
                            id: setId,
                            name: this.setNameMap[setId],
                            printedTotal: setInfo.printedTotal || cardData.length,
                            total: setInfo.total || cardData.length,
                            series: this.getSeriesForSet(setId),
                            releaseDate: this.estimateReleaseDate(setId)
                        });
                        this.downloadedSets.add(setId);
                    }
                    
                    successCount++;
                } else {
                    console.log(`   ⚠️  Empty or invalid data`);
                    errorCount++;
                }
                
                // Small delay to be respectful
                await new Promise(resolve => setTimeout(resolve, 200));
                
            } catch (error) {
                console.log(`   ❌ Failed: ${error.message}`);
                errorCount++;
            }
        }

        console.log(`\n📊 Download Summary:`);
        console.log(`✅ Successful: ${successCount} sets`);
        console.log(`❌ Failed: ${errorCount} sets`);
        console.log(`🎴 Total new cards: ${totalCards}`);
        console.log(`📚 Sets created: ${this.downloadedSets.size}`);
        console.log(`📁 Data saved to: ${this.dataDir}`);

        return {
            cardsDir: this.cardsDir,
            setsDir: this.setsDir,
            successCount,
            totalCards,
            newSets: Array.from(this.downloadedSets)
        };
    }
}

async function main() {
    console.log('🚀 Missing Pokemon TCG Sets Downloader');
    console.log('======================================\n');

    const downloader = new MissingSetDownloader();
    
    try {
        const result = await downloader.downloadMissingSets();
        
        if (result.successCount > 0) {
            console.log('\n✅ Missing sets download completed!');
            console.log(`🎴 Downloaded ${result.totalCards} new cards from ${result.successCount} sets`);
            console.log('\n🎯 Next step: Run loadTCGData.js to add these cards to your database');
            console.log('Command: node scripts/loadTCGData.js');
        } else {
            console.log('\n❌ No sets downloaded successfully.');
        }
        
    } catch (error) {
        console.error('💥 Error:', error.message);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { MissingSetDownloader };