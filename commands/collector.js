const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('collector')
        .setDescription("Manage your Collector's Shop - passive income tycoon!")
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('View your shop status and all departments'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('collect')
                .setDescription('Collect generated resources from your departments'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('upgrade')
                .setDescription('Upgrade your global shop level'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('upgrade-dept')
                .setDescription('Upgrade a specific department')
                .addStringOption(option =>
                    option
                        .setName('department')
                        .setDescription('Choose which department to upgrade')
                        .setRequired(true)
                        .addChoices(
                            { name: '💰 Trade Counter', value: 'trade_counter' },
                            { name: '📦 Bulk Bin', value: 'bulk_bin' },
                            { name: '💎 Glass Display Case', value: 'glass_case' },
                            { name: '🎁 Pack Storage Room', value: 'pack_storage' },
                            { name: '⭐ Expert Grader', value: 'expert_grader' }
                        ))),

    async execute(interaction, { database, userManager, collectorShopManager, cardManager }) {
        try {
            await interaction.deferReply();

            const user = await userManager.getUser(interaction.user.id);

            // Check if user has started
            if (!user || !user.has_started) {
                return await interaction.editReply({
                    embeds: [{
                        title: "🏪 Collector's Shop Locked",
                        description: "```yaml\n" +
                            "#════════════════════════════════════════\n" +
                            "# 🏪 COLLECTOR'S SHOP - START REQUIRED\n" +
                            "#════════════════════════════════════════\n\n" +
                            "status: LOCKED\n" +
                            "requirement: Complete /start onboarding\n\n" +
                            "shop features:\n" +
                            "  passive income: Generate coins 24/7\n" +
                            "  card generation: Earn cards while offline\n" +
                            "  pack finder: Chance to find sealed packs\n" +
                            "  upgrade system: Improve generation rates\n\n" +
                            "unlock: Type '/start' to begin!\n" +
                            "#════════════════════════════════════════\n" +
                            "```",
                        color: 0xFF0000,
                        timestamp: new Date().toISOString()
                    }]
                });
            }

            const subcommand = interaction.options.getSubcommand();
            
            // Run auto-unlock for ALL commands (await for upgrade-dept to ensure departments are unlocked)
            if (subcommand === 'upgrade-dept' || subcommand === 'collect') {
                await this.autoUnlockDepartments(interaction.user.id, collectorShopManager, database);
            } else if (subcommand === 'status') {
                // Background unlock for status (don't block response)
                this.autoUnlockDepartments(interaction.user.id, collectorShopManager, database).catch(err => 
                    console.error('Background auto-unlock error:', err)
                );
            }

            switch (subcommand) {
                case 'status':
                    await this.handleStatus(interaction, user, collectorShopManager);
                    break;
                case 'collect':
                    await this.handleCollect(interaction, user, userManager, database, collectorShopManager, cardManager);
                    break;
                case 'upgrade':
                    await this.handleUpgrade(interaction, user, userManager, collectorShopManager);
                    break;
                case 'upgrade-dept':
                    await this.handleUpgradeDept(interaction, user, userManager, collectorShopManager);
                    break;
                default:
                    await interaction.editReply({ content: '❌ Unknown subcommand!' });
            }

        } catch (error) {
            console.error('Error in collector command:', error);
            const reply = { content: '❌ An error occurred. Please try again!', ephemeral: true };
            if (interaction.deferred) {
                await interaction.editReply(reply);
            } else {
                await interaction.reply(reply);
            }
        }
    },

    /**
     * Handle /collector status
     */
    async handleStatus(interaction, user, collectorShopManager) {
        try {
            const shop = await collectorShopManager.getOrCreateShop(interaction.user.id);
            const departments = await collectorShopManager.getUserDepartments(interaction.user.id);

            // Build clean overview embed
            const embed = await this.buildOverviewEmbed(interaction, user, shop, departments, collectorShopManager);
            
            // Build department navigation buttons
            const components = this.buildDepartmentButtons(departments, collectorShopManager, interaction.user.id);

            // Cache shop data for button handlers
            if (!this.collectorStatusCache) this.collectorStatusCache = new Map();
            this.collectorStatusCache.set(interaction.user.id, {
                shop,
                departments,
                timestamp: Date.now()
            });

            // Clean up old cache (older than 10 minutes)
            for (const [userId, data] of this.collectorStatusCache.entries()) {
                if (Date.now() - data.timestamp > 600000) {
                    this.collectorStatusCache.delete(userId);
                }
            }

            await interaction.editReply({ 
                embeds: [embed],
                components: components.length > 0 ? components : []
            });

        } catch (error) {
            console.error('Error in handleStatus:', error);
            await interaction.editReply({ content: '❌ Error loading shop status!' });
        }
    },

    /**
     * Build clean overview embed
     */
    async buildOverviewEmbed(interaction, user, shop, departments, collectorShopManager) {
        const { EmbedBuilder } = require('discord.js');
        const nextUpgradeCost = collectorShopManager.getGlobalUpgradeCost(shop.shop_level);

        const unlockedDepts = departments.filter(d => d.level > 0);
        const totalAvailable = Object.keys(collectorShopManager.departments).length;

        // Calculate total ready to collect
        let totalCoins = 0;
        let totalCards = 0;
        let totalPacks = 0;
        
        for (const dept of unlockedDepts) {
            const status = await collectorShopManager.getDepartmentStatus(
                interaction.user.id,
                dept.department_id,
                dept.level
            );
            if (status) {
                const config = collectorShopManager.departments[dept.department_id];
                if (config.resource === 'coins') totalCoins += status.generated;
                if (config.resource === 'cards') totalCards += status.generated;
                if (config.resource === 'packs') totalPacks += status.generated;
            }
        }

        let yamlStatus = '```yaml\n';
        yamlStatus += '#════════════════════════════════════════\n';
        yamlStatus += "# 🏪 COLLECTOR'S SHOP OVERVIEW\n";
        yamlStatus += '#════════════════════════════════════════\n\n';

        yamlStatus += `👤 TRAINER: ${interaction.user.username}\n`;
        yamlStatus += `� GOLD: ${user.gold.toLocaleString()}g\n\n`;

        yamlStatus += `🏪 SHOP LEVEL: ${shop.shop_level}\n`;
        yamlStatus += `   Upgrade Cost: ${nextUpgradeCost.toLocaleString()}g\n`;
        yamlStatus += `   Departments: ${unlockedDepts.length}/${totalAvailable} Active\n\n`;

        yamlStatus += `📊 LIFETIME EARNINGS:\n`;
        yamlStatus += `   Coins: ${shop.lifetime_coins_generated.toLocaleString()}g\n`;
        yamlStatus += `   Cards: ${shop.lifetime_cards_generated}\n\n`;

        if (totalCoins > 0 || totalCards > 0 || totalPacks > 0) {
            yamlStatus += `💼 READY TO COLLECT:\n`;
            if (totalCoins > 0) yamlStatus += `   � Coins: ${totalCoins.toLocaleString()}g\n`;
            if (totalCards > 0) yamlStatus += `   🃏 Cards: ${totalCards}\n`;
            if (totalPacks > 0) yamlStatus += `   🎁 Packs: ${totalPacks}\n`;
            yamlStatus += '\n';
        }

        yamlStatus += '💡 Click buttons below for department details!\n';
        yamlStatus += '#════════════════════════════════════════\n';
        yamlStatus += '```';

        const embed = new EmbedBuilder()
            .setTitle(`🏪 ${interaction.user.username}'s Collector Shop`)
            .setDescription(yamlStatus)
            .setColor('#FFD700')
            .setTimestamp()
            .setFooter({
                text: `Shop Level ${shop.shop_level} • Use /collector collect to claim rewards`,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true })
            });

        return embed;
    },

    /**
     * Build department navigation buttons
     */
    buildDepartmentButtons(departments, collectorShopManager, userId) {
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const rows = [];

        // Row 1: Active departments (unlocked, level > 0)
        const activeDepts = departments.filter(d => d.level > 0);
        if (activeDepts.length > 0) {
            const activeRow = new ActionRowBuilder();
            for (const dept of activeDepts.slice(0, 5)) { // Max 5 buttons per row
                const config = collectorShopManager.departments[dept.department_id];
                activeRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`collector_dept_${dept.department_id}_${userId}`)
                        .setLabel(`${config.emoji} ${config.name}`)
                        .setStyle(ButtonStyle.Primary)
                );
            }
            rows.push(activeRow);
        }

        // Row 2: Locked/Available departments
        const allDeptIds = Object.keys(collectorShopManager.departments);
        const lockedDepts = allDeptIds.filter(id => {
            const dept = departments.find(d => d.department_id === id);
            return !dept || dept.level === 0;
        }).slice(0, 5); // Max 5 buttons

        if (lockedDepts.length > 0) {
            const lockedRow = new ActionRowBuilder();
            for (const deptId of lockedDepts) {
                const config = collectorShopManager.departments[deptId];
                lockedRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`collector_dept_${deptId}_${userId}`)
                        .setLabel(`${config.emoji} ${config.name}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true) // Locked departments are disabled
                );
            }
            rows.push(lockedRow);
        }

        return rows;
    },

    /**
     * Handle /collector collect
     */
    async handleCollect(interaction, user, userManager, database, collectorShopManager, cardManager) {
        try {
            const result = await collectorShopManager.collectAll(interaction.user.id);

            if (!result.success) {
                return await interaction.editReply({
                    content: `❌ Collection failed: ${result.error}`
                });
            }

            // Award collected resources to user
            if (result.results.coins > 0) {
                await userManager.addGold(interaction.user.id, result.results.coins);
            }

            let collectionData = null;
            if (result.results.cards > 0) {
                // Show loading message for large collections
                if (result.results.cards > 50) {
                    await interaction.editReply(`⏳ Collecting ${result.results.cards} cards...`);
                }

                // INSTANT COLLECTION: Transfer pre-generated cards from pending table
                collectionData = await collectorShopManager.collectPendingCards(interaction.user.id, cardManager);
                
                // Store for display
                result.rarityCount = collectionData.rarityCount;
                result.holoCards = collectionData.holoCards; // Full card objects, not strings
            }

            // Create collection summary
            let yamlCollect = '```yaml\n';
            yamlCollect += '#════════════════════════════════════════\n';
            yamlCollect += '# 💰 COLLECTION COMPLETE\n';
            yamlCollect += '#════════════════════════════════════════\n\n';

            yamlCollect += `📦 COLLECTED:\n`;
            if (result.results.coins > 0) {
                yamlCollect += `   💰 Coins: +${result.results.coins.toLocaleString()}g\n`;
            }
            if (result.results.cards > 0) {
                yamlCollect += `   🃏 Cards: +${result.results.cards}\n\n`;
                
                // Show pull overview
                yamlCollect += `📊 PULL OVERVIEW:\n`;
                const sortedRarities = Object.entries(result.rarityCount).sort((a, b) => b[1] - a[1]);
                for (const [rarity, count] of sortedRarities) {
                    yamlCollect += `   ${rarity}: ${count}x\n`;
                }
                
                // Show notable pulls count
                if (result.holoCards.length > 0) {
                    yamlCollect += `\n✨ Notable Pulls: ${result.holoCards.length} Holo+ cards\n`;
                    yamlCollect += `   Click "View Holo+ Cards" below to see them!\n`;
                }
            }
            if (result.results.packs > 0) {
                yamlCollect += `\n   🎁 Packs: +${result.results.packs} Sealed\n`;
            }

            if (result.results.coins === 0 && result.results.cards === 0 && result.results.packs === 0) {
                yamlCollect += `   ⚠️ Nothing to collect!\n`;
                yamlCollect += `   Departments are still generating...\n`;
            }

            yamlCollect += '\n';

            yamlCollect += `📊 UPDATED BALANCE:\n`;
            yamlCollect += `   Gold: ${(user.gold + result.results.coins).toLocaleString()}g\n`;
            yamlCollect += `   New Cards: ${result.results.cards}\n\n`;

            yamlCollect += `🏬 DEPARTMENTS:\n`;
            for (const dept of result.results.departments) {
                const coins = dept.collected.coins || 0;
                const cards = dept.collected.cards || 0;
                const packs = dept.collected.packs || 0;

                if (coins > 0 || cards > 0 || packs > 0) {
                    yamlCollect += `   ${dept.name}:\n`;
                    if (coins > 0) yamlCollect += `     Coins: ${coins.toLocaleString()}g\n`;
                    if (cards > 0) yamlCollect += `     Cards: ${cards}\n`;
                    if (packs > 0) yamlCollect += `     Packs: ${packs}\n`;
                    // Show variance quality
                    if (dept.varianceDesc) {
                        yamlCollect += `     ${dept.varianceDesc}\n`;
                    }
                }
            }

            yamlCollect += '\n💡 Shop reopened with new daily variance!\n';
            yamlCollect += '#════════════════════════════════════════\n';
            yamlCollect += '```';

            const embed = new EmbedBuilder()
                .setTitle('💰 Collection Complete!')
                .setDescription(yamlCollect)
                .setColor('#00FF00')
                .setTimestamp()
                .setFooter({
                    text: 'Your departments are generating new resources!',
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                });

            // Add "View Holo+ Cards" button if there are notable pulls
            const components = [];
            if (result.holoCards && result.holoCards.length > 0) {
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`view_holo_${interaction.user.id}_0`)
                            .setLabel(`View Holo+ Cards (${result.holoCards.length})`)
                            .setEmoji('✨')
                            .setStyle(ButtonStyle.Primary)
                    );
                components.push(row);

                // Store holo cards AND results embed in a temporary cache for pagination
                if (!this.holoCardCache) this.holoCardCache = new Map();
                this.holoCardCache.set(interaction.user.id, {
                    cards: result.holoCards,
                    resultsEmbed: embed,
                    timestamp: Date.now()
                });

                // Clean up old cache entries (older than 10 minutes)
                for (const [userId, data] of this.holoCardCache.entries()) {
                    if (Date.now() - data.timestamp > 600000) {
                        this.holoCardCache.delete(userId);
                    }
                }
            }

            await interaction.editReply({ 
                embeds: [embed],
                components: components
            });

        } catch (error) {
            console.error('Error in handleCollect:', error);
            await interaction.editReply({ content: '❌ Error collecting resources!' });
        }
    },

    /**
     * Handle /collector upgrade (global shop level)
     */
    async handleUpgrade(interaction, user, userManager, collectorShopManager) {
        try {
            const shop = await collectorShopManager.getOrCreateShop(interaction.user.id);
            const cost = collectorShopManager.getGlobalUpgradeCost(shop.shop_level);

            if (user.gold < cost) {
                return await interaction.editReply({
                    content: `❌ **Insufficient Gold!**\n\nYou need **${cost.toLocaleString()}g** but only have **${user.gold.toLocaleString()}g**.`
                });
            }

            // Perform upgrade
            const result = await collectorShopManager.upgradeShopLevel(interaction.user.id, user.gold);

            if (!result.success) {
                return await interaction.editReply({
                    content: `❌ Upgrade failed: ${result.error}`
                });
            }

            // Deduct cost
            await userManager.spendGold(interaction.user.id, cost);

            let yamlUpgrade = '```yaml\n';
            yamlUpgrade += '#════════════════════════════════════════\n';
            yamlUpgrade += '# 🎉 SHOP UPGRADED!\n';
            yamlUpgrade += '#════════════════════════════════════════\n\n';

            yamlUpgrade += `🏪 NEW SHOP LEVEL: ${result.newLevel}\n`;
            yamlUpgrade += `💰 COST: ${cost.toLocaleString()}g\n`;
            yamlUpgrade += `💵 REMAINING: ${(user.gold - cost).toLocaleString()}g\n\n`;

            yamlUpgrade += `📈 BENEFITS:\n`;
            yamlUpgrade += `   Department Level Cap: ${result.newLevel}\n`;
            yamlUpgrade += `   Next Shop Upgrade: ${result.nextCost.toLocaleString()}g\n\n`;

            if (result.unlockedDepartments.length > 0) {
                yamlUpgrade += `🆕 UNLOCKED DEPARTMENTS:\n`;
                for (const dept of result.unlockedDepartments) {
                    yamlUpgrade += `   ✨ ${dept}\n`;
                }
                yamlUpgrade += '\n';
            }

            yamlUpgrade += `💡 TIP:\n`;
            yamlUpgrade += `   Use /collector upgrade-dept to improve\n`;
            yamlUpgrade += `   your departments up to level ${result.newLevel}!\n\n`;
            yamlUpgrade += '#════════════════════════════════════════\n';
            yamlUpgrade += '```';

            const embed = new EmbedBuilder()
                .setTitle('🎉 Shop Upgraded!')
                .setDescription(yamlUpgrade)
                .setColor('#FFD700')
                .setTimestamp()
                .setFooter({
                    text: `New Shop Level: ${result.newLevel}`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in handleUpgrade:', error);
            await interaction.editReply({ content: '❌ Error upgrading shop!' });
        }
    },

    /**
     * Handle /collector upgrade-dept
     */
    async handleUpgradeDept(interaction, user, userManager, collectorShopManager) {
        try {
            const departmentId = interaction.options.getString('department');
            const config = collectorShopManager.departments[departmentId];

            if (!config) {
                return await interaction.editReply({ content: '❌ Invalid department!' });
            }

            const shop = await collectorShopManager.getOrCreateShop(interaction.user.id);
            const dept = await collectorShopManager.db.get(
                'SELECT * FROM collector_departments WHERE user_id = ? AND department_id = ?',
                [interaction.user.id, departmentId]
            );

            // Check if department is unlocked
            if (!dept || dept.level === 0) {
                return await interaction.editReply({
                    content: `❌ **${config.name} Not Unlocked!**\n\nUnlock at **Shop Level ${config.unlockLevel}**.`
                });
            }

            // Check if at level cap
            if (dept.level >= shop.shop_level) {
                return await interaction.editReply({
                    content: `❌ **Level Cap Reached!**\n\n${config.name} is at max level (${dept.level}/${shop.shop_level}).\nUpgrade your Shop Level first with \`/collector upgrade\`.`
                });
            }

            const cost = collectorShopManager.getDepartmentUpgradeCost(departmentId, dept.level);

            if (user.gold < cost) {
                return await interaction.editReply({
                    content: `❌ **Insufficient Gold!**\n\nYou need **${cost.toLocaleString()}g** but only have **${user.gold.toLocaleString()}g**.`
                });
            }

            // Perform upgrade
            const result = await collectorShopManager.upgradeDepartment(interaction.user.id, departmentId, user.gold);

            if (!result.success) {
                return await interaction.editReply({
                    content: `❌ Upgrade failed: ${result.error}`
                });
            }

            // Deduct cost
            await userManager.spendGold(interaction.user.id, cost);

            // Calculate new stats
            const newStats = collectorShopManager.calculateGeneration(departmentId, result.newLevel, 1);

            let yamlUpgrade = '```yaml\n';
            yamlUpgrade += '#════════════════════════════════════════\n';
            yamlUpgrade += '# ⬆️ DEPARTMENT UPGRADED!\n';
            yamlUpgrade += '#════════════════════════════════════════\n\n';

            yamlUpgrade += `${config.emoji} ${config.name}\n`;
            yamlUpgrade += `   Old Level: ${result.newLevel - 1}\n`;
            yamlUpgrade += `   New Level: ${result.newLevel}\n`;
            yamlUpgrade += `   Cost: ${cost.toLocaleString()}g\n\n`;

            yamlUpgrade += `📈 NEW STATS:\n`;
            if (config.resource === 'coins' || config.resource === 'cards') {
                yamlUpgrade += `   Generation: ${newStats.rate}/hr\n`;
                yamlUpgrade += `   Capacity: ${newStats.capacity}\n`;
                yamlUpgrade += `   Fill Time: ${newStats.fillTime}h\n`;
            } else if (config.resource === 'packs') {
                yamlUpgrade += `   Find Chance: ${newStats.chance}/hr\n`;
                yamlUpgrade += `   Capacity: ${newStats.capacity} packs\n`;
            } else if (config.resource === 'upgrade_chance') {
                const chance = config.baseChance + (config.chanceGrowth * (result.newLevel - 1));
                yamlUpgrade += `   Upgrade Chance: ${(chance * 100).toFixed(1)}%\n`;
                if (result.newLevel >= config.specialUnlock) {
                    yamlUpgrade += `   🌟 Holo Chance Unlocked: 0.5%\n`;
                }
            } else if (config.resource === 'quality_boost') {
                const boost = config.baseChance + (config.chanceGrowth * (result.newLevel - 1));
                yamlUpgrade += `   Quality Boost: ${(boost * 100).toFixed(1)}%\n`;
            }

            yamlUpgrade += '\n';
            yamlUpgrade += `💰 REMAINING GOLD: ${(user.gold - cost).toLocaleString()}g\n`;
            yamlUpgrade += `🔄 NEXT UPGRADE: ${result.nextCost.toLocaleString()}g\n`;
            yamlUpgrade += `📊 LEVEL CAP: ${shop.shop_level}\n\n`;
            yamlUpgrade += '#════════════════════════════════════════\n';
            yamlUpgrade += '```';

            const embed = new EmbedBuilder()
                .setTitle(`⬆️ ${config.name} Upgraded!`)
                .setDescription(yamlUpgrade)
                .setColor('#00FF00')
                .setTimestamp()
                .setFooter({
                    text: `Level ${result.newLevel}/${shop.shop_level}`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in handleUpgradeDept:', error);
            await interaction.editReply({ content: '❌ Error upgrading department!' });
        }
    },

    /**
     * Build department detail embed
     */
    async buildDepartmentEmbed(interaction, deptId, shop, departments, collectorShopManager) {
        const { EmbedBuilder } = require('discord.js');
        const config = collectorShopManager.departments[deptId];
        const dept = departments.find(d => d.department_id === deptId);

        if (!dept || dept.level === 0) {
            // Locked department
            let yamlStatus = '```yaml\n';
            yamlStatus += '#════════════════════════════════════════\n';
            yamlStatus += `# ${config.emoji} ${config.name.toUpperCase()}\n`;
            yamlStatus += '#════════════════════════════════════════\n\n';

            yamlStatus += `🔒 STATUS: LOCKED\n\n`;

            yamlStatus += `📝 DESCRIPTION:\n`;
            yamlStatus += `   ${config.description}\n\n`;

            yamlStatus += `🔑 UNLOCK REQUIREMENTS:\n`;
            yamlStatus += `   Shop Level: ${config.unlockLevel}\n`;
            yamlStatus += `   Unlock Cost: ${config.upgradeCost.toLocaleString()}g\n\n`;

            yamlStatus += `💡 Use /collector upgrade-dept to unlock!\n`;
            yamlStatus += '#════════════════════════════════════════\n';
            yamlStatus += '```';

            return new EmbedBuilder()
                .setTitle(`${config.emoji} ${config.name}`)
                .setDescription(yamlStatus)
                .setColor('#808080')
                .setTimestamp();
        }

        // Active department - show full details
        const status = await collectorShopManager.getDepartmentStatus(
            interaction.user.id,
            deptId,
            dept.level
        );

        let yamlStatus = '```yaml\n';
        yamlStatus += '#════════════════════════════════════════\n';
        yamlStatus += `# ${config.emoji} ${config.name.toUpperCase()} - LEVEL ${dept.level}\n`;
        yamlStatus += '#════════════════════════════════════════\n\n';

        yamlStatus += `📝 DESCRIPTION:\n`;
        yamlStatus += `   ${config.description}\n\n`;

        // Show shop status and variance ONLY for generating departments
        // Skip for bonus departments (upgrade_chance, quality_boost)
        const isBonusDepartment = config.resource === 'upgrade_chance' || config.resource === 'quality_boost';
        
        if (!isBonusDepartment) {
            if (status.shopStatus) {
                yamlStatus += `${status.shopStatus}\n`;
            }
            if (status.varianceDesc) {
                yamlStatus += `${status.varianceDesc}\n`;
            }
            if (status.operatingHours) {
                yamlStatus += `⏰ OPERATING HOURS: ${status.operatingHours}h/day\n\n`;
            }
        }

        // Resource-specific information
        if (config.resource === 'coins') {
            yamlStatus += `💰 GENERATION:\n`;
            yamlStatus += `   Rate: ${status.rate} coins/hour\n`;
            yamlStatus += `   Storage: ${status.generated}/${status.capacity} coins\n`;
            const timeToFill = ((status.capacity - status.generated) / status.rate).toFixed(1);
            yamlStatus += `   Time to Fill: ${timeToFill} hours\n\n`;
        } else if (config.resource === 'cards') {
            const hoursPerCard = status.rate >= 1 ? `${status.rate.toFixed(2)}/hr` : `1 every ${(1/status.rate).toFixed(1)}hr`;
            yamlStatus += `🃏 GENERATION:\n`;
            yamlStatus += `   Rate: ${hoursPerCard}\n`;
            yamlStatus += `   Storage: ${status.generated}/${status.capacity} cards\n`;
            const timeToFill = ((status.capacity - status.generated) / status.rate).toFixed(1);
            yamlStatus += `   Time to Fill: ${timeToFill} hours\n\n`;
        } else if (config.resource === 'packs') {
            yamlStatus += `🎁 PACK GENERATION:\n`;
            yamlStatus += `   Find Chance: ${status.chance} per hour\n`;
            yamlStatus += `   Storage: ${status.generated}/${status.capacity} packs\n\n`;
        } else if (config.resource === 'upgrade_chance') {
            const chance = config.baseChance + (config.chanceGrowth * (dept.level - 1));
            yamlStatus += `⬆️ UPGRADE SYSTEM:\n`;
            yamlStatus += `   Upgrade Chance: ${(chance * 100).toFixed(1)}%\n`;
            yamlStatus += `   Effect: Common → Uncommon\n`;
            if (dept.level >= config.specialUnlock) {
                yamlStatus += `   ✨ Bonus: 0.5% Holo chance!\n\n`;
            } else {
                yamlStatus += `   🔒 Unlock at Level ${config.specialUnlock}\n\n`;
            }
        } else if (config.resource === 'quality_boost') {
            const boost = config.baseChance + (config.chanceGrowth * (dept.level - 1));
            yamlStatus += `⭐ QUALITY BOOST:\n`;
            yamlStatus += `   Boost Chance: ${(boost * 100).toFixed(1)}%\n`;
            yamlStatus += `   Effect: Overall better cards\n\n`;
        }

        // Upgrade information
        const upgradeCost = Math.round(config.upgradeCost * Math.pow(config.costGrowth, dept.level - 1));
        yamlStatus += `📈 UPGRADE INFO:\n`;
        yamlStatus += `   Current Level: ${dept.level}\n`;
        yamlStatus += `   Upgrade Cost: ${upgradeCost.toLocaleString()}g\n`;
        yamlStatus += `   Max Level: ${shop.shop_level}\n\n`;

        yamlStatus += '💡 Use /collector upgrade-dept to improve!\n';
        yamlStatus += '#════════════════════════════════════════\n';
        yamlStatus += '```';

        return new EmbedBuilder()
            .setTitle(`${config.emoji} ${config.name}`)
            .setDescription(yamlStatus)
            .setColor('#FFD700')
            .setTimestamp()
            .setFooter({ text: `Level ${dept.level} • Click ◀ Back to return to overview` });
    },

    /**
     * Auto-unlock departments that should be available based on shop level
     * (Retroactive fix for users who upgraded before migration)
     */
    async autoUnlockDepartments(userId, collectorShopManager, database) {
        try {
            const shop = await collectorShopManager.getOrCreateShop(userId);
            const departments = await collectorShopManager.getUserDepartments(userId);
            const existingDeptIds = new Set(departments.filter(d => d.level > 0).map(d => d.department_id));

            // Check database type for correct syntax
            const dbType = database.constructor.name === 'PostgreSQLDatabase' ? 'postgresql' : 'sqlite';
            
            for (const [deptId, config] of Object.entries(collectorShopManager.departments)) {
                // If department should be unlocked but isn't yet
                if (config.unlockLevel <= shop.shop_level && !existingDeptIds.has(deptId)) {
                    console.log(`🔓 Auto-unlocking ${config.name} for user ${userId} (Shop Level ${shop.shop_level})`);
                    
                    if (dbType === 'postgresql') {
                        // PostgreSQL syntax
                        await collectorShopManager.db.run(`
                            INSERT INTO collector_departments (user_id, department_id, level, last_collected_at)
                            VALUES ($1, $2, 1, $3)
                            ON CONFLICT (user_id, department_id) DO NOTHING
                        `, [userId, deptId, Date.now()]);

                        await collectorShopManager.db.run(`
                            INSERT INTO collector_storage (user_id, department_id, last_generation_at)
                            VALUES ($1, $2, $3)
                            ON CONFLICT (user_id, department_id) DO NOTHING
                        `, [userId, deptId, Date.now()]);
                    } else {
                        // SQLite syntax
                        await collectorShopManager.db.run(`
                            INSERT OR IGNORE INTO collector_departments (user_id, department_id, level, last_collected_at)
                            VALUES (?, ?, 1, ?)
                        `, [userId, deptId, Date.now()]);

                        await collectorShopManager.db.run(`
                            INSERT OR IGNORE INTO collector_storage (user_id, department_id, last_generation_at)
                            VALUES (?, ?, ?)
                        `, [userId, deptId, Date.now()]);
                    }
                }
            }
        } catch (error) {
            console.error('Error auto-unlocking departments:', error);
        }
    }
};
