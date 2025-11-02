const https = require('https');
const fs = require('fs');
const path = require('path');

class PokemonTCGDownloader {
    constructor() {
        this.baseUrl = 'https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master';
        this.dataDir = path.join(__dirname, '..', 'tcg-data');
        this.cardsDir = path.join(this.dataDir, 'cards', 'en');
        this.setsDir = path.join(this.dataDir, 'sets', 'en');
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

    async downloadCardsAndCreateSets() {
        console.log('📥 Downloading Pokemon TCG cards and extracting set data...');
        
        this.createDirectories();

        // List of known card sets to download
        const knownSets = [
            'base1', 'base2', 'base3', 'base4', 'base5',
            'gym1', 'gym2', 
            'neo1', 'neo2', 'neo3', 'neo4',
            'ecard1', 'ecard2', 'ecard3',
            'ex1', 'ex2', 'ex3', 'ex4', 'ex5', 'ex6', 'ex7', 'ex8', 'ex9', 'ex10',
            'dp1', 'dp2', 'dp3', 'dp4', 'dp5', 'dp6', 'dp7',
            'pl1', 'pl2', 'pl3', 'pl4',
            'hgss1', 'hgss2', 'hgss3', 'hgss4',
            'bw1', 'bw2', 'bw3', 'bw4', 'bw5', 'bw6', 'bw7', 'bw8', 'bw9', 'bw10', 'bw11',
            'xy1', 'xy2', 'xy3', 'xy4', 'xy5', 'xy6', 'xy7', 'xy8', 'xy9', 'xy10', 'xy11', 'xy12',
            'sm1', 'sm2', 'sm3', 'sm4', 'sm5', 'sm6', 'sm7', 'sm8', 'sm9', 'sm10', 'sm11', 'sm12',
            'swsh1', 'swsh2', 'swsh3', 'swsh4', 'swsh5', 'swsh6', 'swsh7', 'swsh8', 'swsh9', 'swsh10', 'swsh11', 'swsh12'
        ];

        let successCount = 0;
        let errorCount = 0;
        let totalCards = 0;

        console.log(`🎯 Attempting to download ${knownSets.length} card sets...`);

        for (const setId of knownSets) {
            try {
                console.log(`📦 Downloading ${setId}...`);
                
                // Download cards for this set
                const cardUrl = `${this.baseUrl}/cards/en/${setId}.json`;
                const cardPath = path.join(this.cardsDir, `${setId}.json`);
                
                await this.downloadFile(cardUrl, cardPath);
                
                // Read the cards to extract set info
                const cardData = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
                
                if (Array.isArray(cardData) && cardData.length > 0) {
                    console.log(`   ✅ Downloaded ${cardData.length} cards`);
                    totalCards += cardData.length;
                    
                    // Extract set information from the first card
                    const setInfo = cardData[0].set;
                    if (setInfo && !this.downloadedSets.has(setInfo.id)) {
                        await this.createSetFile(setInfo);
                        this.downloadedSets.add(setInfo.id);
                    }
                    
                    successCount++;
                } else {
                    console.log(`   ⚠️  Empty or invalid data`);
                    errorCount++;
                }
                
                // Small delay to be respectful
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.log(`   ❌ Failed: ${error.message}`);
                errorCount++;
            }
        }

        console.log(`\n📊 Download Summary:`);
        console.log(`✅ Successful: ${successCount} sets`);
        console.log(`❌ Failed: ${errorCount} sets`);
        console.log(`🎴 Total cards: ${totalCards}`);
        console.log(`📚 Sets extracted: ${this.downloadedSets.size}`);
        console.log(`📁 Data saved to: ${this.dataDir}`);

        return {
            cardsDir: this.cardsDir,
            setsDir: this.setsDir,
            successCount,
            totalCards
        };
    }

    async createSetFile(setInfo) {
        try {
            const setPath = path.join(this.setsDir, `${setInfo.id}.json`);
            
            // Create a single-item array for consistency with the loader
            const setData = [{
                id: setInfo.id,
                name: setInfo.name,
                series: setInfo.series,
                printedTotal: setInfo.printedTotal,
                total: setInfo.total,
                legalities: setInfo.legalities,
                ptcgoCode: setInfo.ptcgoCode,
                releaseDate: setInfo.releaseDate,
                updatedAt: setInfo.updatedAt,
                images: setInfo.images
            }];
            
            fs.writeFileSync(setPath, JSON.stringify(setData, null, 2));
            console.log(`   📚 Created set file: ${setInfo.name}`);
            
        } catch (error) {
            console.log(`   ⚠️  Failed to create set file: ${error.message}`);
        }
    }
}

async function main() {
    console.log('🚀 Pokemon TCG Data Downloader (Fixed)');
    console.log('======================================\n');

    const downloader = new PokemonTCGDownloader();
    
    try {
        const result = await downloader.downloadCardsAndCreateSets();
        
        if (result.successCount > 0) {
            console.log('\n✅ Data download completed!');
            console.log(`🎴 Downloaded ${result.totalCards} cards from ${result.successCount} sets`);
            console.log('Next step: Run loadTCGData.js to populate your database.');
        } else {
            console.log('\n❌ No data downloaded successfully.');
        }
        
    } catch (error) {
        console.error('💥 Error:', error.message);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { PokemonTCGDownloader };