/**
 * Episode 110: Comprehensive Debug Manager
 * Systematic debugging tool for hunting down all remaining PostgreSQL issues
 */

class DebugManager {
    constructor() {
        // Enable/disable debugging per command
        this.debugConfig = {
            zam: true,        // "No Cards Available" mystery
            profile: true,    // Recently fixed star_level, check for more issues
            daily: false,     // Working, but monitor
            start: false,     // Working perfectly
            shop: false,      // Working, but monitor
            inventory: true,  // Not tested yet
            use: true,        // Not tested yet  
            leaderboard: true, // Not tested yet
            quest: true,      // Quest command debugging
            global: true      // Overall system debugging
        };
    }

    // Deep debug for ZAM command
    debugZam(context) {
        if (!this.debugConfig.zam) return;
        
        console.log('\n🔍 ===== ZAM COMMAND DEBUG =====');
        console.log('🎯 User Level:', context.userLevel);
        console.log('🎯 Guild Luck Bonus:', context.guildLuckBonus);
        console.log('🎯 Unlocked Generations:', context.unlockedGenerations);
        console.log('🎯 Cards Count in DB:', context.totalCardsInDB);
        console.log('🎯 Drawn Card Result:', context.drawnCard);
        console.log('🎯 Card Selection Parameters:', {
            level: context.userLevel,
            guildBonus: context.guildLuckBonus,
            availableGens: context.unlockedGenerations?.length || 0
        });
        console.log('===== ZAM DEBUG END =====\n');
    }

    // Deep debug for PROFILE command  
    debugProfile(context) {
        if (!this.debugConfig.profile) return;
        
        console.log('\n🔍 ===== PROFILE COMMAND DEBUG =====');
        console.log('👤 User ID:', context.userId);
        console.log('👤 User Data:', context.userData);
        console.log('📊 Collection Stats Query Result:', context.collectionStats);
        console.log('📊 Set Stats Query Result:', context.setStats);
        console.log('🎮 Level Info:', context.levelInfo);
        console.log('===== PROFILE DEBUG END =====\n');
    }

    // Deep debug for INVENTORY command
    debugInventory(context) {
        if (!this.debugConfig.inventory) return;
        
        console.log('\n🔍 ===== INVENTORY COMMAND DEBUG =====');
        console.log('🎒 User ID:', context.userId);
        console.log('🎒 Items Query Result:', context.items);
        console.log('🎒 Item Count:', context.items?.length || 0);
        console.log('===== INVENTORY DEBUG END =====\n');
    }

    // Deep debug for USE command
    debugUse(context) {
        if (!this.debugConfig.use) return;
        
        console.log('\n🔍 ===== USE COMMAND DEBUG =====');
        console.log('⚡ User ID:', context.userId);
        console.log('⚡ Item ID:', context.itemId);
        console.log('⚡ Item Data:', context.itemData);
        console.log('⚡ Use Result:', context.useResult);
        console.log('===== USE DEBUG END =====\n');
    }

    // Global system debugging
    debugSystem(context) {
        if (!this.debugConfig.global) return;
        
        console.log('\n🔍 ===== SYSTEM DEBUG =====');
        console.log('🗄️ Database Connection:', context.dbStatus);
        console.log('🗄️ Cards Loaded:', context.cardsLoaded);
        console.log('🗄️ Schema Version:', context.schemaVersion);
        console.log('===== SYSTEM DEBUG END =====\n');
    }

    // Database query debugging
    debugQuery(queryName, query, params, result, error = null) {
        if (!this.debugConfig.global) return;
        
        console.log(`\n🔍 ===== QUERY DEBUG: ${queryName} =====`);
        console.log('📝 SQL:', query);
        console.log('🔢 Parameters:', params);
        if (error) {
            console.log('❌ Error:', error.message);
            console.log('❌ Error Code:', error.code);
            console.log('❌ Error Detail:', error.detail);
        } else {
            console.log('✅ Result Count:', Array.isArray(result) ? result.length : (result ? 1 : 0));
            console.log('✅ First Result:', Array.isArray(result) ? result[0] : result);
        }
        console.log(`===== QUERY DEBUG END: ${queryName} =====\n`);
    }

    // Enable/disable debugging for specific command
    setDebug(command, enabled) {
        this.debugConfig[command] = enabled;
        console.log(`🔧 Debug ${enabled ? 'ENABLED' : 'DISABLED'} for: ${command}`);
    }

    // Enable all debugging
    enableAll() {
        Object.keys(this.debugConfig).forEach(key => {
            this.debugConfig[key] = true;
        });
        console.log('🔧 ALL DEBUGGING ENABLED');
    }

    // Disable all debugging  
    disableAll() {
        Object.keys(this.debugConfig).forEach(key => {
            this.debugConfig[key] = false;
        });
        console.log('🔧 ALL DEBUGGING DISABLED');
    }
}

module.exports = new DebugManager();