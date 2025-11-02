require('dotenv').config();
const { Client, Collection, GatewayIntentBits, Partials, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('http');
const Database = require('./database/Database');
const UserManager = require('./database/UserManager');
const CardManager = require('./database/CardManager');
const QuestManager = require('./database/QuestManager');
const DatabaseBackupManager = require('./database/DatabaseBackupManager');

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
        
        // Initialize database managers
        this.database = new Database();
        this.userManager = new UserManager(this.database);
        this.cardManager = new CardManager(this.database);
        this.questManager = new QuestManager(this.database);
        this.backupManager = new DatabaseBackupManager();
        
        this.setupEventHandlers();
    }

    async initialize() {
        try {
            // Start health check server IMMEDIATELY for Render deployment detection
            this.startHealthCheckServer();
            console.log('✅ Health check server started early for Render compatibility');
            
            // Ensure TCG data is available (for cloud hosting)
            await this.ensureTCGData();
            
            // Connect to database
            await this.database.connect();
            
            // Try to restore from backup first (for cloud hosting)
            if (process.env.NODE_ENV === 'production' || process.env.PORT) {
                console.log('🔄 Checking for database backup...');
                await this.backupManager.restoreBackup();
            }
            
            await this.database.initialize();
            
            // Load commands and events
            await this.loadCommands();
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
                // Check cooldowns (with admin bypass capability)
                if (!this.cooldowns.has(command.data.name)) {
                    this.cooldowns.set(command.data.name, new Collection());
                }

                const now = Date.now();
                const timestamps = this.cooldowns.get(command.data.name);
                const cooldownAmount = (command.cooldown || 0) * 1000;

                // Check if user has cooldown bypass enabled (admin feature)
                let hasBypass = false;
                try {
                    const userBypassCheck = await this.database.get('SELECT cooldown_bypass FROM users WHERE id = ?', [interaction.user.id]);
                    hasBypass = userBypassCheck?.cooldown_bypass === 1;
                } catch (error) {
                    // If column doesn't exist or query fails, default to no bypass
                    hasBypass = false;
                }

                // Only apply cooldowns if user doesn't have bypass enabled
                if (!hasBypass && timestamps.has(interaction.user.id)) {
                    const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

                    if (now < expirationTime) {
                        const timeLeft = (expirationTime - now) / 1000;
                        return interaction.reply({
                            content: `Please wait ${timeLeft.toFixed(1)} more seconds before using \`/${command.data.name}\` again.`,
                            flags: 64 // ephemeral flag
                        });
                    }
                }

                // Set cooldown timestamp (even for bypass users, for potential logging)
                if (!hasBypass) {
                    timestamps.set(interaction.user.id, now);
                    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);
                }

                // Ensure user exists in database
                let user = await this.userManager.getUser(interaction.user.id);
                if (!user) {
                    user = await this.userManager.createUser(interaction.user.id, interaction.user.username);
                }

                // Execute command
                await command.execute(interaction, {
                    database: this.database,
                    userManager: this.userManager,
                    cardManager: this.cardManager,
                    questManager: this.questManager
                });

            } catch (error) {
                console.error('Error executing command:', error);
                
                const reply = {
                    content: 'There was an error while executing this command!',
                    flags: 64 // ephemeral flag
                };

                try {
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp(reply);
                    } else {
                        await interaction.reply(reply);
                    }
                } catch (followUpError) {
                    console.error('Failed to send error message:', followUpError.message);
                }
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

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('Uncaught Exception:', error);
        });
    }

    async loadCommands() {
        const commandsPath = path.join(__dirname, 'commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        const commands = [];

        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);

            if ('data' in command && 'execute' in command) {
                this.commands.set(command.data.name, command);
                commands.push(command.data.toJSON());
                console.log(`Loaded command: ${command.data.name}`);
            } else {
                console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
            }
        }

        // Register slash commands
        await this.registerCommands(commands);
    }

    async loadEvents() {
        const eventsPath = path.join(__dirname, 'events');
        const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

        for (const file of eventFiles) {
            const filePath = path.join(eventsPath, file);
            const event = require(filePath);

            if (event.once) {
                this.client.once(event.name, (...args) => event.execute(...args, this));
            } else {
                this.client.on(event.name, (...args) => event.execute(...args, this));
            }
            console.log(`Loaded event: ${event.name}`);
        }
    }

    async registerCommands(commands) {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

        try {
            console.log(`🔄 Registering ${commands.length} application (/) commands...`);

            // For development: Register commands to a specific guild for instant sync
            // This allows immediate testing without waiting for global command sync
            const TEST_GUILD_ID = process.env.GUILD_ID || process.env.TEST_GUILD_ID;
            const isProduction = process.env.NODE_ENV === 'production' || process.env.PORT;
            
            if (TEST_GUILD_ID && !isProduction) {
                // Development: Only register to test guild to prevent duplication
                console.log('� Registering to test guild for instant access...');
                await rest.put(
                    Routes.applicationGuildCommands(process.env.CLIENT_ID, TEST_GUILD_ID),
                    { body: commands }
                );
                console.log('✅ Commands registered to test guild (instant access)');
            }

            // TEMPORARY: Use guild commands for debugging (faster sync)
            if (TEST_GUILD_ID) {
                console.log('🔧 DEBUG MODE: Using guild commands for instant sync...');
                await rest.put(
                    Routes.applicationGuildCommands(process.env.CLIENT_ID, TEST_GUILD_ID),
                    { body: commands }
                );
                console.log(`✅ Guild commands registered (debug command available immediately)`);
                
                // Clear global commands to prevent duplication
                await rest.put(
                    Routes.applicationCommands(process.env.CLIENT_ID),
                    { body: [] }
                );
                console.log('🧹 Global commands cleared during debug mode');
            } else {
                // Fallback to global if no test guild
                console.log('🌐 Registering global commands...');
                const data = await rest.put(
                    Routes.applicationCommands(process.env.CLIENT_ID),
                    { body: commands }
                );
                console.log(`✅ Successfully registered ${data.length} global commands`);
            }
            
            if (TEST_GUILD_ID) {
                console.log('💡 DEBUG MODE: Commands available immediately in test server!');
                console.log('🔍 /debug command ready for production troubleshooting');
            } else {
                console.log('ℹ️  Global commands may take up to 1 hour to sync across Discord');
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
                const uptime = Math.floor(process.uptime());
                const memUsage = process.memoryUsage();
                const botStatus = this.client.ws.ping !== -1 ? 'online' : 'offline';
                
                const healthData = {
                    status: 'healthy',
                    bot: botStatus,
                    uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`,
                    memory: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
                    ping: this.client.ws.ping !== -1 ? `${this.client.ws.ping}ms` : 'connecting',
                    timestamp: new Date().toISOString(),
                    version: '2.0.0'
                };
                
                res.writeHead(200, { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify(healthData, null, 2));
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Pokézam TCG Bot - Health check available at /health');
            }
        });
        
        server.listen(PORT, () => {
            console.log(`Health check server running on port ${PORT}`);
        });
        
        // Start internal keepalive system for free hosting
        this.startKeepaliveSystem();
        
        return server;
    }

    // Internal keepalive system to prevent sleeping on free hosting
    startKeepaliveSystem() {
        // Only run keepalive on Render (when PORT env variable is set by hosting)
        if (process.env.PORT) {
            const keepaliveInterval = 10 * 60 * 1000; // 10 minutes
            const selfUrl = `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'pokezam-bot.onrender.com'}/health`;
            
            setInterval(async () => {
                try {
                    const https = require('https');
                    
                    https.get(selfUrl, (res) => {
                        console.log(`🏃 Keepalive ping: ${res.statusCode} - Bot staying awake`);
                    }).on('error', (err) => {
                        console.log(`⚠️  Keepalive ping failed: ${err.message}`);
                    });
                } catch (error) {
                    console.log(`⚠️  Keepalive error: ${error.message}`);
                }
            }, keepaliveInterval);
            
            console.log(`🔄 Keepalive system started - pinging every 10 minutes`);
        }
    }

    // Ensure TCG data is available for cloud hosting
    async ensureTCGData() {
        const TCGDataDownloader = require('./scripts/downloadTCGData');
        const downloader = new TCGDataDownloader();
        
        console.log('🎴 Checking TCG data for cloud hosting...');
        
        try {
            const success = await downloader.ensureTCGData();
            if (success) {
                console.log('✅ TCG data is ready for bot startup');
                
                // Show download status
                const status = await downloader.getDownloadStatus();
                if (status.status === 'available') {
                    console.log(`📊 TCG Data Status: ${status.fileCount} files (${status.totalSizeMB}MB)`);
                }
            } else {
                console.log('⚠️  TCG data download failed, bot will use API fallback');
            }
        } catch (error) {
            console.error('❌ Error ensuring TCG data:', error.message);
            console.log('⚠️  Continuing with API fallback...');
        }
    }
}

// Create and initialize bot
const bot = new PokezamBot();
bot.initialize();

module.exports = PokezamBot;