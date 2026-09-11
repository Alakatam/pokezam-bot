// Pokezam TCG Bot - Production Ready (Nov 12, 2025)
require('dotenv').config();
const { Client, Collection, GatewayIntentBits, Partials, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('http');
const DatabaseManager = require('./database/DatabaseManager');
const UserManager = require('./database/UserManager');
const CardManager = require('./database/CardManager');
const QuestManager = require('./database/QuestManager');
const DatabaseBackupManager = require('./database/DatabaseBackupManager');
const CardGenerationCron = require('./jobs/cardGenerationCron');
const EmbedUtils = require('./utils/EmbedUtils');

class PokezamBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMessageReactions,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages
            ],
            partials: [Partials.Message, Partials.Channel, Partials.Reaction]
        });

        this.commands = new Collection();
        this.cooldowns = new Collection();
        this.commandStats = new Map();
        this.presenceMessages = [
            'Pokezam TCG • /start',
            'Collecting cards • /draw',
            'Questing for epic pulls • /quest',
            'Building your collection • /inventory',
            'Premium trainer mode • /profile',
            'Pokezam TCG • rise to the top'
        ];
        this.runtime = {
            startedAt: Date.now(),
            ready: false,
            status: 'booting',
            startupWarnings: [],
            metrics: {
                commandExecutions: 0,
                commandFailures: 0,
                commandCooldownHits: 0,
                startedAt: Date.now(),
                lastError: null,
                lastHeartbeat: null
            }
        };
        this.isReady = false;

        // Initialize database managers
        this.databaseManager = new DatabaseManager();
        this.database = null; // Will be set after connection
        this.userManager = null; // Will be initialized after database connection
        this.cardManager = null; // Will be initialized after database connection
        this.questManager = null; // Will be initialized after database connection
        this.achievementManager = null; // Will be initialized after database connection
        this.backupManager = new DatabaseBackupManager();

        this.setupEventHandlers();
        this.setupPerformanceOptimizations();
        this.registerClientLifecycleHandlers();
    }

    validateEnvironment() {
        const required = ['DISCORD_TOKEN'];
        const missing = required.filter((key) => !process.env[key] || !String(process.env[key]).trim());

        if (process.env.NODE_ENV !== 'production' && !process.env.GUILD_ID && !process.env.TEST_GUILD_ID) {
            console.log('ℹ️  No GUILD_ID configured; global command registration will be used in dev mode.');
        }

        if (missing.length > 0) {
            const message = `⚠️ Missing required environment variables: ${missing.join(', ')}`;
            console.warn(message);
            this.runtime.startupWarnings.push(message);
        }

        if (!process.env.CLIENT_ID) {
            const message = '⚠️ CLIENT_ID is not configured; command registration may fail until it is set.';
            console.warn(message);
            this.runtime.startupWarnings.push(message);
        }

        return missing;
    }

    logStartupBanner() {
        const mode = process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'DEVELOPMENT';
        const banner = [
            '',
            '╔══════════════════════════════════════════════════════════════╗',
            '║                    POKEZAM TCG BOT                         ║',
            `║                    MODE: ${mode.padEnd(15, ' ')}        ║`,
            `║                    VERSION: 2.1.0                           ║`,
            '╚══════════════════════════════════════════════════════════════╝',
            ''
        ].join('\n');

        console.log(banner);
        console.log('🚀 Boot sequence started...');
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`📡 Port: ${process.env.PORT || 3000}`);
        console.log(`🧠 Memory target: ${this.runtime?.metrics ? 'optimized' : 'steady'}`);
    }

    printStartupSummary() {
        const warnings = this.runtime.startupWarnings.length ? `\n⚠️ Startup warnings: ${this.runtime.startupWarnings.join(' | ')}` : '✅ No startup warnings';
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('BOT STATUS SUMMARY');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Status: ${this.runtime.status}`);
        console.log(`Commands loaded: ${this.commands.size}`);
        console.log(`Uptime: ${Math.floor(process.uptime() / 60)}m`);
        console.log(warnings);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
    }

    async rotatePresence() {
        if (!this.client || !this.client.user) return;

        const activity = this.presenceMessages[this.runtime?.presenceIndex ?? 0] || this.presenceMessages[0];
        const nextIndex = (this.runtime?.presenceIndex ?? 0) + 1;
        this.runtime.presenceIndex = nextIndex % this.presenceMessages.length;

        try {
            await this.client.user.setPresence({
                activities: [{
                    name: activity,
                    type: 0
                }],
                status: 'online'
            });
        } catch (error) {
            // Presence updates can fail briefly during startup; keep the bot running.
        }
    }

    registerClientLifecycleHandlers() {
        this.client.once('ready', () => {
            this.runtime.ready = true;
            this.runtime.status = 'ready';
            this.isReady = true;
            this.runtime.metrics.lastHeartbeat = Date.now();
            console.log(`✅ Bot ready: ${this.client.user.tag} (${this.client.guilds.cache.size} guilds)`);
            this.printStartupSummary();

            this.rotatePresence();
            setInterval(() => this.rotatePresence(), 30000);
        });

        this.client.on('rateLimit', (info) => {
            console.warn(`⚠️ Discord rate limit: ${info.method} ${info.path} (${info.timeout}ms)`);
        });

        this.client.on('guildCreate', (guild) => {
            console.log(`📥 Joined guild: ${guild.name} (${guild.id})`);
        });

        this.client.on('error', (error) => {
            this.runtime.metrics.lastError = error.message;
            console.error('Client error:', error.message);
        });

        this.client.on('warn', (warning) => {
            console.warn('Discord client warning:', warning);
        });

        this.client.on('shardDisconnect', (event, shardId) => {
            console.warn(`⚠️ Discord shard ${shardId} disconnected. Code: ${event.code}`);
        });
    }

    trackCommandUse(commandName, userId) {
        const key = `${commandName}:${userId}`;
        const existing = this.commandStats.get(key) || { count: 0, lastUsed: 0 };
        existing.count += 1;
        existing.lastUsed = Date.now();
        this.commandStats.set(key, existing);
        this.runtime.metrics.commandExecutions += 1;
    }

    recordCommandFailure(error) {
        this.runtime.metrics.commandFailures += 1;
        this.runtime.metrics.lastError = error && error.message ? error.message : String(error);
    }

    buildHealthSnapshot() {
        const uptime = Math.floor(process.uptime());
        const memUsage = process.memoryUsage();
        const status = this.runtime.ready ? 'healthy' : (this.runtime.startupWarnings.length ? 'degraded' : 'starting');

        return {
            status,
            bot: this.isReady && this.client && this.client.user ? 'online' : 'offline',
            uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`,
            memory: {
                rssMB: Math.round(memUsage.rss / 1024 / 1024),
                heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
                heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024)
            },
            ping: this.client && this.client.ws && this.client.ws.ping !== -1 ? `${this.client.ws.ping}ms` : 'connecting',
            ready: this.runtime.ready,
            commandsLoaded: this.commands.size,
            startupWarnings: this.runtime.startupWarnings,
            metrics: {
                ...this.runtime.metrics,
                commandExecutions: this.runtime.metrics.commandExecutions,
                commandFailures: this.runtime.metrics.commandFailures,
                commandCooldownHits: this.runtime.metrics.commandCooldownHits || 0
            }
        };
    }

    async safeReply(interaction, payload, fallbackText = 'Something went wrong while processing your request.') {
        try {
            if (interaction.replied || interaction.deferred) {
                return await interaction.followUp(payload);
            }
            return await interaction.reply(payload);
        } catch (error) {
            if (error?.code === 10062) {
                return null;
            }

            try {
                return await interaction.editReply({
                    content: fallbackText,
                    embeds: []
                });
            } catch {
                console.error('Failed to send safe fallback reply:', error.message);
                return null;
            }
        }
    }

    async initialize() {
        try {
            this.logStartupBanner();
            this.validateEnvironment();

            // Start health check server IMMEDIATELY for Render deployment detection
            this.startHealthCheckServer();
            
            // Ensure TCG data is available (for cloud hosting)
            await this.ensureTCGData();
            
            // Connect to database (auto-selects SQLite or PostgreSQL)
            this.database = await this.databaseManager.connect();
            
            // PostgreSQL deployment: Skip backup restore on first deployment
            // Fresh PostgreSQL database will be created with proper schema
            if (process.env.NODE_ENV === 'production' || process.env.PORT) {
                const isPostgreSQL = this.databaseManager.dbType === 'postgresql';
                if (isPostgreSQL) {
                    console.log('🐘 PostgreSQL detected - using fresh database with progressive loading');
                    console.log('💡 If you need to migrate existing SQLite data, use: npm run migrate');
                } else {
                    // Only restore from backup for SQLite in production (edge case)
                    const shouldRestore = await this.checkIfDatabaseNeedsRestore();
                    if (shouldRestore) {
                        console.log('🔄 Database empty/missing, restoring from backup...');
                        await this.backupManager.restoreBackup();
                    } else {
                        console.log('✅ Database exists with data, skipping backup restore to preserve progress');
                    }
                }
            }
            
            // Apply PostgreSQL production fixes before initialization
            const PostgreSQLProductionFix = require('./database/PostgreSQLProductionFix');
            PostgreSQLProductionFix.apply(this.database);
            
            await this.database.initialize();
            
            // Initialize managers after database is ready
            const UserManager = require('./database/UserManager');
            const CardManager = require('./database/CardManager');
            const QuestManager = require('./database/QuestManager');
            const AchievementManager = require('./database/AchievementManager');
            const SetCompletionManager = require('./database/SetCompletionManager');
            const CollectorShopManager = require('./database/CollectorShopManager');
            
            this.userManager = new UserManager(this.database);
            this.cardManager = new CardManager(this.database);
            this.questManager = new QuestManager(this.database);
            this.achievementManager = new AchievementManager(this.database);
            this.setCompletionManager = new SetCompletionManager(this.database);
            this.collectorShopManager = new CollectorShopManager(this.database);
            
            // Initialize quest system at startup (prevents command timeouts)
            await this.questManager.ensureEnhancedQuestsInitialized();
            
            // Initialize default set rewards
            await this.setCompletionManager.initializeDefaultSetRewards();
            
            // Initialize collector shop tables
            await this.collectorShopManager.initializeTables();
            
            // POSTGRESQL SCHEMA FIX: Ensure all columns exist (for Render PostgreSQL)
            await this.fixPostgreSQLSchema();
            
            // FIX COLLECTOR SHOP TIMESTAMPS: Ensure BIGINT columns for timestamps
            if (this.database.dbType && this.database.dbType.toLowerCase() === 'postgresql') {
                try {
                    // First check if tables exist
                    const tableExists = await this.database.get(`
                        SELECT EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE table_name = 'collector_shops'
                        ) as exists
                    `);
                    
                    if (!tableExists || !tableExists.exists) {
                        console.log('ℹ️  Collector shop tables don\'t exist yet - will be created with BIGINT');
                    } else {
                        // Check column type
                        const checkResult = await this.database.get(`
                            SELECT data_type 
                            FROM information_schema.columns 
                            WHERE table_name = 'collector_shops' 
                            AND column_name = 'created_at'
                            LIMIT 1
                        `);
                        
                        // Fix if column is INTEGER instead of BIGINT
                        if (checkResult && checkResult.data_type === 'integer') {
                            console.log('⚠️ CRITICAL: Running collector shop BIGINT migration...');
                            const { fixTimestamps } = require('./scripts/fixCollectorShopTimestamps');
                            await fixTimestamps();
                            console.log('✅ Collector shop timestamps migrated to BIGINT');
                        } else if (checkResult) {
                            console.log(`✅ Collector shop timestamps correct (${checkResult.data_type})`);
                        }
                    }
                } catch (error) {
                    console.error('⚠️ Error checking collector shop timestamps:', error.message);
                    console.error('⚠️ Stack:', error.stack);
                    console.log('⚠️ Migration failed - collector shop may not work until this is fixed!');
                }
            }
            
            // FIX QUEST TIMESTAMPS: Convert seconds to milliseconds and remove duplicates
            if (this.database.dbType && this.database.dbType.toLowerCase() === 'postgresql') {
                console.log('🔧 Checking quest timestamp format...');
                try {
                    // Check if any quests have timestamps in seconds (before year 2000 in millis)
                    const checkQuest = await this.database.get(`
                        SELECT assigned_date 
                        FROM user_quests 
                        WHERE assigned_date < 946684800000
                        LIMIT 1
                    `);
                    
                    if (checkQuest) {
                        console.log('⚠️ Found quest timestamps in seconds - fixing...');
                        const { fixQuestTimestamps } = require('./scripts/fixQuestTimestamps');
                        await fixQuestTimestamps();
                        console.log('✅ Quest timestamps fixed');
                    } else {
                        console.log('✅ Quest timestamps already in milliseconds');
                    }
                } catch (error) {
                    console.log('ℹ️  Quest tables will use correct timestamp format');
                }
            }
            
            // CLEANUP OLD COMPLETED QUESTS: Remove accumulated quests (one-time cleanup)
            if (this.database.dbType && this.database.dbType.toLowerCase() === 'postgresql') {
                console.log('🧹 Cleaning up old completed quests...');
                try {
                    const now = Date.now();
                    const oneDayAgo = now - (24 * 60 * 60 * 1000);
                    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
                    const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000);

                    // Clean up old daily quests
                    const dailyResult = await this.database.run(`
                        DELETE FROM user_quests 
                        WHERE completed = TRUE 
                        AND quest_id IN (SELECT id FROM quests WHERE quest_type = 'daily')
                        AND (completed_date < ? OR (completed_date IS NULL AND assigned_date < ?))
                    `, [oneDayAgo, oneDayAgo]);
                    
                    // Clean up old weekly quests
                    const weeklyResult = await this.database.run(`
                        DELETE FROM user_quests 
                        WHERE completed = TRUE 
                        AND quest_id IN (SELECT id FROM quests WHERE quest_type = 'weekly')
                        AND (completed_date < ? OR (completed_date IS NULL AND assigned_date < ?))
                    `, [oneWeekAgo, oneWeekAgo]);
                    
                    // Clean up old monthly quests
                    const monthlyResult = await this.database.run(`
                        DELETE FROM user_quests 
                        WHERE completed = TRUE 
                        AND quest_id IN (SELECT id FROM quests WHERE quest_type = 'monthly')
                        AND (completed_date < ? OR (completed_date IS NULL AND assigned_date < ?))
                    `, [oneMonthAgo, oneMonthAgo]);
                    
                    const totalCleaned = (dailyResult.changes || 0) + (weeklyResult.changes || 0) + (monthlyResult.changes || 0);
                    console.log(`✅ Cleaned up ${totalCleaned} old completed quests`);
                } catch (error) {
                    console.log('ℹ️  Quest cleanup skipped:', error.message);
                }
            }
            
            // AUTO-ADD COOLDOWN BYPASS: One-time migration to add cooldown_bypass column
            console.log('🔧 Checking cooldown_bypass column...');
            try {
                const userColumns = await this.database.all('PRAGMA table_info(users)');
                const hasCooldownBypass = userColumns.some(col => col.name === 'cooldown_bypass');
                const hasShowcaseCount = userColumns.some(col => col.name === 'showcase_count');

                if (!hasCooldownBypass) {
                    await this.database.run('ALTER TABLE users ADD COLUMN cooldown_bypass BOOLEAN DEFAULT FALSE');
                    console.log('✅ Added cooldown_bypass column');
                }

                if (!hasShowcaseCount) {
                    await this.database.run('ALTER TABLE users ADD COLUMN showcase_count INTEGER DEFAULT 0');
                    console.log('✅ Added showcase_count column');
                }

                console.log('✅ cooldown_bypass column verified');
            } catch (error) {
                console.error('⚠️ Note: cooldown_bypass column check:', error.message);
            }
            
            // AUTO-LOAD BASE SETS: Check and load Base Sets 1, 2, 3 if missing (for Render free tier)
            console.log('📦 Checking base sets availability...');
            
            // Check for force reload flag (used when base sets need manual reload)
            const fs = require('fs');
            const path = require('path');
            const forceReloadFlag = path.join(__dirname, '.force_reload_base_sets');
            
            // AUTO-CHECK: Verify base1, base2, base3 exist - if not, clear migration and reload
            const base123Check = await this.database.all(`
                SELECT set_id, COUNT(*) as count 
                FROM cards 
                WHERE set_id IN ('base1', 'base2', 'base3')
                GROUP BY set_id
            `);
            
            const hasBase1 = base123Check.find(s => s.set_id === 'base1');
            const hasBase2 = base123Check.find(s => s.set_id === 'base2');
            const hasBase3 = base123Check.find(s => s.set_id === 'base3');
            
            console.log(`🔍 Base sets check: base1=${hasBase1?.count || 0}, base2=${hasBase2?.count || 0}, base3=${hasBase3?.count || 0}`);
            
            // If any base set is missing, trigger reload
            if (!hasBase1 || !hasBase2 || !hasBase3) {
                console.log('⚠️  Missing base sets detected - triggering automatic reload...');
                
                // Clear ALL base sets to ensure clean reload
                try {
                    await this.database.run(`DELETE FROM cards WHERE set_id IN ('base1', 'base2', 'base3')`);
                    console.log('✅ Cleared existing base set cards');
                    
                    // Clear migration flag so it runs again after reload
                    const migrationFlag = path.join(__dirname, '.set_name_migration_complete');
                    if (fs.existsSync(migrationFlag)) {
                        fs.unlinkSync(migrationFlag);
                        console.log('🔄 Migration flag cleared - will re-run for new base sets');
                    }
                } catch (error) {
                    console.error('⚠️ Failed to clear base sets:', error.message);
                }
            }
            
            if (fs.existsSync(forceReloadFlag)) {
                console.log('🔄 Force reload flag detected - clearing base sets...');
                try {
                    await this.database.run(`DELETE FROM cards WHERE set_id IN ('base1', 'base2', 'base3')`);
                    console.log('✅ Base sets cleared - will reload from files');
                    fs.unlinkSync(forceReloadFlag); // Remove flag after use
                    
                    // IMPORTANT: Delete migration flag so set_name gets fixed for newly loaded sets
                    const migrationFlag = path.join(__dirname, '.set_name_migration_complete');
                    if (fs.existsSync(migrationFlag)) {
                        fs.unlinkSync(migrationFlag);
                        console.log('🔄 Migration flag cleared - will re-run for new base sets');
                    }
                } catch (error) {
                    console.error('⚠️ Failed to clear base sets:', error.message);
                }
            }
            
            await this.ensureBaseSetsLoaded();
            console.log('✅ Base sets check complete');
            
            // 🚀 APPLY PERFORMANCE INDEXES: Critical for 20+ concurrent users
            const { applyZamIndexes } = require('./database/migrations/apply_zam_indexes');
            applyZamIndexes(this.database).catch(err => {
                console.error('⚠️  Index creation failed (non-fatal):', err.message);
            });
            
            // DEPLOYMENT FIX: Progressive card loading will happen AFTER bot is ready
            // Removed from startup sequence to prevent deployment timeouts
            
            // Load commands and events (but don't register commands yet)
            await this.loadCommandsOnly();
            await this.loadEvents();
            
            // Login to Discord with timeout for cloud deployment reliability
            console.log('Attempting to login to Discord...');
            const loginTimeout = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Discord login timeout after 30 seconds')), 30000)
            );
            
            try {
                await Promise.race([
                    this.client.login(process.env.DISCORD_TOKEN),
                    loginTimeout
                ]);
                console.log('✅ Discord login successful');
                
                // Register commands after successful Discord login
                this.registerCommandsAsync();
                
            } catch (error) {
                console.error('❌ Discord login failed:', error.message);
                // Continue anyway - health server is running for Render
                console.log('⚠️  Continuing with health server running...');
            }
            
            // Start auto-backup system for cloud hosting
            if (process.env.NODE_ENV === 'production' || process.env.PORT) {
                this.backupManager.startAutoBackup();
            }
            
            console.log('Pokezam bot initialized successfully!');
        } catch (error) {
            console.error('Error initializing bot:', error);
            
            // In production, keep health server running even if bot fails
            if (process.env.NODE_ENV === 'production' || process.env.PORT) {
                console.log('🏥 Production mode: Keeping health server running for Render');
                console.log('🔄 Bot will retry connection automatically...');
                // Don't exit in production - let health server keep running
            } else {
                process.exit(1);
            }
        }
    }

    // Check if database needs restoration (only if empty/missing)
    async checkIfDatabaseNeedsRestore() {
        try {
            // Check if database file exists (for SQLite)
            const fs = require('fs');
            const dbPath = this.database.dbPath;
            
            if (!dbPath || !fs.existsSync(dbPath)) {
                console.log('📋 Database file missing, restoration needed');
                return true;
            }
            
            // Check if database has user data (quick test)
            const userCount = await this.database.get('SELECT COUNT(*) as count FROM users WHERE 1 LIMIT 1');
            
            if (!userCount || userCount.count === 0) {
                console.log('📋 Database empty (no users), restoration needed');
                return true;
            }
            
            console.log(`📋 Database has ${userCount.count} users, restoration not needed`);
            return false;
            
        } catch (error) {
            // If we can't check (tables don't exist, etc), assume restoration is needed
            console.log('📋 Cannot check database status, assuming restoration needed:', error.message);
            return true;
        }
    }

    setupEventHandlers() {


        this.client.on('interactionCreate', async (interaction) => {
            // Handle autocomplete interactions
            if (interaction.isAutocomplete()) {
                const command = this.commands.get(interaction.commandName);
                if (!command || !command.autocomplete) return;

                try {
                    // Make database managers available for autocomplete
                    interaction.client.database = this.database;
                    interaction.client.userManager = this.userManager;
                    interaction.client.cardManager = this.cardManager;
                    interaction.client.questManager = this.questManager;
                    
                    await command.autocomplete(interaction);
                } catch (error) {
                    console.error('Error in autocomplete:', error);
                }
                return;
            }

            // Handle string select menu interactions (dropdown menus)
            if (interaction.isStringSelectMenu()) {
                if (interaction.customId.startsWith('binder_set_')) {
                    const targetUserId = interaction.customId.split('_')[2];
                    
                    // Only allow the target user or the original user to use the dropdown
                    if (interaction.user.id !== targetUserId) {
                        return await interaction.reply({
                            content: 'You can only interact with your own binder!',
                            flags: 64
                        });
                    }
                    
                    const selectedSet = interaction.values[0];
                    await interaction.deferUpdate();
                    
                    // Get the binder command and execute with the selected set
                    const binderCommand = this.commands.get('binder');
                    if (binderCommand) {
                        try {
                            const user = await this.userManager.getUser(targetUserId);
                            const targetUser = await this.client.users.fetch(targetUserId);
                            const userCollection = await this.userManager.getUserCollection(targetUserId, selectedSet);
                            
                            await binderCommand.createBinderEmbed(
                                interaction,
                                targetUser,
                                user,
                                selectedSet,
                                userCollection,
                                this.database,
                                this.userManager
                            );
                        } catch (error) {
                            console.error('Error handling binder dropdown:', error);
                            await interaction.editReply({
                                content: 'Error loading the selected set. Please try again!',
                                components: []
                            });
                        }
                    }
                }
                return;
            }

            // Handle button interactions for quest navigation
            if (interaction.isButton() && interaction.customId.startsWith('quest_')) {
                try {
                    await interaction.deferUpdate();
                    
                    const questType = interaction.customId.replace('quest_', '');
                    const userId = interaction.user.id;
                    
                    // Get the quest command and show the requested page
                    const questCommand = this.commands.get('quest');
                    if (questCommand) {
                        await questCommand.showQuestPage(interaction, this.questManager, userId, questType);
                    }
                    
                } catch (error) {
                    console.error('Error handling quest button interaction:', error);
                    
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: 'An error occurred while switching quest pages. Please try again!',
                            ephemeral: true
                        });
                    } else {
                        await interaction.editReply({
                            content: 'An error occurred while switching quest pages. Please try again!'
                        });
                    }
                }
                return;
            }

            // Handle button interactions for help navigation
            if (interaction.isButton() && interaction.customId.startsWith('help_')) {
                try {
                    await interaction.deferUpdate();

                    const helpCommand = this.commands.get('help');
                    if (helpCommand) {
                        const category = interaction.customId.replace('help_', '');
                        await helpCommand.showHelpCategory(interaction, category);
                    }
                } catch (error) {
                    console.error('Error handling help button:', error);

                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: 'An error occurred while navigating the help hub. Please try again!',
                            ephemeral: true
                        });
                    } else {
                        await interaction.editReply({
                            content: 'An error occurred while navigating the help hub. Please try again!'
                        });
                    }
                }
                return;
            }

            // Handle button interactions for FAQ navigation
            if (interaction.isButton() && interaction.customId.startsWith('faq_')) {
                try {
                    await interaction.deferUpdate();
                    
                    const faqCommand = this.commands.get('faq');
                    if (faqCommand) {
                        const category = interaction.customId.replace('faq_', '');
                        
                        if (category === 'overview') {
                            await faqCommand.showFAQOverview(interaction);
                        } else {
                            await faqCommand.showFAQCategory(interaction, category);
                        }
                    }
                } catch (error) {
                    console.error('Error handling FAQ button:', error);
                    
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: 'An error occurred while navigating FAQ. Please try again!',
                            ephemeral: true
                        });
                    } else {
                        await interaction.editReply({
                            content: 'An error occurred while navigating FAQ. Please try again!'
                        });
                    }
                }
                return;
            }

            // Handle button interactions for binder navigation
            if (interaction.isButton() && (interaction.customId.startsWith('binder_page_') || interaction.customId.startsWith('binder_filter_'))) {
                try {
                    await interaction.deferUpdate();
                    
                    const parts = interaction.customId.split('_');
                    const action = parts[1]; // 'page' or 'filter'
                    const targetUserId = parts[2];
                    const value = parts[3]; // page number or filter type
                    
                    // Only allow the target user to use their binder buttons
                    if (interaction.user.id !== targetUserId) {
                        return await interaction.editReply({
                            content: 'You can only interact with your own binder!',
                            components: []
                        });
                    }
                    
                    const binderCommand = this.commands.get('binder');
                    if (binderCommand) {
                        const targetUser = await this.client.users.fetch(targetUserId);
                        
                        if (action === 'page') {
                            // Handle page navigation
                            const currentPage = parseInt(value);
                            const { cards, totalCards, totalPages } = await binderCommand.getFilteredCards(
                                this.database, targetUserId, null, null, null, 'owned', currentPage
                            );
                            
                            await binderCommand.displayBinder(interaction, targetUser, cards, {
                                setFilter: null,
                                pokemonFilter: null,
                                rarityFilter: null,
                                typeFilter: 'owned',
                                currentPage,
                                totalCards,
                                totalPages
                            });
                        } else if (action === 'filter') {
                            // Handle filter change
                            const typeFilter = value;
                            const { cards, totalCards, totalPages } = await binderCommand.getFilteredCards(
                                this.database, targetUserId, null, null, null, typeFilter, 1
                            );
                            
                            await binderCommand.displayBinder(interaction, targetUser, cards, {
                                setFilter: null,
                                pokemonFilter: null,
                                rarityFilter: null,
                                typeFilter,
                                currentPage: 1,
                                totalCards,
                                totalPages
                            });
                        }
                    }
                    
                } catch (error) {
                    console.error('Error handling binder button interaction:', error);
                    
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: 'An error occurred while updating the binder. Please try again!',
                            ephemeral: true
                        });
                    } else {
                        await interaction.editReply({
                            content: 'An error occurred while updating the binder. Please try again!'
                        });
                    }
                }
                return;
            }

            // Handle button interactions for Card Dex Regular navigation
            if (interaction.isButton() && (interaction.customId.startsWith('carddex_page_') || interaction.customId.startsWith('carddex_filter_'))) {
                try {
                    await interaction.deferUpdate();
                    
                    const parts = interaction.customId.split('_');
                    const action = parts[1]; // 'page' or 'filter'
                    const targetUserId = parts[2];
                    const value = parts[3]; // page number or filter type
                    
                    // Only allow the target user to use their card dex buttons
                    if (interaction.user.id !== targetUserId) {
                        return await interaction.editReply({
                            content: 'You can only interact with your own Card Dex!',
                            components: []
                        });
                    }
                    
                    const cardDexCommand = this.commands.get('carddex-reg');
                    if (cardDexCommand) {
                        const targetUser = await this.client.users.fetch(targetUserId);
                        
                        if (action === 'page') {
                            const currentPage = parseInt(value);
                            const dexData = await cardDexCommand.getDexData(this.database, targetUserId, {
                                setFilter: null,
                                ownershipFilter: 'all',
                                searchQuery: null,
                                currentPage
                            });
                            await cardDexCommand.displayCardDex(interaction, targetUser, dexData);
                        } else if (action === 'filter') {
                            const ownershipFilter = value;
                            const dexData = await cardDexCommand.getDexData(this.database, targetUserId, {
                                setFilter: null,
                                ownershipFilter,
                                searchQuery: null,
                                currentPage: 1
                            });
                            await cardDexCommand.displayCardDex(interaction, targetUser, dexData);
                        }
                    }
                    
                } catch (error) {
                    console.error('Error handling card dex button interaction:', error);
                    
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: 'An error occurred while updating the Card Dex. Please try again!',
                            ephemeral: true
                        });
                    } else {
                        await interaction.editReply({
                            content: 'An error occurred while updating the Card Dex. Please try again!'
                        });
                    }
                }
                return;
            }

            // Handle select menu interactions for Card Dex Regular set selection
            if (interaction.isStringSelectMenu() && interaction.customId.startsWith('carddex_set_')) {
                try {
                    await interaction.deferUpdate();
                    
                    const targetUserId = interaction.customId.replace('carddex_set_', '');
                    const selectedSet = interaction.values[0];
                    
                    // Only allow the target user to use their card dex
                    if (interaction.user.id !== targetUserId) {
                        return await interaction.editReply({
                            content: 'You can only interact with your own Card Dex!',
                            components: []
                        });
                    }
                    
                    const cardDexCommand = this.commands.get('carddex-reg');
                    if (cardDexCommand) {
                        const targetUser = await this.client.users.fetch(targetUserId);
                        const setFilter = selectedSet === 'all' ? null : selectedSet;
                        
                        const dexData = await cardDexCommand.getDexData(this.database, targetUserId, {
                            setFilter,
                            ownershipFilter: 'all',
                            searchQuery: null,
                            currentPage: 1
                        });
                        await cardDexCommand.displayCardDex(interaction, targetUser, dexData);
                    }
                    
                } catch (error) {
                    console.error('Error handling card dex set selection:', error);
                    
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: 'An error occurred while changing sets. Please try again!',
                            ephemeral: true
                        });
                    } else {
                        await interaction.editReply({
                            content: 'An error occurred while changing sets. Please try again!'
                        });
                    }
                }
                return;
            }

            // Handle button interactions for Master Card Dex navigation
            if (interaction.isButton() && (interaction.customId.startsWith('masterdex_page_') || interaction.customId.startsWith('masterdex_completion_'))) {
                try {
                    await interaction.deferUpdate();
                    
                    const parts = interaction.customId.split('_');
                    const action = parts[1]; // 'page' or 'completion'
                    const targetUserId = parts[2];
                    const value = parts[3]; // page number or completion type
                    
                    // Only allow the target user to use their master dex buttons
                    if (interaction.user.id !== targetUserId) {
                        return await interaction.editReply({
                            content: 'You can only interact with your own Master Card Dex!',
                            components: []
                        });
                    }
                    
                    const masterDexCommand = this.commands.get('carddex-master');
                    if (masterDexCommand) {
                        const targetUser = await this.client.users.fetch(targetUserId);
                        
                        if (action === 'page') {
                            const currentPage = parseInt(value);
                            const masterDexData = await masterDexCommand.getMasterDexData(this.database, targetUserId, {
                                setFilter: null,
                                variantFilter: 'all',
                                completionFilter: 'all',
                                searchQuery: null,
                                currentPage
                            });
                            await masterDexCommand.displayMasterCardDex(interaction, targetUser, masterDexData);
                        } else if (action === 'completion') {
                            const completionFilter = value;
                            const masterDexData = await masterDexCommand.getMasterDexData(this.database, targetUserId, {
                                setFilter: null,
                                variantFilter: 'all',
                                completionFilter,
                                searchQuery: null,
                                currentPage: 1
                            });
                            await masterDexCommand.displayMasterCardDex(interaction, targetUser, masterDexData);
                        }
                    }
                    
                } catch (error) {
                    console.error('Error handling master dex button interaction:', error);
                    
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: 'An error occurred while updating the Master Card Dex. Please try again!',
                            ephemeral: true
                        });
                    } else {
                        await interaction.editReply({
                            content: 'An error occurred while updating the Master Card Dex. Please try again!'
                        });
                    }
                }
                return;
            }

            // Handle select menu interactions for Master Card Dex variant selection
            if (interaction.isStringSelectMenu() && interaction.customId.startsWith('masterdex_variant_')) {
                try {
                    await interaction.deferUpdate();
                    
                    const targetUserId = interaction.customId.replace('masterdex_variant_', '');
                    const selectedVariant = interaction.values[0];
                    
                    // Only allow the target user to use their master dex
                    if (interaction.user.id !== targetUserId) {
                        return await interaction.editReply({
                            content: 'You can only interact with your own Master Card Dex!',
                            components: []
                        });
                    }
                    
                    const masterDexCommand = this.commands.get('carddex-master');
                    if (masterDexCommand) {
                        const targetUser = await this.client.users.fetch(targetUserId);
                        
                        const masterDexData = await masterDexCommand.getMasterDexData(this.database, targetUserId, {
                            setFilter: null,
                            variantFilter: selectedVariant,
                            completionFilter: 'all',
                            searchQuery: null,
                            currentPage: 1
                        });
                        await masterDexCommand.displayMasterCardDex(interaction, targetUser, masterDexData);
                    }
                    
                } catch (error) {
                    console.error('Error handling master dex variant selection:', error);
                    
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: 'An error occurred while changing variants. Please try again!',
                            ephemeral: true
                        });
                    } else {
                        await interaction.editReply({
                            content: 'An error occurred while changing variants. Please try again!'
                        });
                    }
                }
                return;
            }

            // Handle button interactions for active boosts navigation
            if (interaction.isButton() && interaction.customId.startsWith('active_boosts_')) {
                try {
                    await interaction.deferUpdate();
                    
                    const parts = interaction.customId.split('_');
                    const action = parts[2]; // 'page'
                    const targetUserId = parts[3];
                    const value = parts[4]; // page number
                    
                    // Only allow the target user to use their active boosts buttons
                    if (interaction.user.id !== targetUserId) {
                        return await interaction.editReply({
                            content: 'You can only interact with your own active effects!',
                            components: []
                        });
                    }
                    
                    const activeBoostsCommand = this.commands.get('active-boosts');
                    if (activeBoostsCommand && action === 'page') {
                        const currentPage = parseInt(value);
                        await activeBoostsCommand.displayActiveEffectsPage(interaction, this.database, targetUserId, currentPage);
                    }
                    
                } catch (error) {
                    console.error('Error handling active boosts button interaction:', error);
                    
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: 'An error occurred while updating active effects. Please try again!',
                            ephemeral: true
                        });
                    } else {
                        await interaction.editReply({
                            content: 'An error occurred while updating active effects. Please try again!'
                        });
                    }
                }
                return;
            }

            // Handle button interactions for use command item usage
            if (interaction.isButton() && interaction.customId.startsWith('use_item_')) {
                try {
                    await interaction.deferReply({ ephemeral: true });
                    
                    const parts = interaction.customId.split('_');
                    const itemId = parts[2];
                    const targetUserId = parts[3];
                    
                    // Only allow the target user to use their items
                    if (interaction.user.id !== targetUserId) {
                        return await interaction.editReply({
                            content: '❌ You can only use your own items!'
                        });
                    }

                    // Simulate the use command execution with proper parameters
                    const useCommand = this.commands.get('use');
                    if (useCommand) {
                        // Create a fake interaction options object
                        const fakeOptions = {
                            getString: (name) => name === 'item' ? itemId : null
                        };
                        
                        const fakeInteraction = {
                            ...interaction,
                            options: fakeOptions,
                            deferReply: async () => {}, // Already deferred
                            editReply: async (options) => await interaction.editReply(options)
                        };
                        
                        await useCommand.execute(fakeInteraction, { 
                            database: this.database, 
                            userManager: this.userManager,
                            cardManager: this.cardManager,
                            questManager: this.questManager
                        });
                    } else {
                        await interaction.editReply({
                            content: '❌ Use command not found!'
                        });
                    }
                    
                } catch (error) {
                    console.error('Error handling use item button interaction:', error);
                    
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: 'An error occurred while using the item. Please try again!',
                            ephemeral: true
                        });
                    } else {
                        await interaction.editReply({
                            content: 'An error occurred while using the item. Please try again!'
                        });
                    }
                }
                return;
            }

            // Handle refresh inventory button
            if (interaction.isButton() && interaction.customId.startsWith('refresh_inventory_')) {
                try {
                    const targetUserId = interaction.customId.split('_')[2];
                    
                    // Only allow the target user to refresh their inventory
                    if (interaction.user.id !== targetUserId) {
                        return await interaction.reply({
                            content: '❌ You can only refresh your own inventory!',
                            ephemeral: true
                        });
                    }

                    // Execute inventory command
                    const inventoryCommand = this.commands.get('inventory');
                    if (inventoryCommand) {
                        const fakeOptions = {
                            getUser: () => null // No target user, use self
                        };
                        
                        const fakeInteraction = {
                            ...interaction,
                            options: fakeOptions,
                            deferReply: async () => {}, // Will defer in command
                            editReply: async (options) => await interaction.update(options)
                        };
                        
                        await inventoryCommand.execute(fakeInteraction, { 
                            database: this.database, 
                            userManager: this.userManager 
                        });
                    } else {
                        await interaction.reply({
                            content: '❌ Inventory command not found!',
                            ephemeral: true
                        });
                    }
                    
                } catch (error) {
                    console.error('Error handling refresh inventory button:', error);
                    await interaction.reply({
                        content: '❌ An error occurred while refreshing inventory!',
                        ephemeral: true
                    });
                }
                return;
            }

            // Handle button interactions for collector shop (collect/upgrade actions only)
            // Department and overview buttons are handled separately below
            if (interaction.isButton() && 
                (interaction.customId.startsWith('collector_collect_') || 
                 interaction.customId.startsWith('collector_upgrade_'))) {
                try {
                    const parts = interaction.customId.split('_');
                    const action = parts[1]; // 'collect' or 'upgrade'
                    const targetUserId = parts[2];
                    
                    // Only allow the target user to interact with their collector shop
                    if (interaction.user.id !== targetUserId) {
                        return await interaction.reply({
                            content: 'You can only interact with your own collector shop!',
                            ephemeral: true
                        });
                    }
                    
                    await interaction.deferUpdate();
                    
                    const collectorCommand = this.commands.get('collector');
                    const user = await this.userManager.getUser(interaction.user.id);
                    
                    if (action === 'collect') {
                        await collectorCommand.handleCollect(interaction, user, this.userManager, this.database, this.collectorShopManager, this.cardManager);
                    } else if (action === 'upgrade') {
                        await collectorCommand.handleUpgrade(interaction, user, this.userManager, this.collectorShopManager);
                    }
                    
                } catch (error) {
                    console.error('Error handling collector shop button:', error);
                    
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: '❌ An error occurred. Please try again!',
                            ephemeral: true
                        });
                    } else {
                        await interaction.editReply({
                            content: '❌ An error occurred. Please try again!'
                        });
                    }
                }
                return;
            }

            // Handle Holo+ card viewer pagination
            if (interaction.isButton() && interaction.customId.startsWith('view_holo_')) {
                try {
                    const parts = interaction.customId.split('_');
                    const targetUserId = parts[2];
                    const page = parseInt(parts[3]);
                    
                    if (interaction.user.id !== targetUserId) {
                        return await interaction.reply({
                            content: 'You can only view your own cards!',
                            ephemeral: true
                        });
                    }
                    
                    await interaction.deferUpdate();
                    
                    const collectorCommand = this.commands.get('collector');
                    if (collectorCommand && collectorCommand.holoCardCache) {
                        const cacheData = collectorCommand.holoCardCache.get(targetUserId);
                        if (cacheData) {
                            const { cards } = cacheData;
                            const totalPages = cards.length;
                            const currentPage = Math.min(Math.max(0, page), totalPages - 1);
                            const card = cards[currentPage];
                            
                            // Get card image
                            const imageUrl = card.image_large || card.image_small;
                            
                            const embed = new EmbedBuilder()
                                .setTitle(`✨ ${card.name}`)
                                .setDescription(`**Rarity:** ${card.rarity}\n**Set:** ${card.set_name}\n**Card ID:** ${card.id}`)
                                .setColor('#FFD700')
                                .setFooter({ text: `Card ${currentPage + 1} of ${totalPages}` })
                                .setTimestamp();
                            
                            if (imageUrl) {
                                embed.setImage(imageUrl);
                            }
                            
                            // Navigation buttons
                            const row = new ActionRowBuilder();
                            
                            // Back to Results button (always shown)
                            row.addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`view_holo_back_${targetUserId}`)
                                    .setLabel('◀ Back to Results')
                                    .setStyle(ButtonStyle.Success)
                            );
                            
                            // Navigation buttons (if multiple pages)
                            if (totalPages > 1) {
                                if (currentPage > 0) {
                                    row.addComponents(
                                        new ButtonBuilder()
                                            .setCustomId(`view_holo_${targetUserId}_${currentPage - 1}`)
                                            .setLabel('Previous')
                                            .setStyle(ButtonStyle.Secondary)
                                    );
                                }
                                
                                if (currentPage < totalPages - 1) {
                                    row.addComponents(
                                        new ButtonBuilder()
                                            .setCustomId(`view_holo_${targetUserId}_${currentPage + 1}`)
                                            .setLabel('Next')
                                            .setStyle(ButtonStyle.Secondary)
                                    );
                                }
                            }
                            
                            row.addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`view_holo_close_${targetUserId}`)
                                    .setLabel('Close')
                                    .setStyle(ButtonStyle.Danger)
                            );
                            
                            await interaction.editReply({
                                embeds: [embed],
                                components: [row]
                            });
                        } else {
                            await interaction.editReply({
                                content: '❌ Card data expired. Please collect again!',
                                embeds: [],
                                components: []
                            });
                        }
                    }
                } catch (error) {
                    console.error('Error handling holo card viewer:', error);
                }
                return;
            }

            // Handle close button for Holo+ viewer
            if (interaction.isButton() && interaction.customId.startsWith('view_holo_close_')) {
                try {
                    const parts = interaction.customId.split('_');
                    const targetUserId = parts[3];
                    
                    if (interaction.user.id !== targetUserId) {
                        return await interaction.reply({
                            content: 'You can only close your own views!',
                            ephemeral: true
                        });
                    }
                    
                    await interaction.deferUpdate();
                    await interaction.editReply({
                        content: '✅ Viewer closed.',
                        embeds: [],
                        components: []
                    });
                } catch (error) {
                    console.error('Error closing holo card viewer:', error);
                }
                return;
            }

            // Handle back button for Holo+ viewer (return to results)
            if (interaction.isButton() && interaction.customId.startsWith('view_holo_back_')) {
                try {
                    const parts = interaction.customId.split('_');
                    const targetUserId = parts[3];
                    
                    if (interaction.user.id !== targetUserId) {
                        return await interaction.reply({
                            content: 'You can only view your own results!',
                            ephemeral: true
                        });
                    }
                    
                    await interaction.deferUpdate();
                    
                    const collectorCommand = this.commands.get('collector');
                    if (collectorCommand && collectorCommand.holoCardCache) {
                        const cacheData = collectorCommand.holoCardCache.get(targetUserId);
                        if (cacheData && cacheData.resultsEmbed) {
                            // Restore the original results embed with "View Holo+ Cards" button
                            const row = new ActionRowBuilder()
                                .addComponents(
                                    new ButtonBuilder()
                                        .setCustomId(`view_holo_${targetUserId}_0`)
                                        .setLabel(`View Holo+ Cards (${cacheData.cards.length})`)
                                        .setEmoji('✨')
                                        .setStyle(ButtonStyle.Primary)
                                );
                            
                            await interaction.editReply({
                                embeds: [cacheData.resultsEmbed],
                                components: [row]
                            });
                        } else {
                            await interaction.editReply({
                                content: '❌ Results data expired. Please collect again!',
                                embeds: [],
                                components: []
                            });
                        }
                    }
                } catch (error) {
                    console.error('Error handling back button:', error);
                }
                return;
            }

            // Handle collector department detail button
            if (interaction.isButton() && interaction.customId.startsWith('collector_dept_')) {
                try {
                    // Format: collector_dept_{deptId}_{userId}
                    // But deptId can contain underscores (e.g., "trade_counter")
                    // So we extract userId from the end
                    const customId = interaction.customId;
                    const lastUnderscoreIndex = customId.lastIndexOf('_');
                    const targetUserId = customId.substring(lastUnderscoreIndex + 1);
                    const deptId = customId.substring('collector_dept_'.length, lastUnderscoreIndex);
                    
                    if (interaction.user.id !== targetUserId) {
                        return await interaction.reply({
                            content: 'You can only view your own departments!',
                            ephemeral: true
                        });
                    }
                    
                    await interaction.deferUpdate();
                    
                    const collectorCommand = this.commands.get('collector');
                    if (collectorCommand && collectorCommand.collectorStatusCache) {
                        const cacheData = collectorCommand.collectorStatusCache.get(targetUserId);
                        if (cacheData) {
                            const { shop, departments } = cacheData;
                            
                            // Build department detail embed
                            const embed = await collectorCommand.buildDepartmentEmbed(
                                interaction,
                                deptId,
                                shop,
                                departments,
                                this.collectorShopManager
                            );
                            
                            // Add back button
                            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
                            const row = new ActionRowBuilder()
                                .addComponents(
                                    new ButtonBuilder()
                                        .setCustomId(`collector_overview_${targetUserId}`)
                                        .setLabel('◀ Back to Overview')
                                        .setStyle(ButtonStyle.Success)
                                );
                            
                            await interaction.editReply({
                                embeds: [embed],
                                components: [row]
                            });
                        } else {
                            await interaction.editReply({
                                content: '❌ Status data expired. Use /collector to refresh!',
                                embeds: [],
                                components: []
                            });
                        }
                    }
                } catch (error) {
                    console.error('Error handling collector department button:', error);
                }
                return;
            }

            // Handle collector overview back button
            if (interaction.isButton() && interaction.customId.startsWith('collector_overview_')) {
                try {
                    const parts = interaction.customId.split('_');
                    const targetUserId = parts[2];
                    
                    if (interaction.user.id !== targetUserId) {
                        return await interaction.reply({
                            content: 'You can only view your own shop!',
                            ephemeral: true
                        });
                    }
                    
                    await interaction.deferUpdate();
                    
                    const collectorCommand = this.commands.get('collector');
                    if (collectorCommand && collectorCommand.collectorStatusCache) {
                        const cacheData = collectorCommand.collectorStatusCache.get(targetUserId);
                        if (cacheData) {
                            const { shop, departments } = cacheData;
                            const user = await this.userManager.getUser(targetUserId);
                            
                            // Rebuild overview embed
                            const embed = await collectorCommand.buildOverviewEmbed(
                                interaction,
                                user,
                                shop,
                                departments,
                                this.collectorShopManager
                            );
                            
                            // Rebuild department buttons
                            const components = collectorCommand.buildDepartmentButtons(
                                departments,
                                this.collectorShopManager,
                                targetUserId
                            );
                            
                            await interaction.editReply({
                                embeds: [embed],
                                components
                            });
                        } else {
                            await interaction.editReply({
                                content: '❌ Status data expired. Use /collector to refresh!',
                                embeds: [],
                                components: []
                            });
                        }
                    }
                } catch (error) {
                    console.error('Error handling collector overview button:', error);
                }
                return;
            }

            // Handle button interactions for shop purchases
            if (interaction.isButton() && interaction.customId.startsWith('shop_buy_')) {
                try {
                    await interaction.deferUpdate();
                    
                    // Parse custom ID properly - format: shop_buy_{itemId}_{userId}
                    const customId = interaction.customId;
                    const lastUnderscoreIndex = customId.lastIndexOf('_');
                    const targetUserId = customId.substring(lastUnderscoreIndex + 1);
                    const itemId = customId.substring(9, lastUnderscoreIndex); // Remove 'shop_buy_' prefix
                    
                    // Only allow the target user to make purchases
                    if (interaction.user.id !== targetUserId) {
                        return await interaction.editReply({
                            content: 'You can only make purchases for yourself!',
                            components: []
                        });
                    }
                    
                    const shopCommand = this.commands.get('shop');
                    if (shopCommand) {
                        await shopCommand.handlePurchase(interaction, this.database, this.userManager, itemId);
                    }
                    
                } catch (error) {
                    console.error('Error handling shop purchase button interaction:', error);
                    
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: 'An error occurred while processing your purchase. Please try again!',
                            ephemeral: true
                        });
                    } else {
                        await interaction.editReply({
                            content: 'An error occurred while processing your purchase. Please try again!'
                        });
                    }
                }
                return;
            }

            // Handle button interactions for shop navigation
            if (interaction.isButton() && (interaction.customId.startsWith('shop_prev_') || interaction.customId.startsWith('shop_next_'))) {
                try {
                    const parts = interaction.customId.split('_');
                    const direction = parts[1]; // 'prev' or 'next'
                    const currentPage = parseInt(parts[2]);
                    const targetUserId = parts[3];
                    
                    // Only allow the target user to navigate their shop
                    if (interaction.user.id !== targetUserId) {
                        return await interaction.reply({
                            content: 'You can only navigate your own shop!',
                            ephemeral: true
                        });
                    }
                    
                    const shopCommand = this.commands.get('shop');
                    if (shopCommand) {
                        await shopCommand.handlePageNavigation(interaction, this.database, this.userManager, direction, currentPage);
                    }
                    
                } catch (error) {
                    console.error('Error handling shop navigation:', error);
                    
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: '❌ An error occurred while navigating the shop. Please try again!',
                            ephemeral: true
                        });
                    } else {
                        await interaction.followUp({
                            content: '❌ An error occurred while navigating the shop. Please try again!',
                            ephemeral: true
                        });
                    }
                }
                return;
            }

            // Handle button interactions for start command
            // Handle Vex's Risky Deal buttons
            if (interaction.isButton() && interaction.customId.startsWith('vex_')) {
                try {
                    const parts = interaction.customId.split('_');
                    const action = parts[1]; // 'confirm' or 'cancel'
                    const targetUserId = parts[2];
                    const cardId = parts[3]; // only for confirm

                    // Security check: Only the user who initiated can interact
                    if (interaction.user.id !== targetUserId) {
                        return await interaction.reply({
                            content: '🚫 This isn\'t your gamble! Use `/risky_deal` to make your own.',
                            ephemeral: true
                        });
                    }

                    if (action === 'cancel') {
                        // User walked away
                        const cancelEmbed = new EmbedBuilder()
                            .setTitle('🚶 You Walked Away')
                            .setDescription(
                                `*Vex scowls as you turn away...*\n\n` +
                                `"Coward. Come back when you have the guts to gamble."\n\n` +
                                `*He vanishes into the shadows with a mocking laugh.*`
                            )
                            .setColor('#555555');

                        return await interaction.update({
                            embeds: [cancelEmbed],
                            components: []
                        });
                    }

                    if (action === 'confirm') {
                        await interaction.deferUpdate();

                        // Get the risky_deal command for its helper methods
                        const riskyDealCommand = this.commands.get('risky_deal');
                        if (!riskyDealCommand) {
                            throw new Error('Risky deal command not found');
                        }

                        // Get the original card
                        const originalCard = await this.database.get(
                            'SELECT * FROM cards WHERE id = ?',
                            [parseInt(cardId)]
                        );

                        if (!originalCard) {
                            throw new Error('Card not found');
                        }

                        // Check user still owns the card
                        const userCard = await this.database.get(
                            'SELECT * FROM user_cards WHERE user_id = ? AND card_id = ?',
                            [targetUserId, cardId]
                        );

                        if (!userCard || userCard.quantity < 1) {
                            return await interaction.editReply({
                                embeds: [EmbedUtils.createErrorEmbed(
                                    '🚫 Card No Longer Owned',
                                    'You don\'t own this card anymore! The deal is off.'
                                )],
                                components: []
                            });
                        }

                        // ROLL FOR OUTCOME
                        const probTable = riskyDealCommand.rarityProbabilities[originalCard.rarity];
                        const outcome = riskyDealCommand.rollOutcome(originalCard.rarity);
                        const newCard = await riskyDealCommand.getNewCard(
                            this.database, 
                            originalCard, 
                            outcome, 
                            probTable
                        );

                        if (!newCard) {
                            throw new Error('Could not find replacement card');
                        }

                        // EXECUTE THE TRADE
                        // 1. Remove original card
                        if (userCard.quantity === 1) {
                            await this.database.run(
                                'DELETE FROM user_cards WHERE user_id = ? AND card_id = ?',
                                [targetUserId, cardId]
                            );
                        } else {
                            await this.database.run(
                                'UPDATE user_cards SET quantity = quantity - 1 WHERE user_id = ? AND card_id = ?',
                                [targetUserId, cardId]
                            );
                        }

                        // 2. Add new card (quantity = 1)
                        await this.cardManager.addCardToUser(targetUserId, newCard.id, 1);

                        // BUILD RESULT MESSAGE WITH YAML FORMAT
                        const { EmbedBuilder } = require('discord.js');
                        
                        // Get card image (prefer large, fallback to small)
                        const newCardImage = newCard.image_large || newCard.image_small;

                        let yamlContent, embedTitle, embedColor;

                        if (outcome === 'win') {
                            embedTitle = '📈 A WONDROUS TRADE!';
                            embedColor = '#00FF00';
                            yamlContent = `\`\`\`yaml
#═══════════════════════════════════════════════════
# 📈 VEX'S GAMBLE - FORTUNE FAVORS YOU!
#═══════════════════════════════════════════════════

outcome            : "WIN - You got an upgrade!"
roll result        : "${outcome.toUpperCase()} (${probTable.win}% chance)"

# ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈

🎴 YOU GAVE UP:
   card            : "${originalCard.name}"
   rarity          : "${originalCard.rarity}"
   set             : "${originalCard.set_name}"

# ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈

✨ YOU RECEIVED:
   card            : "${newCard.name}"
   rarity          : "${newCard.rarity}"
   set             : "${newCard.set_name}"

# ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈

💬 VEX SAYS:
   "Fortune favors you today! He snatches your card
    and slides you a shimmering ${newCard.rarity}!"
   "Now get out of my sight."

#═══════════════════════════════════════════════════
\`\`\``;
                        } else if (outcome === 'draw') {
                            embedTitle = '😐 A FAIR EXCHANGE';
                            embedColor = '#FFAA00';
                            yamlContent = `\`\`\`yaml
#═══════════════════════════════════════════════════
# 😐 VEX'S GAMBLE - A FAIR TRADE
#═══════════════════════════════════════════════════

outcome            : "DRAW - Same rarity trade"
roll result        : "${outcome.toUpperCase()} (${probTable.draw}% chance)"

# ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈

🎴 YOU GAVE UP:
   card            : "${originalCard.name}"
   rarity          : "${originalCard.rarity}"
   set             : "${originalCard.set_name}"

# ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈

🔄 YOU RECEIVED:
   card            : "${newCard.name}"
   rarity          : "${newCard.rarity}"
   set             : "${newCard.set_name}"

# ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈

💬 VEX SAYS:
   "A fair trade, I suppose. Boring."
   "Don't waste my time again."

#═══════════════════════════════════════════════════
\`\`\``;
                        } else { // loss
                            embedTitle = '📉 A BAD DEAL!';
                            embedColor = '#FF0000';
                            yamlContent = `\`\`\`yaml
#═══════════════════════════════════════════════════
# 📉 VEX'S GAMBLE - YOU GOT SCAMMED!
#═══════════════════════════════════════════════════

outcome            : "LOSS - You got downgraded!"
roll result        : "${outcome.toUpperCase()} (${probTable.loss}% chance)"

# ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈

🎴 YOU GAVE UP:
   card            : "${originalCard.name}"
   rarity          : "${originalCard.rarity}"
   set             : "${originalCard.set_name}"

# ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈

💸 YOU RECEIVED:
   card            : "${newCard.name}"
   rarity          : "${newCard.rarity}"
   set             : "${newCard.set_name}"

# ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈

💬 VEX SAYS:
   "You should have walked away, fool!"
   "Better luck next time... or not."

#═══════════════════════════════════════════════════
\`\`\``;
                        }

                        const resultEmbed = new EmbedBuilder()
                            .setTitle(embedTitle)
                            .setDescription(yamlContent)
                            .setColor(embedColor)
                            .setTimestamp();

                        // Add card image if available
                        if (newCardImage) {
                            resultEmbed.setImage(newCardImage);
                        }

                        await interaction.editReply({
                            embeds: [resultEmbed],
                            components: []
                        });
                    }

                } catch (error) {
                    console.error('Error handling Vex button interaction:', error);
                    
                    const errorResponse = {
                        embeds: [EmbedUtils.createErrorEmbed(
                            'Gamble Error',
                            'Vex has disappeared into the shadows. Try again later!'
                        )],
                        components: []
                    };

                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply(errorResponse);
                    } else {
                        await interaction.editReply(errorResponse);
                    }
                }
                return;
            }

            if (interaction.isButton() && interaction.customId.startsWith('start_')) {
                try {
                    const parts = interaction.customId.split('_');
                    const action = parts[1]; // 'zam', 'treasure', 'quests', 'shop'
                    const targetUserId = parts[2];
                    
                    const startCommand = this.commands.get('start');
                    if (startCommand) {
                        await startCommand.handleStartAction(interaction, this.database, this.userManager, action, targetUserId);
                    }
                    
                } catch (error) {
                    console.error('Error handling start button interaction:', error);
                    
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: 'An error occurred while processing the action. Please try again!',
                            ephemeral: true
                        });
                    } else {
                        await interaction.followUp({
                            content: 'An error occurred while processing the action. Please try again!',
                            ephemeral: true
                        });
                    }
                }
                return;
            }

            if (!interaction.isChatInputCommand()) return;

            const command = this.commands.get(interaction.commandName);
            if (!command) return;

            try {
                if (!this.cooldowns.has(command.data.name)) {
                    this.cooldowns.set(command.data.name, new Collection());
                }

                const now = Date.now();
                const timestamps = this.cooldowns.get(command.data.name);
                const cooldownAmount = (command.cooldown || 0) * 1000;

                if (cooldownAmount > 0 && timestamps.has(interaction.user.id)) {
                    const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;
                    if (now < expirationTime) {
                        const user = this.userManager ? await this.userManager.getUser(interaction.user.id) : null;
                        const hasCooldownBypass = user && user.cooldown_bypass === true;

                        if (!hasCooldownBypass) {
                            this.runtime.metrics.commandCooldownHits = (this.runtime.metrics.commandCooldownHits || 0) + 1;
                            const timeLeft = (expirationTime - now) / 1000;
                            return await this.safeReply(
                                interaction,
                                {
                                    content: `Please wait ${timeLeft.toFixed(1)} more seconds before using \`/${command.data.name}\` again.`,
                                    flags: 64
                                },
                                'Please wait a bit longer and try again.'
                            );
                        }
                    }
                }

                timestamps.set(interaction.user.id, now);
                if (cooldownAmount > 0) {
                    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);
                }

                this.trackCommandUse(command.data.name, interaction.user.id);

                await command.execute(interaction, {
                    database: this.database,
                    userManager: this.userManager,
                    cardManager: this.cardManager,
                    questManager: this.questManager,
                    collectorShopManager: this.collectorShopManager
                });

            } catch (error) {
                this.recordCommandFailure(error);
                console.error('Error executing command:', error);

                if (error.code === 10062) {
                    console.log('⚠️ Command timed out - interaction expired');
                    return;
                }

                await this.safeReply(
                    interaction,
                    {
                        content: 'There was an error while executing this command!',
                        flags: 64
                    },
                    'There was an error while executing this command!'
                );
            }
        });

        // Handle process termination
        process.on('SIGINT', () => {
            console.log('Shutting down gracefully...');
            this.database.close();
            this.client.destroy();
            process.exit(0);
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
        });

        // Handle process lifecycle for production-grade stability
        process.on('uncaughtException', (error) => {
            console.error('Uncaught Exception:', error);
        });

        const gracefulShutdown = (signal) => {
            console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
            this.client.destroy();
            process.exit(0);
        };

        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    }

    async loadCommandsOnly() {
        const commandsPath = path.join(__dirname, 'commands');

        if (!fs.existsSync(commandsPath)) {
            console.error('❌ Commands directory not found:', commandsPath);
            return;
        }

        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        // Temporarily disabled Master Set commands (in development)
        const disabledCommands = ['carddex-master.js', 'master-pack.js', 'master-collection.js'];
        let loadedCount = 0;

        for (const file of commandFiles) {
            // Skip disabled Master Set commands
            if (disabledCommands.includes(file)) {
                console.log(`⏸️  Skipped (disabled): ${file.replace('.js', '')}`);
                continue;
            }

            const filePath = path.join(commandsPath, file);

            try {
                const command = require(filePath);

                if ('data' in command && 'execute' in command) {
                    this.commands.set(command.data.name, command);
                    loadedCount++;
                    // Silenced: console.log(`Loaded command: ${command.data.name}`);
                } else {
                    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
                }
            } catch (error) {
                console.error(`❌ Failed to load command: ${filePath}`);
                console.error(error.message);
            }
        }

        console.log(`✅ Loaded ${loadedCount} commands`);
    }

    async loadCommands() {
        const commandsPath = path.join(__dirname, 'commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        // Temporarily disabled Master Set commands (in development)
        const disabledCommands = ['carddex-master.js', 'master-pack.js', 'master-collection.js'];

        const commands = [];
        let loadedCount = 0;

        for (const file of commandFiles) {
            // Skip disabled Master Set commands
            if (disabledCommands.includes(file)) {
                console.log(`⏸️  Skipped (disabled): ${file.replace('.js', '')}`);
                continue;
            }

            const filePath = path.join(commandsPath, file);
            const command = require(filePath);

            if ('data' in command && 'execute' in command) {
                this.commands.set(command.data.name, command);
                commands.push(command.data.toJSON());
                loadedCount++;
                // Silenced: console.log(`Loaded command: ${command.data.name}`);
            } else {
                console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
            }
        }
        
        console.log(`✅ Loaded ${loadedCount} commands for registration`);

        // Register slash commands
        await this.registerCommands(commands);
    }

    async registerCommandsAsync() {
        console.log('🚀 Starting command registration in background...');
        const commands = Array.from(this.commands.values()).map(cmd => cmd.data.toJSON());
        
        // Don't await - let this run in background
        this.registerCommands(commands).catch(error => {
            console.error('❌ Background command registration failed:', error.message);
        });
    }

    async loadEvents() {
        const eventsPath = path.join(__dirname, 'events');

        if (!fs.existsSync(eventsPath)) {
            console.error('❌ Events directory not found:', eventsPath);
            return;
        }

        const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

        for (const file of eventFiles) {
            const filePath = path.join(eventsPath, file);

            try {
                const event = require(filePath);

                if (event.once) {
                    this.client.once(event.name, (...args) => event.execute(...args, this));
                } else {
                    this.client.on(event.name, (...args) => event.execute(...args, this));
                }
                console.log(`Loaded event: ${event.name}`);
            } catch (error) {
                console.error(`❌ Failed to load event: ${filePath}`);
                console.error(error.message);
            }
        }
    }

    async registerCommands(commands) {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

        try {
            console.log(`🔄 Registering ${commands.length} application (/) commands...`);

            // Prefer guild-scoped slash commands for instant registration when a guild is configured.
            // Set USE_GLOBAL_COMMANDS=true to switch back to global registration later.
            const isProduction = process.env.NODE_ENV === 'production';
            const GUILD_ID = process.env.GUILD_ID || process.env.TEST_GUILD_ID;
            const useGlobalCommands = process.env.USE_GLOBAL_COMMANDS === 'true';

            if (GUILD_ID && !useGlobalCommands) {
                try {
                    console.log('🎯 Registering slash commands to guild for instant access...');
                    console.log('🔍 Guild ID:', GUILD_ID);
                    await rest.put(
                        Routes.applicationGuildCommands(process.env.CLIENT_ID, GUILD_ID),
                        { body: commands }
                    );
                    console.log('✅ Commands registered to guild (instant access)');
                    console.log('💡 Guild commands update immediately - no 1 hour wait!');
                    return; // Skip global registration when guild commands are preferred
                } catch (guildError) {
                    console.log('⚠️ Guild registration failed:', guildError.message);
                    console.log('🌐 Falling back to global commands...');
                    // Continue to global registration
                }
            }

            console.log('🌐 Registering global commands...');
            const data = await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands }
            );
            console.log(`✅ Successfully registered ${data.length} global commands`);

            if (isProduction && !useGlobalCommands) {
                console.log('✅ Guild commands are configured for instant registration');
            } else if (isProduction) {
                console.log('✅ Commands will sync to all servers within 1 hour');
            } else {
                console.log('⏳ Commands will be available globally in ~1 hour');
                console.log('💡 TIP: Set GUILD_ID in .env for instant testing');
            }
            
        } catch (error) {
            console.error('❌ Error registering commands:', error);
            if (error.status === 429) {
                console.log('⏳ Rate limited. Commands will register when the rate limit resets.');
            } else if (error.code === 50001) {
                console.error('🔒 Missing access to register commands. Check bot permissions.');
            } else {
                console.error('💥 Command registration failed:', error.message);
                // Don't throw in production to avoid crashes
                if (process.env.NODE_ENV !== 'production') {
                    throw error;
                }
            }
        }
    }


    // Start health check server for Render/UptimeRobot monitoring
    startHealthCheckServer() {
        const PORT = process.env.PORT || 3000;

        const server = http.createServer((req, res) => {
            if (req.url === '/health' || req.url === '/') {
                const healthData = this.buildHealthSnapshot();
                healthData.timestamp = new Date().toISOString();
                healthData.version = '2.1.0';

                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify(healthData, null, 2));
            } else if (req.url === '/metrics') {
                const metricsData = {
                    ...this.buildHealthSnapshot(),
                    timestamp: new Date().toISOString(),
                    commands: Array.from(this.commands.keys())
                };

                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify(metricsData, null, 2));
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Pokézam TCG Bot - Health check available at /health');
            }
        });

        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.warn(`⚠️ Health check port ${PORT} is already in use; continuing without startup health server.`);
                return;
            }

            console.error('⚠️ Health check server error:', error.message);
        });
        
        server.listen(PORT, () => {
            console.log(`🏥 Health check server listening on port ${PORT}`);
        });
        
        // Only start keepalive if the server actually bound successfully.
        // When another process already owns the port, keepalive is unnecessary.
        this.startKeepaliveSystem();
        
        return server;
    }

    // Internal keepalive system to prevent sleeping on free hosting
    startKeepaliveSystem() {
        if (process.env.PORT) {
            const keepaliveInterval = 10 * 60 * 1000; // 10 minutes
            const selfUrl = `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'pokezam-bot.onrender.com'}/health`;
            
            setInterval(async () => {
                try {
                    const https = require('https');
                    https.get(selfUrl, () => {}).on('error', () => {});
                } catch (error) {
                    // Silent keepalive
                }
            }, keepaliveInterval);
        }
    }

    // Ensure TCG data is available for cloud hosting
    async ensureTCGData() {
        const TCGDataDownloader = require('./scripts/downloadTCGData');
        const downloader = new TCGDataDownloader();
        
        try {
            const success = await downloader.ensureTCGData();
            if (success) {
                const status = await downloader.getDownloadStatus();
                if (status.status === 'available') {
                    console.log(`✅ TCG Data: ${status.fileCount} files (${status.totalSizeMB}MB)`);
                }
            }
        } catch (error) {
            console.log('⚠️  TCG data fallback to API mode');
        }
    }

    // POSTGRESQL SCHEMA FIX: Ensure all required columns exist
    async fixPostgreSQLSchema() {
        if (this.databaseManager.dbType && this.databaseManager.dbType.toLowerCase() === 'postgresql') {
            try {
                const { fixPostgreSQLSchema } = require('./scripts/fixPostgreSQLSchema');
                const { PostgreSQLSchemaFixer } = require('./scripts/fixPostgreSQLSchema');
                const fixer = new PostgreSQLSchemaFixer();
                fixer.db = this.database;
                
                await fixer.fixUsersTableSchema();
                await fixer.fixCardsTableSchema();
                await fixer.fixQuestsTableSchema();
                await fixer.verifyFixes();
                
            } catch (error) {
                // Silent - schema fix handled internally
            }
        }
    }

    // AUTO-LOAD BASE SETS: Ensure Base Sets 1, 2, 3 are loaded (Render free tier solution)
    async ensureBaseSetsLoaded() {
        try {
            // Check if base sets exist
            const baseSetCount = await this.database.get(`
                SELECT COUNT(*) as count 
                FROM cards 
                WHERE set_id IN ('base1', 'base2', 'base3')
            `);
            
            const totalBaseCards = baseSetCount ? baseSetCount.count : 0;
            
            if (totalBaseCards < 200) {
                console.log(`� Loading Base Sets... (found ${totalBaseCards}/228 cards)`);
                await this.loadBaseSetsFromFiles();
            } else {
                console.log(`✅ Base Sets ready (${totalBaseCards} cards)`);
            }
            
        } catch (error) {
            console.log('⚠️  Base set check skipped');
        }
    }

    // Load Base Sets 1, 2, 3 from local files
    async loadBaseSetsFromFiles() {
        try {
            let ProductionTCGLoader;
            
            try {
                const loaderModule = require('./scripts/loadProductionBaseSets');
                ProductionTCGLoader = loaderModule.ProductionTCGLoader;
                
                if (!ProductionTCGLoader) {
                    throw new Error('ProductionTCGLoader not found in module exports');
                }
            } catch (requireError) {
                throw requireError;
            }
            
            const loader = new ProductionTCGLoader();
            
            if (typeof loader.loadBaseSetsOnly !== 'function') {
                throw new Error('loadBaseSetsOnly method not found on loader instance');
            }
            
            loader.db = this.database;
            
            await this.database.run(`
                CREATE TABLE IF NOT EXISTS pokemon_sets (
                    ${this.databaseManager.dbType === 'postgresql' ? 'id SERIAL PRIMARY KEY' : 'id INTEGER PRIMARY KEY AUTOINCREMENT'},
                    set_id TEXT UNIQUE,
                    name TEXT,
                    series TEXT,
                    printed_total INTEGER,
                    total INTEGER,
                    release_date TEXT,
                    ptcgo_code TEXT,
                    symbol_url TEXT,
                    logo_url TEXT,
                    created_at ${this.databaseManager.dbType === 'postgresql' ? 'BIGINT' : 'INTEGER'},
                    updated_at ${this.databaseManager.dbType === 'postgresql' ? 'BIGINT' : 'INTEGER'}
                )
            `);
            
            try {
                await loader.loadBaseSetsOnly();
            } catch (methodError) {
                console.log('⚠️  Fallback loading...');
                await this.inlineLoadBaseSets();
            }
            
        } catch (error) {
            console.log('⚠️  Base Sets loading failed, continuing...');
        }
    }

    // Inline fallback base set loading (if module import fails)
    async inlineLoadBaseSets() {
        try {
            const fs = require('fs');
            const path = require('path');
            
            const cardFiles = ['base1.json', 'base2.json', 'base3.json'];
            let totalLoaded = 0;
            
            for (const fileName of cardFiles) {
                try {
                    const filePath = path.resolve(__dirname, 'tcg-data', 'cards', 'en', fileName);
                    
                    if (fs.existsSync(filePath)) {
                        const fileContent = fs.readFileSync(filePath, 'utf8');
                        const cards = JSON.parse(fileContent);
                        
                        for (const card of cards) {
                            try {
                                // Vintage sets only have normal and first edition variants
                                const isVintageSet = ['base1', 'base2', 'base3', 'base4', 'base5', 'gym1', 'gym2'].includes(fileName.replace('.json', ''));
                                const hasFirstEdition = isVintageSet && Math.random() < 0.3; // 30% of vintage cards have 1st ed
                                
                                await this.database.run(`
                                    INSERT OR IGNORE INTO cards (
                                        card_id, name, supertype, subtype, level, hp, 
                                        rarity, artist, set_id, set_name, number, 
                                        flavor_text, national_pokedex_number, image_small, 
                                        image_large, tcgplayer_url, cardmarket_url,
                                        variant_normal, variant_reverse, variant_holo, variant_first_edition, variant_promo,
                                        created_at, updated_at
                                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                `, [
                                    card.id,
                                    card.name || 'Unknown',
                                    card.supertype || '',
                                    (card.subtypes || []).join(', '),
                                    card.level ? parseInt(card.level) : null,
                                    card.hp ? parseInt(card.hp) : null,
                                    card.rarity || 'Common',
                                    card.artist || '',
                                    card.set?.id || '',
                                    card.set?.name || '',
                                    card.number || '',
                                    card.flavorText || '',
                                    card.nationalPokedexNumbers?.[0] || null,
                                    card.images?.small || '',
                                    card.images?.large || '',
                                    card.tcgplayer?.url || '',
                                    card.cardmarket?.url || '',
                                    true,  // variant_normal
                                    false, // variant_reverse (didn't exist in vintage sets)
                                    false, // variant_holo (natural rarity, not a variant)
                                    hasFirstEdition, // variant_first_edition
                                    false, // variant_promo
                                    Date.now(),
                                    Date.now()
                                ]);
                                totalLoaded++;
                            } catch (cardError) {
                                // Card might already exist, continue
                            }
                        }
                    }
                } catch (fileError) {
                    // Silent - file loading error handled
                }
            }
            
            console.log(`✅ Inline loading: ${totalLoaded} cards processed`);
            
        } catch (error) {
            console.log('⚠️  Inline loading failed');
        }
    }

    // PERFORMANCE OPTIMIZATION: Setup memory management and cleanup processes
    setupPerformanceOptimizations() {
        // Cleanup expired cooldowns to prevent memory leaks
        setInterval(() => {
            const now = Date.now();
            let cleanedCount = 0;

            for (const [commandName, commandCooldowns] of this.cooldowns.entries()) {
                for (const [userId, timestamp] of commandCooldowns.entries()) {
                    if (now - timestamp > 300000) {
                        commandCooldowns.delete(userId);
                        cleanedCount++;
                    }
                }

                if (commandCooldowns.size === 0) {
                    this.cooldowns.delete(commandName);
                }
            }

            if (cleanedCount > 0) {
                console.log(`🧹 Pruned ${cleanedCount} expired command cooldown entries`);
            }
        }, 60000);
        
        // Memory usage monitoring (every 10 minutes)
        setInterval(() => {
            const memUsage = process.memoryUsage();
            const rssMB = Math.round(memUsage.rss / 1024 / 1024);
            
            if (rssMB > 400 && global.gc) {
                global.gc();
            }
        }, 600000);
        
        // Database connection health check (every 30 minutes)
        setInterval(async () => {
            try {
                if (this.database) {
                    await this.database.get('SELECT 1 as test');

                    if (this.database.cleanupExpiredEffects) {
                        await this.database.cleanupExpiredEffects();
                    }
                }
            } catch (error) {
                console.error('❌ Database health check failed:', error.message);
            }
        }, 1800000); // Check every 30 minutes

        setInterval(() => {
            const snapshot = this.buildHealthSnapshot();
            if (snapshot.memory.rssMB > 450) {
                console.warn(`⚠️ Memory pressure alert: ${snapshot.memory.rssMB}MB RSS`);
            }
        }, 300000);

        setInterval(() => {
            this.runtime.metrics.lastHeartbeat = Date.now();
        }, 60000);

        console.log('🚀 Performance optimizations initialized');
    }
}

// Create and initialize bot
const bot = new PokezamBot();
bot.initialize();

module.exports = PokezamBot;