/**
 * CollectorShopManager - Manages the Collector's Shop (Tycoon Model)
 * 
 * This system allows players to run their own virtual card shop with departments
 * that passively generate resources (coins and cards) over time.
 */

class CollectorShopManager {
    constructor(database) {
        this.db = database;
        this.dbType = database.dbType || 'sqlite';
        
        // Department configurations with progression formulas
        this.departments = {
            trade_counter: {
                name: 'Trade Counter',
                emoji: '💰',
                resource: 'coins',
                unlockLevel: 1,
                description: 'Generates coins passively',
                baseGeneration: 50,      // coins/hour at level 1
                generationGrowth: 1.5,   // Multiplier per level
                baseCapacity: 500,       // capacity at level 1
                capacityGrowth: 1.5,     // Multiplier per level
                fillTime: 10,            // Hours to fill (kept consistent)
                upgradeCost: 500,        // Base upgrade cost
                costGrowth: 1.3          // Cost multiplier per level
            },
            bulk_bin: {
                name: 'Bulk Bin',
                emoji: '📦',
                resource: 'cards',
                unlockLevel: 5,
                description: 'Generates Common cards',
                baseGeneration: 0.25,    // 1 card per 4 hours at level 1
                generationGrowth: 1.33,  // Increases generation rate
                baseCapacity: 6,         // 6 cards at level 1
                capacityGrowth: 1.33,    // Increases capacity
                fillTime: 24,            // Hours to fill
                upgradeCost: 2000,
                costGrowth: 1.4
            },
            glass_case: {
                name: 'Glass Display Case',
                emoji: '💎',
                resource: 'upgrade_chance',
                unlockLevel: 10,
                description: 'Chance to upgrade card rarity',
                baseChance: 0.01,        // 1% at level 1
                chanceGrowth: 0.005,     // +0.5% per level
                specialUnlock: 6,        // Level 6 unlocks holo chance
                upgradeCost: 5000,
                costGrowth: 1.5
            },
            pack_storage: {
                name: 'Pack Storage Room',
                emoji: '🎁',
                resource: 'packs',
                unlockLevel: 15,
                description: 'Generates sealed booster packs',
                baseChance: 0.01,        // 1% per hour at level 1
                chanceGrowth: 0.002,     // +0.2% per level
                baseCapacity: 1,
                capacityGrowth: 0.2,     // +0.2 capacity per level (at lvl 6 = 2)
                upgradeCost: 10000,
                costGrowth: 1.6
            },
            expert_grader: {
                name: 'Expert Grader',
                emoji: '⭐',
                resource: 'quality_boost',
                unlockLevel: 20,
                description: 'Improves card quality on collection',
                baseChance: 0.05,        // 5% at level 1
                chanceGrowth: 0.02,      // +2% per level
                upgradeCost: 15000,
                costGrowth: 1.7
            }
        };
    }

    /**
     * Initialize database tables for collector shop system
     */
    async initializeTables() {
        try {
            // Main shop data (global shop level)
            await this.db.run(`
                CREATE TABLE IF NOT EXISTS collector_shops (
                    user_id TEXT PRIMARY KEY,
                    shop_level INTEGER DEFAULT 1,
                    total_upgrades INTEGER DEFAULT 0,
                    lifetime_coins_generated ${this.dbType === 'postgresql' ? 'BIGINT' : 'INTEGER'} DEFAULT 0,
                    lifetime_cards_generated INTEGER DEFAULT 0,
                    created_at ${this.dbType === 'postgresql' ? 'BIGINT' : 'INTEGER'} DEFAULT ${Date.now()},
                    updated_at ${this.dbType === 'postgresql' ? 'BIGINT' : 'INTEGER'} DEFAULT ${Date.now()}
                )
            `);

            // Department levels and configurations
            await this.db.run(`
                CREATE TABLE IF NOT EXISTS collector_departments (
                    user_id TEXT,
                    department_id TEXT,
                    level INTEGER DEFAULT 0,
                    total_upgrades INTEGER DEFAULT 0,
                    last_collected_at ${this.dbType === 'postgresql' ? 'BIGINT' : 'INTEGER'} DEFAULT ${Date.now()},
                    PRIMARY KEY (user_id, department_id)
                )
            `);

            // Storage for generated resources
            await this.db.run(`
                CREATE TABLE IF NOT EXISTS collector_storage (
                    user_id TEXT,
                    department_id TEXT,
                    coins_stored INTEGER DEFAULT 0,
                    cards_stored INTEGER DEFAULT 0,
                    packs_stored INTEGER DEFAULT 0,
                    last_generation_at ${this.dbType === 'postgresql' ? 'BIGINT' : 'INTEGER'} DEFAULT ${Date.now()},
                    PRIMARY KEY (user_id, department_id)
                )
            `);

            console.log('✅ Collector shop tables initialized');
            return true;

        } catch (error) {
            console.error('❌ Error initializing collector shop tables:', error);
            return false;
        }
    }

    /**
     * Get or create a user's collector shop
     */
    async getOrCreateShop(userId) {
        try {
            let shop = await this.db.get(
                'SELECT * FROM collector_shops WHERE user_id = ?',
                [userId]
            );

            if (!shop) {
                // Create new shop with Trade Counter unlocked
                await this.db.run(`
                    INSERT INTO collector_shops (user_id, shop_level, created_at, updated_at)
                    VALUES (?, 1, ?, ?)
                `, [userId, Date.now(), Date.now()]);

                // Unlock Trade Counter department (level 1 unlock)
                await this.db.run(`
                    INSERT INTO collector_departments (user_id, department_id, level, last_collected_at)
                    VALUES (?, 'trade_counter', 1, ?)
                `, [userId, Date.now()]);

                // Initialize storage for Trade Counter
                await this.db.run(`
                    INSERT INTO collector_storage (user_id, department_id, last_generation_at)
                    VALUES (?, 'trade_counter', ?)
                `, [userId, Date.now()]);

                shop = await this.db.get(
                    'SELECT * FROM collector_shops WHERE user_id = ?',
                    [userId]
                );
            }

            return shop;

        } catch (error) {
            console.error('Error getting/creating shop:', error);
            return null;
        }
    }

    /**
     * Get all departments for a user
     */
    async getUserDepartments(userId) {
        try {
            const departments = await this.db.all(
                'SELECT * FROM collector_departments WHERE user_id = ? ORDER BY level DESC',
                [userId]
            );
            return departments || [];
        } catch (error) {
            console.error('Error getting user departments:', error);
            return [];
        }
    }

    /**
     * Calculate passive generation for a department
     */
    calculateGeneration(departmentId, level, hoursSinceCollection) {
        const config = this.departments[departmentId];
        if (!config) return { generated: 0, capacity: 0, fillTime: 0 };

        if (config.resource === 'coins') {
            // Coins generation
            const rate = config.baseGeneration * Math.pow(config.generationGrowth, level - 1);
            const capacity = config.baseCapacity * Math.pow(config.capacityGrowth, level - 1);
            const generated = Math.min(Math.floor(rate * hoursSinceCollection), capacity);
            
            return {
                generated,
                capacity: Math.floor(capacity),
                rate: Math.floor(rate),
                fillTime: config.fillTime
            };
        }

        if (config.resource === 'cards') {
            // Cards generation
            const rate = config.baseGeneration * Math.pow(config.generationGrowth, level - 1);
            const capacity = config.baseCapacity * Math.pow(config.capacityGrowth, level - 1);
            const generated = Math.min(Math.floor(rate * hoursSinceCollection), Math.floor(capacity));
            
            return {
                generated,
                capacity: Math.floor(capacity),
                rate: parseFloat(rate.toFixed(2)),
                fillTime: config.fillTime
            };
        }

        if (config.resource === 'packs') {
            // Pack generation (chance-based)
            const chance = config.baseChance + (config.chanceGrowth * (level - 1));
            const capacity = Math.floor(config.baseCapacity + (config.capacityGrowth * (level - 1)));
            
            // Calculate how many packs generated based on hourly chance
            let packs = 0;
            for (let i = 0; i < hoursSinceCollection; i++) {
                if (Math.random() < chance && packs < capacity) {
                    packs++;
                }
            }
            
            return {
                generated: packs,
                capacity,
                chance: (chance * 100).toFixed(2) + '%',
                fillTime: 'Variable'
            };
        }

        // Passive upgrades (glass case, expert grader) don't generate, just provide buffs
        return { generated: 0, capacity: 0, rate: 0 };
    }

    /**
     * Get storage and calculate current generation for a department
     */
    async getDepartmentStatus(userId, departmentId, departmentLevel) {
        try {
            const storage = await this.db.get(
                'SELECT * FROM collector_storage WHERE user_id = ? AND department_id = ?',
                [userId, departmentId]
            );

            const dept = await this.db.get(
                'SELECT * FROM collector_departments WHERE user_id = ? AND department_id = ?',
                [userId, departmentId]
            );

            if (!storage || !dept) {
                return null;
            }

            // Calculate time elapsed since last collection
            const now = Date.now();
            const lastCollection = dept.last_collected_at || now;
            const hoursElapsed = (now - lastCollection) / (1000 * 60 * 60);

            // Calculate generation
            const generation = this.calculateGeneration(departmentId, departmentLevel, hoursElapsed);

            return {
                ...storage,
                ...generation,
                hoursElapsed: hoursElapsed.toFixed(2),
                level: departmentLevel
            };

        } catch (error) {
            console.error('Error getting department status:', error);
            return null;
        }
    }

    /**
     * Collect resources from a department
     */
    async collectDepartment(userId, departmentId) {
        try {
            const dept = await this.db.get(
                'SELECT * FROM collector_departments WHERE user_id = ? AND department_id = ?',
                [userId, departmentId]
            );

            if (!dept || dept.level === 0) {
                return { success: false, error: 'Department not unlocked' };
            }

            const status = await this.getDepartmentStatus(userId, departmentId, dept.level);
            if (!status) {
                return { success: false, error: 'Could not get department status' };
            }

            const config = this.departments[departmentId];
            const collected = {
                coins: 0,
                cards: 0,
                packs: 0
            };

            if (config.resource === 'coins') {
                collected.coins = status.generated;
            } else if (config.resource === 'cards') {
                collected.cards = status.generated;
            } else if (config.resource === 'packs') {
                collected.packs = status.generated;
            }

            // Reset storage and update last collection time
            await this.db.run(`
                UPDATE collector_storage
                SET coins_stored = 0, cards_stored = 0, packs_stored = 0, last_generation_at = ?
                WHERE user_id = ? AND department_id = ?
            `, [Date.now(), userId, departmentId]);

            await this.db.run(`
                UPDATE collector_departments
                SET last_collected_at = ?
                WHERE user_id = ? AND department_id = ?
            `, [Date.now(), userId, departmentId]);

            // Update lifetime stats
            await this.db.run(`
                UPDATE collector_shops
                SET lifetime_coins_generated = lifetime_coins_generated + ?,
                    lifetime_cards_generated = lifetime_cards_generated + ?,
                    updated_at = ?
                WHERE user_id = ?
            `, [collected.coins, collected.cards, Date.now(), userId]);

            return {
                success: true,
                collected,
                departmentName: config.name
            };

        } catch (error) {
            console.error('Error collecting from department:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Collect from all available departments
     */
    async collectAll(userId) {
        try {
            const departments = await this.getUserDepartments(userId);
            const results = {
                coins: 0,
                cards: 0,
                packs: 0,
                departments: []
            };

            for (const dept of departments) {
                if (dept.level > 0) {
                    const result = await this.collectDepartment(userId, dept.department_id);
                    if (result.success) {
                        results.coins += result.collected.coins;
                        results.cards += result.collected.cards;
                        results.packs += result.collected.packs;
                        results.departments.push({
                            name: result.departmentName,
                            collected: result.collected
                        });
                    }
                }
            }

            return { success: true, results };

        } catch (error) {
            console.error('Error collecting all:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Calculate global shop upgrade cost
     */
    getGlobalUpgradeCost(currentLevel) {
        return Math.floor(1000 * Math.pow(1.5, currentLevel - 1));
    }

    /**
     * Upgrade global shop level
     */
    async upgradeShopLevel(userId, userGold) {
        try {
            const shop = await this.getOrCreateShop(userId);
            const cost = this.getGlobalUpgradeCost(shop.shop_level);

            if (userGold < cost) {
                return { 
                    success: false, 
                    error: 'Insufficient gold',
                    cost,
                    currentGold: userGold
                };
            }

            const newLevel = shop.shop_level + 1;

            // Update shop level
            await this.db.run(`
                UPDATE collector_shops
                SET shop_level = ?,
                    total_upgrades = total_upgrades + 1,
                    updated_at = ?
                WHERE user_id = ?
            `, [newLevel, Date.now(), userId]);

            // Check for department unlocks
            const unlockedDepartments = [];
            for (const [id, config] of Object.entries(this.departments)) {
                if (config.unlockLevel === newLevel) {
                    // Unlock this department
                    await this.db.run(`
                        INSERT OR IGNORE INTO collector_departments (user_id, department_id, level, last_collected_at)
                        VALUES (?, ?, 1, ?)
                    `, [userId, id, Date.now()]);

                    await this.db.run(`
                        INSERT OR IGNORE INTO collector_storage (user_id, department_id, last_generation_at)
                        VALUES (?, ?, ?)
                    `, [userId, id, Date.now()]);

                    unlockedDepartments.push(config.name);
                }
            }

            return {
                success: true,
                newLevel,
                cost,
                nextCost: this.getGlobalUpgradeCost(newLevel),
                unlockedDepartments
            };

        } catch (error) {
            console.error('Error upgrading shop level:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Calculate department upgrade cost
     */
    getDepartmentUpgradeCost(departmentId, currentLevel) {
        const config = this.departments[departmentId];
        if (!config) return 0;
        return Math.floor(config.upgradeCost * Math.pow(config.costGrowth, currentLevel - 1));
    }

    /**
     * Upgrade a specific department
     */
    async upgradeDepartment(userId, departmentId, userGold) {
        try {
            const shop = await this.getOrCreateShop(userId);
            const dept = await this.db.get(
                'SELECT * FROM collector_departments WHERE user_id = ? AND department_id = ?',
                [userId, departmentId]
            );

            if (!dept || dept.level === 0) {
                return { success: false, error: 'Department not unlocked' };
            }

            // Check if department level would exceed shop level
            if (dept.level >= shop.shop_level) {
                return { 
                    success: false, 
                    error: `Department level cannot exceed Shop Level (${shop.shop_level})`,
                    shopLevel: shop.shop_level
                };
            }

            const cost = this.getDepartmentUpgradeCost(departmentId, dept.level);

            if (userGold < cost) {
                return { 
                    success: false, 
                    error: 'Insufficient gold',
                    cost,
                    currentGold: userGold
                };
            }

            const newLevel = dept.level + 1;

            await this.db.run(`
                UPDATE collector_departments
                SET level = ?,
                    total_upgrades = total_upgrades + 1
                WHERE user_id = ? AND department_id = ?
            `, [newLevel, userId, departmentId]);

            const config = this.departments[departmentId];

            return {
                success: true,
                departmentName: config.name,
                newLevel,
                cost,
                nextCost: this.getDepartmentUpgradeCost(departmentId, newLevel)
            };

        } catch (error) {
            console.error('Error upgrading department:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get passive upgrade buffs (Glass Case, Expert Grader)
     */
    async getPassiveBuffs(userId) {
        try {
            const departments = await this.getUserDepartments(userId);
            const buffs = {
                upgradeChance: 0,
                holoChance: 0,
                qualityBoost: 0
            };

            for (const dept of departments) {
                if (dept.department_id === 'glass_case' && dept.level > 0) {
                    const config = this.departments.glass_case;
                    buffs.upgradeChance = config.baseChance + (config.chanceGrowth * (dept.level - 1));
                    
                    // Unlock holo chance at level 6+
                    if (dept.level >= config.specialUnlock) {
                        buffs.holoChance = 0.005; // 0.5% chance for holo rare
                    }
                }

                if (dept.department_id === 'expert_grader' && dept.level > 0) {
                    const config = this.departments.expert_grader;
                    buffs.qualityBoost = config.baseChance + (config.chanceGrowth * (dept.level - 1));
                }
            }

            return buffs;

        } catch (error) {
            console.error('Error getting passive buffs:', error);
            return { upgradeChance: 0, holoChance: 0, qualityBoost: 0 };
        }
    }
}

module.exports = CollectorShopManager;
