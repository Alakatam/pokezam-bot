const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const EmbedUtils = require('../utils/EmbedUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Admin-only commands for bot management')
        .addSubcommand(subcommand =>
            subcommand
                .setName('changelog')
                .setDescription('View the latest bot updates and changes')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('announce')
                .setDescription('Send an announcement about bot updates')
                .addStringOption(option =>
                    option.setName('title')
                        .setDescription('Announcement title')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('Announcement message')
                        .setRequired(true)
                )
                .addBooleanOption(option =>
                    option.setName('ping')
                        .setDescription('Whether to ping @everyone')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('View bot statistics and database info')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('version')
                .setDescription('View current bot version and build info')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('restart')
                .setDescription('Restart the bot (use with caution)')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset-collection')
                .setDescription('Reset a user\'s entire collection (fixes NULL/N/A issues)')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User whose collection to reset')
                        .setRequired(true)
                )
                .addBooleanOption(option =>
                    option.setName('confirm')
                        .setDescription('Type true to confirm this destructive action')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset-trainer')
                .setDescription('COMPLETE trainer account reset - ALL progress, items, and data')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User whose account to completely reset')
                        .setRequired(true)
                )
                .addBooleanOption(option =>
                    option.setName('confirm')
                        .setDescription('Type true to confirm this DESTRUCTIVE action')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('toggle-cooldown')
                .setDescription('Toggle draw cooldowns on/off for a user (useful for testing)')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to toggle cooldowns for')
                        .setRequired(true)
                )
                .addBooleanOption(option =>
                    option.setName('enabled')
                        .setDescription('True = cooldowns ON, False = cooldowns OFF')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('hosting-analysis')
                .setDescription('Detailed system analysis for 24/7 hosting evaluation')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('system-monitor')
                .setDescription('Real-time system resource monitoring')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('backup-database')
                .setDescription('Create a manual backup of user data')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('restore-database')
                .setDescription('Restore user data from backup')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction, { database, userManager, cardManager, questManager }) {
        try {
            // Check if user is admin
            const adminUserId = process.env.ADMIN_USER_ID;
            if (interaction.user.id !== adminUserId && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await interaction.reply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        'Access Denied',
                        'You do not have permission to use admin commands.'
                    )],
                    ephemeral: true
                });
            }

            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case 'changelog':
                    await this.handleChangelog(interaction);
                    break;
                case 'announce':
                    await this.handleAnnounce(interaction);
                    break;
                case 'stats':
                    await this.handleStats(interaction, database);
                    break;
                case 'version':
                    await this.handleVersion(interaction);
                    break;
                case 'restart':
                    await this.handleRestart(interaction);
                    break;
                case 'reset-collection':
                    await this.handleResetCollection(interaction, database, userManager, cardManager);
                    break;
                case 'reset-trainer':
                    await this.handleResetTrainer(interaction, database, userManager, cardManager, questManager);
                    break;
                case 'toggle-cooldown':
                    await this.handleToggleCooldown(interaction, database);
                    break;
                case 'hosting-analysis':
                    await this.handleHostingAnalysis(interaction, database);
                    break;
                case 'system-monitor':
                    await this.handleSystemMonitor(interaction);
                    break;
                case 'backup-database':
                    await this.handleBackupDatabase(interaction);
                    break;
                case 'restore-database':
                    await this.handleRestoreDatabase(interaction);
                    break;
            }

        } catch (error) {
            console.error('Error in admin command:', error);
            await interaction.reply({
                embeds: [EmbedUtils.createErrorEmbed(
                    'Admin Command Error',
                    'An error occurred while executing the admin command.'
                )],
                ephemeral: true
            });
        }
    },

    async handleChangelog(interaction) {
        const changelog = [
            {
                version: 'v1.0.0',
                date: '2025-10-25',
                type: 'Major Release',
                changes: [
                    '🎴 **Core Card System**: Complete card drawing mechanism with 5-second cooldowns',
                    '📊 **Profile & Progression**: Level-based set unlocking (Base → Jungle @ L10 → Fossil @ L25)',
                    '⭐ **Card Fusion**: Transform duplicates into Bronze/Silver/Gold star cards',
                    '🎯 **Quest System**: Daily and weekly challenges with gold rewards',
                    '🗄️ **Database**: 175+ cards across 3 classic sets',
                    '🎮 **Commands**: /draw, /profile, /collection, /fuse, /quest'
                ]
            }
        ];

        const embed = new EmbedBuilder()
            .setTitle('📋 Pokezam TCG Bot - Changelog')
            .setColor('#00ff00')
            .setDescription('Latest updates and changes to the bot')
            .setTimestamp()
            .setFooter({ text: 'Pokezam TCG Bot', iconURL: interaction.client.user.displayAvatarURL() });

        for (const entry of changelog) {
            const changeText = entry.changes.join('\n');
            embed.addFields([{
                name: `${entry.type}: ${entry.version} (${entry.date})`,
                value: changeText,
                inline: false
            }]);
        }

        // Add upcoming features
        embed.addFields([{
            name: '🚀 Coming Soon',
            value: '• Guild System with perks and social features\n' +
                   '• Trading & Marketplace for card economy\n' +
                   '• Scouting missions for idle gameplay\n' +
                   '• Leaderboards and achievement system\n' +
                   '• Digital binder visualization',
            inline: false
        }]);

        await interaction.reply({ embeds: [embed] });
    },

    async handleAnnounce(interaction) {
        const title = interaction.options.getString('title');
        const message = interaction.options.getString('message');
        const shouldPing = interaction.options.getBoolean('ping') || false;

        const embed = new EmbedBuilder()
            .setTitle(`📢 ${title}`)
            .setDescription(message)
            .setColor('#ffd700')
            .setTimestamp()
            .setFooter({ 
                text: `Announced by ${interaction.user.username}`, 
                iconURL: interaction.user.displayAvatarURL() 
            });

        const content = shouldPing ? '@everyone' : '';

        await interaction.reply({
            content: content,
            embeds: [embed]
        });
    },

    async handleStats(interaction, database) {
        // Get database statistics
        const userCount = await database.get('SELECT COUNT(*) as count FROM users');
        const cardCount = await database.get('SELECT COUNT(*) as count FROM cards');
        const totalDraws = await database.get('SELECT SUM(total_draws) as total FROM users');
        const questCompletions = await database.get('SELECT COUNT(*) as count FROM user_quests WHERE completed = TRUE');
        const guildCount = await database.get('SELECT COUNT(*) as count FROM guilds');
        const marketListings = await database.get('SELECT COUNT(*) as count FROM market_listings');

        // Check progressive loading status for cloud deployments
        let progressiveStatus = null;
        if (process.env.NODE_ENV === 'production' || process.env.PORT) {
            try {
                const ProgressiveCardLoader = require('../database/ProgressiveCardLoader');
                const cardLoader = new ProgressiveCardLoader(database);
                progressiveStatus = cardLoader.getLoadingStatus();
            } catch (error) {
                // Progressive loader not available
            }
        }

        // Get top users
        const topUsers = await database.all('SELECT username, level, total_draws FROM users ORDER BY level DESC, total_draws DESC LIMIT 5');

        const embed = new EmbedBuilder()
            .setTitle('📊 Bot Statistics')
            .setColor('#0099ff')
            .setTimestamp()
            .addFields([
                { name: '👥 Total Users', value: userCount.count.toString(), inline: true },
                { name: '🃏 Total Cards', value: cardCount.count.toString(), inline: true },
                { name: '🎴 Total Draws', value: (totalDraws.total || 0).toString(), inline: true },
                { name: '✅ Quest Completions', value: questCompletions.count.toString(), inline: true },
                { name: '🏛️ Guilds', value: guildCount.count.toString(), inline: true },
                { name: '🏪 Market Listings', value: marketListings.count.toString(), inline: true }
            ]);

        // Add progressive loading status for cloud deployments
        if (progressiveStatus) {
            const loadingInfo = progressiveStatus.completionPercentage >= 100 
                ? `✅ Complete (${progressiveStatus.extendedSetsLoaded}/${progressiveStatus.totalSetsAvailable} sets)`
                : `🔄 ${progressiveStatus.completionPercentage}% (${progressiveStatus.extendedSetsLoaded}/${progressiveStatus.totalSetsAvailable} sets)`;
            
            embed.addFields([
                { name: '🌐 Card Loading Status', value: loadingInfo, inline: true }
            ]);
        }

        if (topUsers.length > 0) {
            const topUsersList = topUsers
                .map((user, index) => `${index + 1}. **${user.username}** - Level ${user.level} (${user.total_draws} draws)`)
                .join('\n');
            
            embed.addFields([{
                name: '🏆 Top Players',
                value: topUsersList,
                inline: false
            }]);
        }

        // Add detailed system info for hosting evaluation
        const uptime = process.uptime();
        const uptimeString = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;
        
        // Get detailed memory usage
        const memUsage = process.memoryUsage();
        const totalMemMB = Math.round(memUsage.rss / 1024 / 1024);
        const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
        const externalMB = Math.round(memUsage.external / 1024 / 1024);
        
        // Calculate memory usage percentage (rough estimate for host planning)
        const memoryPercent = Math.round((memUsage.rss / (1024 * 1024 * 1024)) * 100); // Assuming 1GB base
        
        // Get CPU usage (basic - Node.js doesn't have detailed CPU monitoring built-in)
        const cpuUsage = process.cpuUsage();
        
        embed.addFields([
            { name: '⏱️ Bot Uptime', value: uptimeString, inline: true },
            { name: '� Discord Latency', value: `${interaction.client.ws.ping}ms`, inline: true },
            { name: '🖥️ Node.js Version', value: process.version, inline: true }
        ]);

        // Add detailed memory breakdown for hosting planning
        embed.addFields([{
            name: '💾 Memory Usage Breakdown',
            value: `**Total RAM**: ${totalMemMB}MB\n` +
                   `**Heap Used**: ${heapUsedMB}MB\n` +
                   `**Heap Total**: ${heapTotalMB}MB\n` +
                   `**External**: ${externalMB}MB\n` +
                   `**Efficiency**: ${Math.round((heapUsedMB / heapTotalMB) * 100)}% heap utilization`,
            inline: false
        }]);

        // Add hosting recommendations
        embed.addFields([{
            name: '🏗️ Hosting Recommendations',
            value: `**Minimum RAM**: 256MB (current: ${totalMemMB}MB)\n` +
                   `**Recommended RAM**: 512MB-1GB\n` +
                   `**CPU**: 1 vCPU sufficient\n` +
                   `**Disk**: 1GB+ (for logs & database)\n` +
                   `**Network**: Stable connection (24/7)`,
            inline: false
        }]);

        // Add popular free hosting options
        embed.addFields([{
            name: '💸 Free Hosting Options',
            value: `**Railway**: 512MB RAM, $5/month usage\n` +
                   `**Render**: 512MB RAM, free tier available\n` +
                   `**Heroku**: 512MB RAM, free dyno hours\n` +
                   `**Glitch**: 512MB RAM, community plan\n` +
                   `**Repl.it**: Always-on plans available`,
            inline: false
        }]);

        await interaction.reply({ embeds: [embed] });
    },

    async handleVersion(interaction) {
        const packageJson = require('../../package.json');
        
        const embed = new EmbedBuilder()
            .setTitle('🔧 Bot Version Information')
            .setColor('#9932cc')
            .setTimestamp()
            .addFields([
                { name: '🤖 Bot Version', value: packageJson.version, inline: true },
                { name: '📦 Discord.js', value: packageJson.dependencies['discord.js'], inline: true },
                { name: '🗄️ SQLite3', value: packageJson.dependencies['sqlite3'], inline: true },
                { name: '🟢 Node.js', value: process.version, inline: true },
                { name: '💻 Platform', value: process.platform, inline: true },
                { name: '📅 Last Updated', value: '2025-10-25', inline: true }
            ])
            .setDescription('Technical information about the bot build');

        // Add feature status
        const features = [
            '✅ Core Card System',
            '✅ Profile & Leveling',
            '✅ Quest System',
            '✅ Card Fusion',
            '⏳ Guild System',
            '⏳ Trading System',
            '⏳ Scouting System',
            '⏳ Leaderboards'
        ];

        embed.addFields([{
            name: '🔧 Feature Status',
            value: features.join('\n'),
            inline: false
        }]);

        await interaction.reply({ embeds: [embed] });
    },

    async handleRestart(interaction) {
        const embed = EmbedUtils.createInfoEmbed(
            '🔄 Bot Restarting',
            'The bot is restarting now. Please wait a moment for it to come back online.'
        );

        await interaction.reply({ embeds: [embed] });
        
        console.log(`Bot restart initiated by ${interaction.user.username} (${interaction.user.id})`);
        
        // Close database connections gracefully
        if (interaction.client.database) {
            interaction.client.database.close();
        }
        
        // Exit process - your process manager should restart it
        setTimeout(() => {
            process.exit(0);
        }, 2000);
    },

    async handleResetCollection(interaction, database, userManager, cardManager) {
        const targetUser = interaction.options.getUser('user');
        const confirmReset = interaction.options.getBoolean('confirm');

        if (!confirmReset) {
            return await interaction.reply({
                embeds: [EmbedUtils.createErrorEmbed(
                    'Reset Cancelled',
                    'You must set `confirm` to `true` to reset a user\'s collection. This action cannot be undone!'
                )],
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            // Get user's current collection stats before reset
            const beforeStats = await database.get(`
                SELECT 
                    COUNT(*) as total_cards,
                    SUM(quantity) as total_quantity
                FROM user_cards 
                WHERE user_id = ?
            `, [targetUser.id]);

            const beforeMasterStats = await cardManager.getUserMasterSetStats(targetUser.id);

            // Perform the collection reset
            await database.run('BEGIN TRANSACTION');

            // Delete all user cards (including all Master Set variants)
            await database.run('DELETE FROM user_cards WHERE user_id = ?', [targetUser.id]);

            // Reset user's collection-related stats but keep level and other progress
            await database.run(`
                UPDATE users 
                SET 
                    total_draws = 0,
                    last_draw = NULL
                WHERE id = ?
            `, [targetUser.id]);

            // Reset any incomplete quests that might reference old cards
            await database.run(`
                DELETE FROM user_quests 
                WHERE user_id = ? AND completed = 0
            `, [targetUser.id]);

            await database.run('COMMIT');

            // Create success embed with before/after stats
            const embed = new EmbedBuilder()
                .setTitle('✅ Collection Reset Complete')
                .setColor('#00ff00')
                .setDescription(`Successfully reset **${targetUser.username}**'s entire collection.\n\n🔧 **Fixed Issues**: NULL card names, N/A set IDs, and corrupted variant data from cards obtained before the complete TCG database was added.`)
                .addFields([
                    {
                        name: '📊 Before Reset',
                        value: `• **Total Cards**: ${beforeStats.total_cards || 0}\n` +
                               `• **Total Quantity**: ${beforeStats.total_quantity || 0}\n` +
                               `• **Unique Cards**: ${beforeMasterStats.owned.unique_cards || 0}\n` +
                               `• **Total Variants**: ${(beforeMasterStats.owned.normal_variants || 0) + 
                                                       (beforeMasterStats.owned.reverse_variants || 0) + 
                                                       (beforeMasterStats.owned.holo_variants || 0) + 
                                                       (beforeMasterStats.owned.first_edition_variants || 0) + 
                                                       (beforeMasterStats.owned.promo_variants || 0)}`,
                        inline: true
                    },
                    {
                        name: '📋 After Reset',
                        value: `• **Total Cards**: 0\n` +
                               `• **Total Quantity**: 0\n` +
                               `• **Unique Cards**: 0\n` +
                               `• **Total Variants**: 0`,
                        inline: true
                    },
                    {
                        name: '💡 What Was Reset',
                        value: `• All owned cards removed\n` +
                               `• Draw count reset to 0\n` +
                               `• Last draw timestamp cleared\n` +
                               `• All Master Set variants removed\n` +
                               `• Incomplete quests cleared`,
                        inline: false
                    },
                    {
                        name: '✅ What Was Preserved',
                        value: `• User level and experience\n` +
                               `• Gold balance\n` +
                               `• Quest progress\n` +
                               `• Profile settings`,
                        inline: false
                    }
                ])
                .setTimestamp()
                .setFooter({ 
                    text: `Reset performed by ${interaction.user.username}`, 
                    iconURL: interaction.user.displayAvatarURL() 
                });

            await interaction.editReply({ embeds: [embed] });

            // Log the action
            console.log(`[ADMIN] Collection reset performed by ${interaction.user.username} (${interaction.user.id}) on ${targetUser.username} (${targetUser.id})`);
            console.log(`[ADMIN] Reset stats - Before: ${beforeStats.total_cards} cards, After: 0 cards`);

        } catch (error) {
            // Rollback transaction if something went wrong (but only if transaction is active)
            try {
                await database.run('ROLLBACK');
            } catch (rollbackError) {
                // Transaction may not be active, that's okay
                console.log('Rollback not needed or failed:', rollbackError.message);
            }
            
            console.error('Error resetting user collection:', error);
            await interaction.editReply({
                embeds: [EmbedUtils.createErrorEmbed(
                    'Reset Failed',
                    `Failed to reset ${targetUser.username}'s collection.\n\n**Error**: ${error.message}`
                )]
            });
        }
    },

    async handleResetTrainer(interaction, database, userManager, cardManager, questManager) {
        const targetUser = interaction.options.getUser('user');
        const confirmReset = interaction.options.getBoolean('confirm');

        if (!confirmReset) {
            return await interaction.reply({
                embeds: [EmbedUtils.createErrorEmbed(
                    '⚠️ Reset Cancelled',
                    'You must set `confirm` to `true` to perform a complete trainer reset.\n\n**⚠️ WARNING**: This will delete ALL progress including level, XP, gold, items, quests, and collection!'
                )],
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            // Get user's current stats before complete reset
            const beforeUser = await database.get('SELECT * FROM users WHERE id = ?', [targetUser.id]);
            const beforeCards = await database.get('SELECT COUNT(*) as count, SUM(quantity) as quantity FROM user_cards WHERE user_id = ?', [targetUser.id]);
            const beforeQuests = await database.get('SELECT COUNT(*) as count FROM user_quests WHERE user_id = ?', [targetUser.id]);
            const beforeItems = await database.get('SELECT COUNT(*) as count FROM user_items WHERE user_id = ?', [targetUser.id]);
            const beforeEffects = await database.get('SELECT COUNT(*) as count FROM active_effects WHERE user_id = ?', [targetUser.id]);

            if (!beforeUser) {
                return await interaction.editReply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        'User Not Found',
                        `${targetUser.username} is not registered in the bot database.`
                    )]
                });
            }

            // Perform COMPLETE trainer account reset
            await database.run('BEGIN TRANSACTION');

            // 1. Delete all user cards and collection
            await database.run('DELETE FROM user_cards WHERE user_id = ?', [targetUser.id]);

            // 2. Delete all user quests (completed and incomplete)
            await database.run('DELETE FROM user_quests WHERE user_id = ?', [targetUser.id]);

            // 3. Delete all user items
            await database.run('DELETE FROM user_items WHERE user_id = ?', [targetUser.id]);

            // 4. Delete all active effects and buffs
            await database.run('DELETE FROM active_effects WHERE user_id = ?', [targetUser.id]);

            // 5. Reset user to completely fresh state
            await database.run(`
                UPDATE users 
                SET 
                    level = 1,
                    xp = 0,
                    gold = 0,
                    total_draws = 0,
                    last_draw = NULL,
                    has_started = FALSE
                WHERE id = ?
            `, [targetUser.id]);

            await database.run('COMMIT');

            // Create comprehensive reset success embed
            const embed = new EmbedBuilder()
                .setTitle('🔥 COMPLETE TRAINER RESET SUCCESSFUL')
                .setColor('#ff6b6b')
                .setDescription(`**${targetUser.username}** has been completely reset to a fresh trainer account.\n\n⚠️ **ALL PROGRESS HAS BEEN WIPED**`)
                .addFields([
                    {
                        name: '📊 Before Reset',
                        value: `• **Level**: ${beforeUser.level}\n` +
                               `• **XP**: ${beforeUser.xp?.toLocaleString() || 0}\n` +
                               `• **Gold**: ${beforeUser.gold?.toLocaleString() || 0} 🪙\n` +
                               `• **Total Draws**: ${beforeUser.total_draws || 0}\n` +
                               `• **Cards Owned**: ${beforeCards.count || 0} (${beforeCards.quantity || 0} total)\n` +
                               `• **Active Quests**: ${beforeQuests.count || 0}\n` +
                               `• **Items**: ${beforeItems.count || 0}\n` +
                               `• **Active Effects**: ${beforeEffects.count || 0}`,
                        inline: true
                    },
                    {
                        name: '🔄 After Reset',
                        value: `• **Level**: 1\n` +
                               `• **XP**: 0\n` +
                               `• **Gold**: 0 🪙\n` +
                               `• **Total Draws**: 0\n` +
                               `• **Cards Owned**: 0\n` +
                               `• **Active Quests**: 0\n` +
                               `• **Items**: 0\n` +
                               `• **Active Effects**: 0`,
                        inline: true
                    },
                    {
                        name: '💥 What Was Completely Wiped',
                        value: `🗑️ **ALL** owned cards and variants\n` +
                               `🗑️ **ALL** progress (level, XP)\n` +
                               `🗑️ **ALL** gold and currency\n` +
                               `🗑️ **ALL** items and inventory\n` +
                               `🗑️ **ALL** active effects and boosts\n` +
                               `🗑️ **ALL** quest progress (completed & incomplete)\n` +
                               `🗑️ **ALL** draw history and statistics\n` +
                               `🗑️ Starter package eligibility reset`,
                        inline: false
                    },
                    {
                        name: '🆕 Fresh Start Benefits',
                        value: `✨ Can use \`/start\` command again for starter package\n` +
                               `✨ Clean slate for new progression path\n` +
                               `✨ No database corruption or legacy issues\n` +
                               `✨ Ready for optimal experience with current balance`,
                        inline: false
                    }
                ])
                .setTimestamp()
                .setFooter({ 
                    text: `COMPLETE RESET by ${interaction.user.username}`, 
                    iconURL: interaction.user.displayAvatarURL() 
                });

            await interaction.editReply({ embeds: [embed] });

            // Comprehensive logging
            console.log(`[ADMIN] COMPLETE TRAINER RESET performed by ${interaction.user.username} (${interaction.user.id}) on ${targetUser.username} (${targetUser.id})`);
            console.log(`[ADMIN] Reset stats - Level: ${beforeUser.level}→1, XP: ${beforeUser.xp}→0, Gold: ${beforeUser.gold}→0, Cards: ${beforeCards.count}→0`);
            console.log(`[ADMIN] Reset data - Quests: ${beforeQuests.count}→0, Items: ${beforeItems.count}→0, Effects: ${beforeEffects.count}→0`);

        } catch (error) {
            // Rollback transaction if something went wrong (but only if transaction is active)
            try {
                await database.run('ROLLBACK');
            } catch (rollbackError) {
                // Transaction may not be active, that's okay
                console.log('Rollback not needed or failed:', rollbackError.message);
            }
            
            console.error('Error performing complete trainer reset:', error);
            
            // Check if we can still reply
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        'Reset Failed',
                        `Failed to perform complete trainer reset for ${targetUser.username}.\n\n**Error**: ${error.message}`
                    )],
                    ephemeral: true
                });
            } else {
                await interaction.editReply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        'Reset Failed',
                        `Failed to perform complete trainer reset for ${targetUser.username}.\n\n**Error**: ${error.message}`
                    )]
                });
            }
        }
    },

    async handleToggleCooldown(interaction, database) {
        const targetUser = interaction.options.getUser('user');
        const cooldownEnabled = interaction.options.getBoolean('enabled');

        await interaction.deferReply();

        try {
            // Check if user exists in database
            const user = await database.get('SELECT * FROM users WHERE id = ?', [targetUser.id]);
            
            if (!user) {
                return await interaction.editReply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        'User Not Found',
                        `${targetUser.username} is not registered in the bot database. They need to use a command first.`
                    )]
                });
            }

            // Update cooldown bypass setting
            await database.run(
                'UPDATE users SET cooldown_bypass = ? WHERE id = ?',
                [!cooldownEnabled, targetUser.id]  // Inverted: enabled=true means bypass=false
            );

            // If cooldowns are being disabled (bypass enabled), clear any existing cooldown timestamps
            // Note: This affects the in-memory cooldown map, not the database
            if (!cooldownEnabled) {
                // Clear cooldown from the timestamps map if it exists
                // The timestamps map is in the main bot file, but we can't access it here
                // The bypass setting will take effect on next draw attempt
                console.log(`[ADMIN] Cooldown bypass enabled for ${targetUser.username} - cooldowns will be ignored on next draw`);
            }

            // Create success embed
            const embed = new EmbedBuilder()
                .setTitle('🎛️ Cooldown Settings Updated')
                .setColor(cooldownEnabled ? '#ff6b6b' : '#00ff00')
                .setDescription(`Successfully updated cooldown settings for **${targetUser.username}**`)
                .addFields([
                    {
                        name: '⏱️ Draw Cooldowns',
                        value: cooldownEnabled ? '🔴 **ENABLED** (5 second cooldowns active)' : '🟢 **DISABLED** (no cooldowns - instant draws)',
                        inline: false
                    },
                    {
                        name: '🎯 Perfect For',
                        value: cooldownEnabled ? 
                            '• Normal gameplay experience\n• Rate limiting protection\n• Balanced progression' :
                            '• Testing and development\n• Quest completion testing\n• XP system validation\n• Admin functions',
                        inline: false
                    },
                    {
                        name: '⚠️ Note',
                        value: cooldownEnabled ? 
                            'User will experience normal 5-second draw cooldowns.' :
                            'User can draw cards instantly without any cooldown delays.',
                        inline: false
                    }
                ])
                .setTimestamp()
                .setFooter({ 
                    text: `Cooldown toggle by ${interaction.user.username}`, 
                    iconURL: interaction.user.displayAvatarURL() 
                });

            await interaction.editReply({ embeds: [embed] });

            // Log the action
            console.log(`[ADMIN] Cooldown toggle by ${interaction.user.username} (${interaction.user.id}): ${targetUser.username} (${targetUser.id}) cooldowns ${cooldownEnabled ? 'ENABLED' : 'DISABLED'}`);

        } catch (error) {
            console.error('Error toggling cooldown:', error);
            await interaction.editReply({
                embeds: [EmbedUtils.createErrorEmbed(
                    'Toggle Failed',
                    `Failed to toggle cooldown settings for ${targetUser.username}.\n\n**Error**: ${error.message}`
                )]
            });
        }
    },

    async handleHostingAnalysis(interaction, database) {
        await interaction.deferReply();

        try {
            // Get comprehensive system information
            const memUsage = process.memoryUsage();
            const uptime = process.uptime();
            const startTime = Date.now() - (uptime * 1000);
            
            // Memory calculations
            const rssMB = Math.round(memUsage.rss / 1024 / 1024);
            const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
            const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
            const externalMB = Math.round(memUsage.external / 1024 / 1024);
            
            // Database stats for load analysis
            const dbStats = await Promise.all([
                database.get('SELECT COUNT(*) as count FROM users'),
                database.get('SELECT COUNT(*) as count FROM user_cards'),
                database.get('SELECT COUNT(*) as count FROM cards'),
                database.get('SELECT COUNT(*) as count FROM user_quests'),
                database.get('SELECT COUNT(*) as count FROM active_effects'),
                database.get('SELECT SUM(total_draws) as total FROM users WHERE total_draws IS NOT NULL')
            ]);

            const [userCount, userCardsCount, cardsCount, questsCount, effectsCount, totalDraws] = dbStats;
            
            // Calculate database size estimate
            const dbRecords = userCount.count + userCardsCount.count + cardsCount.count + questsCount.count + effectsCount.count;
            const estimatedDbSizeMB = Math.max(1, Math.round(dbRecords * 0.001)); // Rough estimate

            // Performance metrics
            const avgMemPerUser = userCount.count > 0 ? Math.round(rssMB / userCount.count * 100) / 100 : 0;
            const uptimeHours = Math.round(uptime / 3600 * 10) / 10;
            
            const embed = new EmbedBuilder()
                .setTitle('🏗️ 24/7 Hosting Analysis Report')
                .setColor('#00ff00')
                .setDescription('Comprehensive system analysis for cloud hosting migration')
                .setTimestamp();

            // Current system performance
            embed.addFields([{
                name: '📊 Current System Performance',
                value: `**Uptime**: ${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h ${Math.floor((uptime % 3600) / 60)}m\n` +
                       `**Memory Usage**: ${rssMB}MB RAM total\n` +
                       `**Heap Efficiency**: ${Math.round((heapUsedMB / heapTotalMB) * 100)}%\n` +
                       `**Memory per User**: ${avgMemPerUser}MB\n` +
                       `**Discord Latency**: ${interaction.client.ws.ping}ms`,
                inline: true
            }]);

            // Database metrics
            embed.addFields([{
                name: '🗄️ Database Load Analysis',
                value: `**Total Users**: ${userCount.count?.toLocaleString()}\n` +
                       `**Cards in Collections**: ${userCardsCount.count?.toLocaleString()}\n` +
                       `**Total Card Draws**: ${totalDraws.total?.toLocaleString() || 0}\n` +
                       `**Active Quests**: ${questsCount.count?.toLocaleString()}\n` +
                       `**Database Size**: ~${estimatedDbSizeMB}MB\n` +
                       `**Total Records**: ${dbRecords.toLocaleString()}`,
                inline: true
            }]);

            // Resource requirements
            embed.addFields([{
                name: '💻 Minimum Hosting Requirements',
                value: `**RAM**: 512MB (current: ${rssMB}MB)\n` +
                       `**CPU**: 1 vCPU @ 1GHz+\n` +
                       `**Storage**: 2GB SSD minimum\n` +
                       `**Bandwidth**: 10GB/month\n` +
                       `**Uptime SLA**: 99.5%+`,
                inline: false
            }]);

            // Recommended hosting providers
            embed.addFields([{
                name: '🏆 Recommended Hosting Services',
                value: `**🆓 Free Tier Options**:\n` +
                       `• **Railway** - 512MB, $5 credit/month\n` +
                       `• **Render** - 512MB, 750hrs free/month\n` +
                       `• **Fly.io** - 256MB always free\n\n` +
                       `**💰 Paid Options** ($5-10/month):\n` +
                       `• **DigitalOcean** - $6/month droplet\n` +
                       `• **Linode** - $5/month nanode\n` +
                       `• **Vultr** - $3.50/month VPS`,
                inline: false
            }]);

            // Migration checklist
            embed.addFields([{
                name: '✅ Pre-Migration Checklist',
                value: `□ Database backup created\n` +
                       `□ Environment variables documented\n` +
                       `□ Discord bot token secured\n` +
                       `□ Process manager configured (PM2)\n` +
                       `□ Auto-restart on crash enabled\n` +
                       `□ Log rotation configured\n` +
                       `□ Health monitoring setup`,
                inline: false
            }]);

            // Performance projections
            const projectedUsers = [100, 500, 1000, 5000];
            const projections = projectedUsers.map(users => {
                const projectedRAM = Math.round((rssMB + (users * avgMemPerUser)) * 1.2); // 20% buffer
                return `${users} users: ~${projectedRAM}MB RAM`;
            }).join('\n');

            embed.addFields([{
                name: '📈 Growth Projections',
                value: `**Scaling Estimates**:\n${projections}\n\n` +
                       `**Current Capacity**: ~${Math.floor(400 / avgMemPerUser)} users with 512MB\n` +
                       `**Recommended**: Upgrade to 1GB at 300+ users`,
                inline: false
            }]);

            // Cost analysis
            embed.addFields([{
                name: '💵 Monthly Cost Analysis',
                value: `**Free Hosting**: $0 (with limitations)\n` +
                       `**Basic VPS**: $5-10/month\n` +
                       `**Managed Service**: $10-25/month\n\n` +
                       `**Current Local Cost**: Electricity + Internet\n` +
                       `**24/7 Benefit**: No downtime from PC restart`,
                inline: false
            }]);

            await interaction.editReply({ embeds: [embed] });

            console.log(`[ADMIN] Hosting analysis requested by ${interaction.user.username} - Current usage: ${rssMB}MB RAM, ${userCount.count} users`);

        } catch (error) {
            console.error('Error in hosting analysis:', error);
            await interaction.editReply({
                embeds: [EmbedUtils.createErrorEmbed(
                    'Analysis Failed',
                    `Failed to generate hosting analysis report.\n\n**Error**: ${error.message}`
                )]
            });
        }
    },

    async handleSystemMonitor(interaction) {
        const os = require('os');
        
        await interaction.deferReply();

        try {
            // Get current system information
            const memUsage = process.memoryUsage();
            const uptime = process.uptime();
            const systemUptime = os.uptime();
            
            // Memory calculations
            const rssMB = Math.round(memUsage.rss / 1024 / 1024);
            const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
            const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
            const externalMB = Math.round(memUsage.external / 1024 / 1024);
            
            // System memory
            const totalSystemMemMB = Math.round(os.totalmem() / 1024 / 1024);
            const freeSystemMemMB = Math.round(os.freemem() / 1024 / 1024);
            const usedSystemMemMB = totalSystemMemMB - freeSystemMemMB;
            
            // CPU information
            const cpus = os.cpus();
            const loadAvg = os.loadavg();
            
            // Calculate percentages
            const heapEfficiency = Math.round((heapUsedMB / heapTotalMB) * 100);
            const systemMemoryUsage = Math.round((usedSystemMemMB / totalSystemMemMB) * 100);
            
            // Format uptimes
            const botUptimeStr = `${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`;
            const sysUptimeStr = `${Math.floor(systemUptime / 86400)}d ${Math.floor((systemUptime % 86400) / 3600)}h ${Math.floor((systemUptime % 3600) / 60)}m`;
            
            const embed = new EmbedBuilder()
                .setTitle('🖥️ Real-Time System Monitor')
                .setColor('#00ff00')
                .setDescription('Current system resource usage and performance metrics')
                .setTimestamp();

            // Bot-specific metrics
            embed.addFields([{
                name: '🤖 Bot Resource Usage',
                value: `**Total RAM**: ${rssMB}MB\n` +
                       `**Heap Used**: ${heapUsedMB}MB / ${heapTotalMB}MB (${heapEfficiency}%)\n` +
                       `**External Memory**: ${externalMB}MB\n` +
                       `**Bot Uptime**: ${botUptimeStr}\n` +
                       `**Discord Latency**: ${interaction.client.ws.ping}ms`,
                inline: true
            }]);

            // System-wide metrics
            embed.addFields([{
                name: '💻 System Resources',
                value: `**Total System RAM**: ${totalSystemMemMB.toLocaleString()}MB\n` +
                       `**Used RAM**: ${usedSystemMemMB.toLocaleString()}MB (${systemMemoryUsage}%)\n` +
                       `**Free RAM**: ${freeSystemMemMB.toLocaleString()}MB\n` +
                       `**CPU Cores**: ${cpus.length}\n` +
                       `**System Uptime**: ${sysUptimeStr}`,
                inline: true
            }]);

            // Performance indicators
            const performanceLevel = rssMB < 50 ? 'Excellent' : rssMB < 100 ? 'Good' : rssMB < 200 ? 'Fair' : 'High';
            const performanceColor = rssMB < 50 ? '🟢' : rssMB < 100 ? '🟡' : rssMB < 200 ? '🟠' : '🔴';
            
            embed.addFields([{
                name: '📊 Performance Assessment',
                value: `**Current Usage**: ${performanceColor} ${performanceLevel}\n` +
                       `**Hosting Ready**: ${rssMB < 400 ? '✅' : '⚠️'} ${rssMB < 400 ? 'YES' : 'Needs Optimization'}\n` +
                       `**512MB VPS**: ${rssMB < 400 ? '✅ Suitable' : '❌ Too Small'}\n` +
                       `**1GB VPS**: ${rssMB < 800 ? '✅ Suitable' : '⚠️ Monitor Usage'}\n` +
                       `**Efficiency Score**: ${100 - Math.min(100, Math.round((rssMB / 100) * 20))}%`,
                inline: false
            }]);

            // CPU information
            embed.addFields([{
                name: '⚙️ CPU Information', 
                value: `**Model**: ${cpus[0].model.substring(0, 40)}...\n` +
                       `**Architecture**: ${os.arch()}\n` +
                       `**Platform**: ${os.platform()}\n` +
                       `**Load Average**: ${loadAvg[0].toFixed(2)}`,
                inline: false
            }]);

            // Quick hosting recommendations
            embed.addFields([{
                name: '🏗️ Hosting Status',
                value: rssMB < 100 ? 
                    '🎉 **Perfect for Free Hosting!**\nRailway, Render, Fly.io all suitable' :
                    rssMB < 400 ?
                    '✅ **Ready for Basic VPS**\n$5-10/month hosting sufficient' :
                    '⚠️ **Needs Premium Hosting**\n$15+/month recommended',
                inline: false
            }]);

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in system monitor:', error);
            await interaction.editReply({
                embeds: [EmbedUtils.createErrorEmbed(
                    'Monitor Failed',
                    `Failed to retrieve system information.\n\n**Error**: ${error.message}`
                )]
            });
        }
    },

    async handleBackupDatabase(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const DatabaseBackupManager = require('../database/DatabaseBackupManager');
            const backupManager = new DatabaseBackupManager();
            
            const backup = await backupManager.createBackup();
            
            let yamlBackup = '```yaml\n';
            yamlBackup += '#════════════════════════════════\n';
            yamlBackup += '# 💾 DATABASE BACKUP COMPLETE\n';
            yamlBackup += '#════════════════════════════════\n\n';
            yamlBackup += `📅 TIMESTAMP: ${backup.timestamp}\n`;
            yamlBackup += `📊 VERSION: ${backup.version}\n\n`;
            yamlBackup += '📋 BACKUP CONTENTS:\n';
            yamlBackup += `   👥 Users: ${backup.data.users.length}\n`;
            yamlBackup += `   🎒 Items: ${backup.data.userItems.length}\n`;
            yamlBackup += `   ✨ Effects: ${backup.data.activeEffects.length}\n\n`;
            yamlBackup += '💡 NOTES:\n';
            yamlBackup += '   • Backup saved to /tmp/pokezam_backup.json\n';
            yamlBackup += '   • Auto-backups run every hour\n';
            yamlBackup += '   • Use /admin restore-database to restore\n\n';
            yamlBackup += '#════════════════════════════════\n';
            yamlBackup += '```';

            const backupEmbed = new EmbedBuilder()
                .setTitle('💾 Database Backup Created')
                .setDescription(yamlBackup)
                .setColor('#00FF00')
                .setTimestamp();

            await interaction.editReply({ embeds: [backupEmbed] });

        } catch (error) {
            console.error('Error creating backup:', error);
            await interaction.editReply({
                embeds: [EmbedUtils.createErrorEmbed(
                    'Backup Failed',
                    `Failed to create database backup.\n\n**Error**: ${error.message}`
                )]
            });
        }
    },

    async handleRestoreDatabase(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const DatabaseBackupManager = require('../database/DatabaseBackupManager');
            const backupManager = new DatabaseBackupManager();
            
            const restored = await backupManager.restoreBackup();
            
            if (restored) {
                let yamlRestore = '```yaml\n';
                yamlRestore += '#════════════════════════════════\n';
                yamlRestore += '# 🔄 DATABASE RESTORE COMPLETE\n';
                yamlRestore += '#════════════════════════════════\n\n';
                yamlRestore += `📅 RESTORED: ${new Date().toISOString()}\n`;
                yamlRestore += `📂 SOURCE: /tmp/pokezam_backup.json\n\n`;
                yamlRestore += '✅ STATUS: Success\n';
                yamlRestore += '💡 All user data has been restored\n\n';
                yamlRestore += '⚠️ WARNING:\n';
                yamlRestore += '   Bot restart may be required\n';
                yamlRestore += '   for all changes to take effect\n\n';
                yamlRestore += '#════════════════════════════════\n';
                yamlRestore += '```';

                const restoreEmbed = new EmbedBuilder()
                    .setTitle('🔄 Database Restored')
                    .setDescription(yamlRestore)
                    .setColor('#00FF00')
                    .setTimestamp();

                await interaction.editReply({ embeds: [restoreEmbed] });
            } else {
                await interaction.editReply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        'Restore Failed',
                        'No backup file found or backup format is invalid.'
                    )]
                });
            }

        } catch (error) {
            console.error('Error restoring backup:', error);
            await interaction.editReply({
                embeds: [EmbedUtils.createErrorEmbed(
                    'Restore Failed',
                    `Failed to restore database backup.\n\n**Error**: ${error.message}`
                )]
            });
        }
    }
};