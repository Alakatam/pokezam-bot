/**
 * Auto-trigger to force reload base sets on next startup
 * This creates a flag file that tells the bot to reload base1, base2, base3
 * 
 * Run this once, commit, and push - bot will reload sets on next deploy
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Creating base sets reload trigger...');

const flagFile = path.join(__dirname, '..', '.force_reload_base_sets');

try {
    fs.writeFileSync(flagFile, 'DELETE');
    console.log('✅ Reload trigger created!');
    console.log('📝 Flag file:', flagFile);
    console.log('');
    console.log('🚀 NEXT STEPS:');
    console.log('   1. Commit and push this change');
    console.log('   2. Bot will detect flag on startup');
    console.log('   3. Base sets will be reloaded automatically');
    console.log('   4. Jungle and Fossil sets will be loaded!');
} catch (error) {
    console.error('❌ Failed to create trigger:', error.message);
    process.exit(1);
}
