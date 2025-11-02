/**
 * Download TCG Data for Cloud Hosting
 * 
 * This script downloads essential Pokemon TCG data on startup for cloud hosting platforms
 * where we can't include the large tcg-data folder in the repository.
 */

const fs = require('fs').promises;
const path = require('path');
const https = require('https');

class TCGDataDownloader {
    constructor() {
        this.tcgDataPath = path.join(__dirname, '..', 'tcg-data');
        this.essentialSets = [
            // Most popular/essential sets for initial deployment (reduced for faster deployment)
            'base1',    // Base Set
            'sv1',      // Scarlet & Violet Base  
            'swsh1'     // Sword & Shield Base
        ];
        
        // GitHub raw URLs for backup data (if needed)
        this.backupDataUrl = 'https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/cards/en/';
    }

    /**
     * Check if TCG data directory exists and has content
     */
    async checkTCGDataExists() {
        try {
            const tcgStats = await fs.stat(this.tcgDataPath);
            if (!tcgStats.isDirectory()) return false;
            
            const cardsDir = path.join(this.tcgDataPath, 'cards', 'en');
            const cardsDirStats = await fs.stat(cardsDir);
            if (!cardsDirStats.isDirectory()) return false;
            
            const files = await fs.readdir(cardsDir);
            const jsonFiles = files.filter(f => f.endsWith('.json'));
            
            console.log(`📂 Found ${jsonFiles.length} TCG data files`);
            return jsonFiles.length > 0;
        } catch (error) {
            console.log('📂 TCG data directory not found, will create...');
            return false;
        }
    }

    /**
     * Create necessary directory structure
     */
    async createDirectories() {
        const dirs = [
            this.tcgDataPath,
            path.join(this.tcgDataPath, 'cards'),
            path.join(this.tcgDataPath, 'cards', 'en'),
            path.join(this.tcgDataPath, 'sets'),
            path.join(this.tcgDataPath, 'sets', 'en')
        ];

        for (const dir of dirs) {
            try {
                await fs.mkdir(dir, { recursive: true });
                console.log(`📁 Created directory: ${path.basename(dir)}`);
            } catch (error) {
                if (error.code !== 'EEXIST') {
                    console.error(`❌ Error creating directory ${dir}:`, error.message);
                }
            }
        }
    }

    /**
     * Download a single file from URL
     */
    async downloadFile(url, filePath) {
        return new Promise((resolve, reject) => {
            const file = require('fs').createWriteStream(filePath);
            
            https.get(url, (response) => {
                if (response.statusCode === 200) {
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        resolve();
                    });
                } else {
                    file.close();
                    fs.unlink(filePath).catch(() => {}); // Clean up partial file
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                }
            }).on('error', (error) => {
                file.close();
                fs.unlink(filePath).catch(() => {}); // Clean up partial file
                reject(error);
            });
        });
    }

    /**
     * Download essential TCG data files
     */
    async downloadEssentialSets() {
        console.log('🌐 Downloading essential TCG data...');
        
        let successCount = 0;
        let errorCount = 0;

        for (const setId of this.essentialSets) {
            const fileName = `${setId}.json`;
            const filePath = path.join(this.tcgDataPath, 'cards', 'en', fileName);
            
            try {
                // Check if file already exists
                try {
                    await fs.access(filePath);
                    console.log(`✅ ${fileName} already exists, skipping...`);
                    continue;
                } catch {
                    // File doesn't exist, proceed with download
                }

                const url = `${this.backupDataUrl}${fileName}`;
                console.log(`⬇️  Downloading ${fileName}...`);
                
                await this.downloadFile(url, filePath);
                
                // Verify the download
                const stats = await fs.stat(filePath);
                if (stats.size > 0) {
                    console.log(`✅ Downloaded ${fileName} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
                    successCount++;
                } else {
                    console.log(`⚠️  Downloaded ${fileName} but file is empty`);
                    errorCount++;
                }
                
                // Small delay to be respectful to the server
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.error(`❌ Failed to download ${fileName}:`, error.message);
                errorCount++;
            }
        }

        console.log(`📊 Download complete: ${successCount} successful, ${errorCount} failed`);
        return { successCount, errorCount };
    }

    /**
     * Create a minimal sets data structure
     */
    async createMinimalSetsData() {
        const setsData = {
            base1: { id: 'base1', name: 'Base Set', series: 'Base', total: 102 },
            base2: { id: 'base2', name: 'Jungle', series: 'Base', total: 64 },
            base3: { id: 'base3', name: 'Fossil', series: 'Base', total: 62 },
            sv1: { id: 'sv1', name: 'Scarlet & Violet', series: 'Scarlet & Violet', total: 198 },
            sv2: { id: 'sv2', name: 'Paldea Evolved', series: 'Scarlet & Violet', total: 193 },
            swsh1: { id: 'swsh1', name: 'Sword & Shield', series: 'Sword & Shield', total: 202 },
            sm1: { id: 'sm1', name: 'Sun & Moon', series: 'Sun & Moon', total: 149 }
        };

        const setsFilePath = path.join(this.tcgDataPath, 'sets', 'en', 'sets.json');
        
        try {
            await fs.writeFile(setsFilePath, JSON.stringify(setsData, null, 2));
            console.log('📝 Created minimal sets data');
        } catch (error) {
            console.error('❌ Error creating sets data:', error.message);
        }
    }

    /**
     * Main function to ensure TCG data is available
     */
    async ensureTCGData() {
        console.log('🎴 Checking TCG data availability...');
        
        const hasData = await this.checkTCGDataExists();
        
        if (hasData) {
            console.log('✅ TCG data already available');
            return true;
        }

        console.log('📥 TCG data not found, downloading...');
        
        try {
            await this.createDirectories();
            const result = await this.downloadEssentialSets();
            await this.createMinimalSetsData();
            
            if (result.successCount > 0) {
                console.log('✅ TCG data download completed successfully');
                return true;
            } else {
                console.log('⚠️  No TCG data was downloaded successfully');
                return false;
            }
        } catch (error) {
            console.error('❌ Error downloading TCG data:', error.message);
            return false;
        }
    }

    /**
     * Get download status
     */
    async getDownloadStatus() {
        const hasData = await this.checkTCGDataExists();
        
        if (!hasData) {
            return { status: 'missing', message: 'TCG data not available' };
        }

        try {
            const cardsDir = path.join(this.tcgDataPath, 'cards', 'en');
            const files = await fs.readdir(cardsDir);
            const jsonFiles = files.filter(f => f.endsWith('.json'));
            
            let totalSize = 0;
            for (const file of jsonFiles) {
                const filePath = path.join(cardsDir, file);
                const stats = await fs.stat(filePath);
                totalSize += stats.size;
            }
            
            return {
                status: 'available',
                fileCount: jsonFiles.length,
                totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
                files: jsonFiles
            };
        } catch (error) {
            return { status: 'error', message: error.message };
        }
    }
}

module.exports = TCGDataDownloader;

// If run directly, execute the download
if (require.main === module) {
    const downloader = new TCGDataDownloader();
    downloader.ensureTCGData()
        .then(success => {
            if (success) {
                console.log('🎉 TCG data is ready!');
                process.exit(0);
            } else {
                console.log('❌ Failed to prepare TCG data');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('❌ Download error:', error);
            process.exit(1);
        });
}