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

    async execute(interaction, { database, userManager, collectorShopManager }) {
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

            switch (subcommand) {
                case 'status':
                    await this.handleStatus(interaction, user, collectorShopManager);
                    break;
                case 'collect':
                    await this.handleCollect(interaction, user, userManager, database, collectorShopManager);
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
            
            // AUTO-UNLOCK: Check if any departments should be unlocked based on current shop level
            await this.autoUnlockDepartments(interaction.user.id, shop.shop_level, collectorShopManager);
            
            const departments = await collectorShopManager.getUserDepartments(interaction.user.id);

            const nextUpgradeCost = collectorShopManager.getGlobalUpgradeCost(shop.shop_level);

            let yamlStatus = '```yaml\n';
            yamlStatus += '#════════════════════════════════════════\n';
            yamlStatus += "# 🏪 COLLECTOR'S SHOP STATUS\n";
            yamlStatus += '#════════════════════════════════════════\n\n';

            yamlStatus += `👤 TRAINER: ${interaction.user.username}\n`;
            yamlStatus += `💰 GOLD: ${user.gold.toLocaleString()}g\n\n`;

            yamlStatus += `🏪 SHOP LEVEL: ${shop.shop_level}\n`;
            yamlStatus += `   Next Upgrade: ${nextUpgradeCost.toLocaleString()}g\n`;
            yamlStatus += `   Department Cap: Level ${shop.shop_level}\n\n`;

            yamlStatus += `📊 LIFETIME STATS:\n`;
            yamlStatus += `   Coins Generated: ${shop.lifetime_coins_generated.toLocaleString()}g\n`;
            yamlStatus += `   Cards Generated: ${shop.lifetime_cards_generated}\n\n`;

            yamlStatus += `🏬 DEPARTMENTS:\n\n`;

            // Show each unlocked department
            for (const dept of departments) {
                if (dept.level > 0) {
                    const config = collectorShopManager.departments[dept.department_id];
                    const status = await collectorShopManager.getDepartmentStatus(
                        interaction.user.id,
                        dept.department_id,
                        dept.level
                    );

                    yamlStatus += `${config.emoji} ${config.name} (Lvl ${dept.level}):\n`;

                    if (config.resource === 'coins') {
                        yamlStatus += `   Generates: ${status.rate}/hr\n`;
                        yamlStatus += `   Storage: ${status.generated}/${status.capacity} coins\n`;
                        const timeToFill = ((status.capacity - status.generated) / status.rate).toFixed(1);
                        yamlStatus += `   Full in: ${timeToFill}h\n`;
                    } else if (config.resource === 'cards') {
                        yamlStatus += `   Generates: ${status.rate}/hr\n`;
                        yamlStatus += `   Storage: ${status.generated}/${status.capacity} cards\n`;
                        const timeToFill = ((status.capacity - status.generated) / status.rate).toFixed(1);
                        yamlStatus += `   Full in: ${timeToFill}h\n`;
                    } else if (config.resource === 'packs') {
                        yamlStatus += `   Find Chance: ${status.chance}/hr\n`;
                        yamlStatus += `   Storage: ${status.generated}/${status.capacity} packs\n`;
                    } else if (config.resource === 'upgrade_chance') {
                        const chance = config.baseChance + (config.chanceGrowth * (dept.level - 1));
                        yamlStatus += `   Upgrade Chance: ${(chance * 100).toFixed(1)}%\n`;
                        if (dept.level >= config.specialUnlock) {
                            yamlStatus += `   Holo Chance: 0.5%\n`;
                        }
                    } else if (config.resource === 'quality_boost') {
                        const boost = config.baseChance + (config.chanceGrowth * (dept.level - 1));
                        yamlStatus += `   Quality Boost: ${(boost * 100).toFixed(1)}%\n`;
                    }

                    yamlStatus += '\n';
                }
            }

            // Show locked departments
            const lockedDepts = Object.entries(collectorShopManager.departments)
                .filter(([id, config]) => {
                    const dept = departments.find(d => d.department_id === id);
                    return !dept || dept.level === 0;
                })
                .filter(([id, config]) => config.unlockLevel > shop.shop_level);

            if (lockedDepts.length > 0) {
                yamlStatus += `🔒 LOCKED DEPARTMENTS:\n\n`;
                for (const [id, config] of lockedDepts) {
                    yamlStatus += `${config.emoji} ${config.name}:\n`;
                    yamlStatus += `   Unlock at: Shop Level ${config.unlockLevel}\n`;
                    yamlStatus += `   ${config.description}\n\n`;
                }
            }

            yamlStatus += '💡 COMMANDS:\n';
            yamlStatus += '   /collector collect - Collect resources\n';
            yamlStatus += '   /collector upgrade - Upgrade shop level\n';
            yamlStatus += '   /collector upgrade-dept - Upgrade department\n\n';
            yamlStatus += '#════════════════════════════════════════\n';
            yamlStatus += '```';

            const embed = new EmbedBuilder()
                .setTitle(`🏪 ${interaction.user.username}'s Collector Shop`)
                .setDescription(yamlStatus)
                .setColor('#FFD700')
                .setTimestamp()
                .setFooter({
                    text: `Shop Level ${shop.shop_level} • Passive Generation Active`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                });

            // Add action buttons
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`collector_collect_${interaction.user.id}`)
                        .setLabel('💰 Collect All')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`collector_upgrade_${interaction.user.id}`)
                        .setLabel(`⬆️ Shop (${nextUpgradeCost.toLocaleString()}g)`)
                        .setStyle(user.gold >= nextUpgradeCost ? ButtonStyle.Primary : ButtonStyle.Secondary)
                        .setDisabled(user.gold < nextUpgradeCost)
                );

            await interaction.editReply({ embeds: [embed], components: [row] });

        } catch (error) {
            console.error('Error in handleStatus:', error);
            await interaction.editReply({ content: '❌ Error loading shop status!' });
        }
    },

    /**
     * Handle /collector collect
     */
    async handleCollect(interaction, user, userManager, database, collectorShopManager) {
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

            if (result.results.cards > 0) {
                // Generate cards and add to user's collection
                const cardManager = interaction.client.cardManager;
                for (let i = 0; i < result.results.cards; i++) {
                    const randomCard = await cardManager.getRandomCard(1); // Level 1 = Common
                    if (randomCard) {
                        await database.addCard(interaction.user.id, randomCard.card_id);
                    }
                }
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
                yamlCollect += `   🃏 Cards: +${result.results.cards} Common\n`;
            }
            if (result.results.packs > 0) {
                yamlCollect += `   🎁 Packs: +${result.results.packs} Sealed\n`;
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
                }
            }

            yamlCollect += '\n💡 Generation has restarted!\n';
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

            await interaction.editReply({ embeds: [embed] });

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
     * Auto-unlock departments that should be available based on shop level
     * (Retroactive fix for users who upgraded before migration)
     */
    async autoUnlockDepartments(userId, shopLevel, collectorShopManager) {
        try {
            const departments = await collectorShopManager.getUserDepartments(userId);
            const existingDeptIds = new Set(departments.filter(d => d.level > 0).map(d => d.department_id));

            for (const [deptId, config] of Object.entries(collectorShopManager.departments)) {
                // If department should be unlocked but isn't yet
                if (config.unlockLevel <= shopLevel && !existingDeptIds.has(deptId)) {
                    console.log(`🔓 Auto-unlocking ${config.name} for user ${userId} (Shop Level ${shopLevel})`);
                    
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
        } catch (error) {
            console.error('Error auto-unlocking departments:', error);
        }
    }
};
