/**
 * Centralized Configuration Management for Pokézam Bot
 * Consolidates all configuration values for better maintainability
 */

class BotConfig {
    constructor() {
        // Database Configuration
        this.database = {
            // Progressive loading settings
            progressiveLoading: {
                batchSize: 50,
                memoryCleanupInterval: 200, // cards
                progressReportInterval: 100, // cards
                requestTimeout: 15000, // ms
                retryDelay: 1000, // ms between sets
            },
            
            // Performance settings
            performance: {
                cooldownCleanupInterval: 60000, // 1 minute
                memoryMonitorInterval: 600000, // 10 minutes 
                healthCheckInterval: 1800000, // 30 minutes
                maxMemoryThresholdMB: 400,
                cooldownRetentionTime: 300000, // 5 minutes
            },
            
            // Query optimization
            queryLimits: {
                maxCardBatch: 1000,
                maxUserBatch: 100,
                defaultQueryTimeout: 10000,
            }
        };

        // Card System Configuration
        this.cards = {
            // Rarity system
            rarities: {
                common: { xp: 1, goldRange: [100, 250] },
                uncommon: { xp: 2, goldRange: [250, 400] },
                rare: { xp: 5, goldRange: [400, 1000] },
                holo: { xp: 10, goldRange: [1000, 2000] },
                ultra: { xp: 25, goldRange: [2000, 5000] },
                secret: { xp: 50, goldRange: [5000, 10000] }
            },
            
            // Master Set variants
            variants: {
                normal: { multiplier: 1.0, xpBonus: 0, emoji: '🎴' },
                reverse: { multiplier: 1.2, xpBonus: 2, emoji: '🔄' },
                holo: { multiplier: 1.5, xpBonus: 5, emoji: '✨' },
                firstEdition: { multiplier: 2.0, xpBonus: 10, emoji: '🥇' },
                promo: { multiplier: 1.8, xpBonus: 8, emoji: '⭐' }
            },
            
            // Generation unlock levels
            generationUnlocks: {
                1: 1,    // Generation I
                2: 10,   // Generation II
                3: 35,   // Generation III
                4: 60,   // Generation IV
                5: 110,  // Generation V
                6: 130,  // Generation VI
                7: 150,  // Generation VII
                8: 170,  // Generation VIII
                9: 200   // Generation IX
            }
        };

        // Command Configuration
        this.commands = {
            cooldowns: {
                zam: 5000,        // 5 seconds
                start: 0,         // No cooldown
                profile: 3000,    // 3 seconds
                daily: 0,         // Handled by quest system
                shop: 2000,       // 2 seconds
                inventory: 2000,  // 2 seconds
                admin: 0          // No cooldown (bypass handled separately)
            },
            
            // Response optimization
            responses: {
                deferThreshold: 2000, // Defer reply if expected response time > 2s
                maxEmbedFields: 25,   // Discord limit
                maxDescriptionLength: 4096, // Discord limit
            }
        };

        // Quest System Configuration
        this.quests = {
            types: ['daily', 'weekly', 'monthly'],
            rewards: {
                daily: { goldMultiplier: 1.0, xpMultiplier: 1.0 },
                weekly: { goldMultiplier: 2.5, xpMultiplier: 2.0 },
                monthly: { goldMultiplier: 10.0, xpMultiplier: 5.0 }
            },
            autoAssignDelay: 500, // ms delay before auto-assigning quests
        };

        // Shop System Configuration  
        this.shop = {
            items: {
                // Item categories and pricing
                charms: {
                    priceMultiplier: 1.0,
                    durationMultiplier: 1.0
                },
                boosts: {
                    priceMultiplier: 0.8,
                    durationMultiplier: 1.2
                }
            },
            
            // Stock and availability
            restockInterval: 86400000, // 24 hours
            maxItemStock: 999,
        };

        // Performance Monitoring
        this.monitoring = {
            logLevel: process.env.LOG_LEVEL || 'info',
            enableMemoryMonitoring: true,
            enablePerformanceMetrics: true,
            
            // Memory thresholds
            memoryWarningThresholdMB: 300,
            memoryCriticalThresholdMB: 450,
            
            // Response time monitoring
            slowQueryThresholdMS: 1000,
            slowCommandThresholdMS: 3000,
        };

        // External Services
        this.external = {
            github: {
                repo: 'Alakatam/pokezam-bot',
                branch: 'main',
                timeout: 15000
            },
            
            discord: {
                globalShowcaseChannelId: '1434216182017167480',
                maxRetries: 3,
                retryDelay: 1000
            }
        };

        // Environment-specific overrides
        this.applyEnvironmentOverrides();
    }

    // Apply environment-specific configuration overrides
    applyEnvironmentOverrides() {
        // Production optimizations
        if (process.env.NODE_ENV === 'production') {
            this.database.progressiveLoading.batchSize = 100; // Larger batches in production
            this.monitoring.logLevel = 'warn'; // Less verbose logging
        }

        // Development optimizations
        if (process.env.NODE_ENV === 'development') {
            this.database.performance.cooldownCleanupInterval = 10000; // More frequent cleanup
            this.monitoring.enablePerformanceMetrics = true; // Always enabled in dev
        }

        // Render-specific optimizations
        if (process.env.PORT) { // Render sets PORT env var
            this.database.performance.maxMemoryThresholdMB = 450; // Closer to 512MB limit
            this.monitoring.memoryCriticalThresholdMB = 480; // Very close to limit
        }
    }

    // Get configuration for a specific system
    get(section) {
        return this[section] || {};
    }

    // Get a nested configuration value
    getValue(path) {
        const keys = path.split('.');
        let value = this;
        
        for (const key of keys) {
            value = value[key];
            if (value === undefined) return undefined;
        }
        
        return value;
    }

    // Update a configuration value (for runtime adjustments)
    setValue(path, newValue) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let target = this;
        
        for (const key of keys) {
            if (!target[key]) target[key] = {};
            target = target[key];
        }
        
        target[lastKey] = newValue;
    }
}

// Export singleton instance
const config = new BotConfig();
module.exports = config;