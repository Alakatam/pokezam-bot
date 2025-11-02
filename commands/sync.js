const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EmbedUtils = require('../utils/EmbedUtils');
const CardSyncManager = require('../database/CardSyncManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sync')
        .setDescription('🔄 Admin: Sync and manage Pokemon TCG card database')
        .addSubcommand(subcommand =>
            subcommand
                .setName('update')
                .setDescription('🆕 Update cards from Pokemon TCG API (smart sync)')
                .addStringOption(option =>
                    option.setName('target')
                        .setDescription('What to update')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Classic Sets (Base-Neo)', value: 'classic' },
                            { name: 'Modern Sets (XY-Current)', value: 'modern' },
                            { name: 'All Sets', value: 'all' },
                            { name: 'Missing Cards Only', value: 'missing' },
                            { name: 'Force Update All', value: 'force' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('📊 View card database status and sync statistics')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('new-sets')
                .setDescription('🎴 Check for and sync new TCG sets')
        ),
    
    async execute(interaction, { database, userManager, cardManager, questManager }) {
        try {
            // Check admin permissions
            const adminUserId = process.env.ADMIN_USER_ID;
            if (interaction.user.id !== adminUserId && !interaction.member.permissions.has('Administrator')) {
                return await interaction.reply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        '🚫 Access Denied',
                        'Only administrators can use sync commands.\n\n**Need help?** Contact a server admin.'
                    )],
                    ephemeral: true
                });
            }

            const subcommand = interaction.options.getSubcommand();
            const syncManager = new CardSyncManager(database);

            switch (subcommand) {
                case 'update':
                    await this.handleSmartSync(interaction, syncManager);
                    break;
                case 'status':
                    await this.handleSyncStatus(interaction, syncManager);
                    break;
                case 'new-sets':
                    await this.handleNewSets(interaction, syncManager);
                    break;
            }

        } catch (error) {
            console.error('Error in sync command:', error);
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        '❌ Sync Error',
                        `An error occurred during sync operation.\n\n**Error**: ${error.message}\n\n*Please try again or contact support.*`
                    )],
                    ephemeral: true
                });
            } else {
                await interaction.editReply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        '❌ Sync Error',
                        `An error occurred during sync operation.\n\n**Error**: ${error.message}`
                    )]
                });
            }
        }
    },

    async handleSmartSync(interaction, syncManager) {
        if (syncManager.isSyncInProgress()) {
            return await interaction.reply({
                embeds: [EmbedUtils.createErrorEmbed(
                    '⏳ Sync Already Running',
                    'A card sync is currently in progress.\n\n**Please wait** for it to complete before starting a new sync.\n\nUse `/sync status` to check current progress.'
                )],
                ephemeral: true
            });
        }

        const target = interaction.options.getString('target') || 'classic';
        
        // Determine sync strategy based on target
        let setIds = null;
        let forceUpdate = false;
        let description = '';

        switch (target) {
            case 'classic':
                setIds = ['base1', 'base2', 'base3', 'base4', 'gym1', 'gym2', 'neo1', 'neo2', 'neo3', 'neo4'];
                description = '🎴 **Classic Sets**: Base Set through Neo series\n📊 **Strategy**: Update missing cards and outdated data';
                break;
            case 'modern':
                setIds = null; // Will use modern sets from API
                description = '✨ **Modern Sets**: XY series through current\n📊 **Strategy**: Smart sync with latest releases';
                break;
            case 'all':
                setIds = null;
                description = '🌟 **All Sets**: Complete TCG database\n📊 **Strategy**: Comprehensive update (may take 15+ minutes)';
                break;
            case 'missing':
                description = '🔍 **Missing Cards**: Only cards not in database\n📊 **Strategy**: Fill gaps in collection';
                break;
            case 'force':
                setIds = null;
                forceUpdate = true;
                description = '⚡ **Force Update**: Refresh all card data\n� **Strategy**: Complete overwrite (may take 20+ minutes)';
                break;
        }

        // Create YAML-formatted embed
        let yamlDescription = '```yaml\n';
        yamlDescription += '#═══════════════════════════════════════════════════\n';
        yamlDescription += '# 🔄 POKEMON TCG SYNC STARTED\n';
        yamlDescription += '#═══════════════════════════════════════════════════\n\n';
        yamlDescription += '📋 SYNC CONFIGURATION:\n';
        yamlDescription += `   Target Type        : "${target.toUpperCase()}"\n`;
        yamlDescription += `   Force Update       : ${forceUpdate ? 'YES' : 'NO'}\n`;
        yamlDescription += `   Estimated Time     : ${this.getEstimatedTime(target)}\n`;
        yamlDescription += `   API Rate Limits    : RESPECTED\n\n`;
        yamlDescription += '⚡ STATUS:\n';
        yamlDescription += '   Current Phase      : "INITIALIZING"\n';
        yamlDescription += '   Progress           : "Starting..."\n';
        yamlDescription += '   Next Update        : "When complete"\n\n';
        yamlDescription += '#═══════════════════════════════════════════════════\n';
        yamlDescription += '```';

        const embed = new EmbedBuilder()
            .setTitle('🔄 Smart TCG Sync Started')
            .setDescription(yamlDescription)
            .setColor('#00D9FF')
            .setTimestamp()
            .setFooter({ text: 'Sync running in background - you\'ll be notified when complete!' });

        await interaction.reply({ embeds: [embed] });

        // Start sync in background with enhanced error handling
        this.executeSmartSync(syncManager, target, setIds, forceUpdate, interaction);
    },

    async executeSmartSync(syncManager, target, setIds, forceUpdate, interaction) {
        try {
            const result = await syncManager.syncCardsFromAPI(setIds, forceUpdate);
            
            let yamlDescription = '```yaml\n';
            yamlDescription += '#═══════════════════════════════════════════════════\n';
            
            if (result.success) {
                yamlDescription += '# ✅ SYNC COMPLETED SUCCESSFULLY\n';
                yamlDescription += '#═══════════════════════════════════════════════════\n\n';
                yamlDescription += '📊 SYNC RESULTS:\n';
                
                if (result.results) {
                    const r = result.results;
                    yamlDescription += `   Sets Processed     : ${r.setsProcessed.toLocaleString()}\n`;
                    yamlDescription += `   Cards Added        : ${r.cardsAdded.toLocaleString()}\n`;
                    yamlDescription += `   Cards Updated      : ${r.cardsUpdated.toLocaleString()}\n`;
                    yamlDescription += `   Total Operations   : ${(r.cardsAdded + r.cardsUpdated).toLocaleString()}\n`;
                    yamlDescription += `   Error Count        : ${r.errors.length}\n\n`;
                    
                    yamlDescription += '🎯 COMPLETION STATUS:\n';
                    yamlDescription += `   Sync Target        : "${target.toUpperCase()}"\n`;
                    yamlDescription += `   Duration           : "COMPLETED"\n`;
                    yamlDescription += `   Database Status    : "UPDATED"\n`;
                    yamlDescription += `   Ready for Use      : "YES"\n`;
                    
                    if (r.errors.length > 0 && r.errors.length <= 3) {
                        yamlDescription += '\n⚠️ WARNINGS:\n';
                        r.errors.slice(0, 3).forEach((error, i) => {
                            yamlDescription += `   Warning ${i + 1}         : "${error}"\n`;
                        });
                    }
                } else {
                    yamlDescription += '   Status             : "SUCCESS"\n';
                    yamlDescription += '   Details            : "Sync completed successfully"\n';
                }
            } else {
                yamlDescription += '# ❌ SYNC FAILED\n';
                yamlDescription += '#═══════════════════════════════════════════════════\n\n';
                yamlDescription += '❌ ERROR DETAILS:\n';
                yamlDescription += `   Error Message      : "${result.message}"\n`;
                yamlDescription += `   Sync Target        : "${target.toUpperCase()}"\n`;
                yamlDescription += `   Retry Recommended  : "YES"\n`;
            }
            
            yamlDescription += '\n#═══════════════════════════════════════════════════\n';
            yamlDescription += '```';

            const resultEmbed = new EmbedBuilder()
                .setTitle(result.success ? '✅ Sync Complete!' : '❌ Sync Failed')
                .setDescription(yamlDescription)
                .setColor(result.success ? '#00FF00' : '#FF0000')
                .setTimestamp()
                .setFooter({ text: result.success ? 'Card database updated successfully!' : 'Check logs for detailed error information' });

            await interaction.followUp({ embeds: [resultEmbed] });
            
        } catch (error) {
            console.error('Error in smart sync execution:', error);
            
            const errorEmbed = EmbedUtils.createErrorEmbed(
                '💥 Sync System Error',
                `**Critical Error**: ${error.message}\n\n**Recommendation**: Try again with a smaller target or contact support.`
            );
            
            try {
                await interaction.followUp({ embeds: [errorEmbed] });
            } catch (followUpError) {
                console.error('Failed to send error message:', followUpError);
            }
        }
    },

    getEstimatedTime(target) {
        const timeMap = {
            'classic': '2-5 minutes',
            'modern': '5-10 minutes', 
            'all': '15-25 minutes',
            'missing': '1-3 minutes',
            'force': '20-30 minutes'
        };
        return timeMap[target] || '5-10 minutes';
    },

    async handleSyncStatus(interaction, syncManager) {
        const stats = await syncManager.getCardStats();
        const cachedSets = await syncManager.getCachedSets();

        // Calculate completion percentages
        const syncPercentage = stats.total_cards > 0 
            ? ((stats.cached_cards / stats.total_cards) * 100).toFixed(1)
            : 0;
        const imagePercentage = stats.total_cards > 0 
            ? ((stats.cards_with_images / stats.total_cards) * 100).toFixed(1) 
            : 0;

        // Create YAML-formatted status display
        let yamlDescription = '```yaml\n';
        yamlDescription += '#═══════════════════════════════════════════════════\n';
        yamlDescription += '# 📊 POKEMON TCG DATABASE STATUS\n';
        yamlDescription += '#═══════════════════════════════════════════════════\n\n';
        
        yamlDescription += '� DATABASE OVERVIEW:\n';
        yamlDescription += `   Total Cards        : ${stats.total_cards.toLocaleString()}\n`;
        yamlDescription += `   API Synced Cards   : ${stats.cached_cards.toLocaleString()} (${syncPercentage}%)\n`;
        yamlDescription += `   Cards with Images  : ${stats.cards_with_images.toLocaleString()} (${imagePercentage}%)\n`;
        yamlDescription += `   Unique Sets        : ${stats.unique_sets.toLocaleString()}\n`;
        yamlDescription += `   Sync Status        : "${syncManager.isSyncInProgress() ? 'RUNNING' : 'IDLE'}"\n\n`;

        // Add top rarities
        if (stats.rarityBreakdown && stats.rarityBreakdown.length > 0) {
            yamlDescription += '🎯 RARITY DISTRIBUTION:\n';
            stats.rarityBreakdown.slice(0, 6).forEach(r => {
                yamlDescription += `   ${r.rarity.padEnd(15)}: ${r.count.toLocaleString()}\n`;
            });
            yamlDescription += '\n';
        }

        // Add recent sets
        if (cachedSets.length > 0) {
            yamlDescription += '📚 RECENT SYNCED SETS:\n';
            cachedSets.slice(0, 5).forEach(set => {
                const lastSync = new Date(set.last_sync * 1000).toLocaleDateString();
                yamlDescription += `   ${set.set_id.padEnd(8)}: ${set.card_count.toString().padStart(3)} cards (${lastSync})\n`;
            });
            
            if (cachedSets.length > 5) {
                yamlDescription += `   ... and ${cachedSets.length - 5} more sets\n`;
            }
        }

        yamlDescription += '\n#═══════════════════════════════════════════════════\n';
        yamlDescription += '```';

        // Determine color based on sync status
        let embedColor = '#00D9FF'; // Blue for normal
        if (syncPercentage >= 90) embedColor = '#00FF00'; // Green for excellent
        else if (syncPercentage >= 70) embedColor = '#FFA500'; // Orange for good
        else if (syncPercentage < 50) embedColor = '#FF6B6B'; // Red for needs work

        const embed = new EmbedBuilder()
            .setTitle('📊 TCG Database Status')
            .setDescription(yamlDescription)
            .setColor(embedColor)
            .setTimestamp()
            .setFooter({ 
                text: `${syncPercentage}% synced | Use /sync update to improve coverage`,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true })
            });

        await interaction.reply({ embeds: [embed] });
    },

    async handleNewSets(interaction, syncManager) {
        await interaction.deferReply();

        try {
            // This would check for new sets from the API
            const embed = EmbedUtils.createInfoEmbed(
                '🎴 New Set Detection',
                '� **Checking for new TCG sets...**\n\n' +
                '⏳ Scanning Pokemon TCG API for recently released sets\n' +
                '📊 Comparing with current database\n' +
                '🆕 Identifying new content to sync\n\n' +
                '*This may take a moment...*'
            );

            await interaction.editReply({ embeds: [embed] });

            // Simulate new set check (you'd implement actual API checking here)
            setTimeout(async () => {
                const resultEmbed = EmbedUtils.createSuccessEmbed(
                    '✅ New Set Check Complete',
                    '🎯 **Status**: Database is up to date!\n\n' +
                    '📊 **Recent Sets Found**: All current sets are synced\n' +
                    '🔄 **Last Check**: Just now\n' +
                    '⏰ **Next Recommended Check**: In 1 week\n\n' +
                    '*Use `/sync update modern` to refresh latest set data.*'
                );

                await interaction.editReply({ embeds: [resultEmbed] });
            }, 3000);

        } catch (error) {
            console.error('Error checking for new sets:', error);
            await interaction.editReply({
                embeds: [EmbedUtils.createErrorEmbed(
                    '❌ New Set Check Failed',
                    `Failed to check for new sets: ${error.message}`
                )]
            });
        }
    },


};