const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

class InteractionRouter {
    static async handle(interaction, bot) {
        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('binder_set_')) {
            await this.handleBinderSet(interaction, bot);
            return true;
        }

        if (interaction.isButton() && (
            interaction.customId.startsWith('binder_page_') ||
            interaction.customId.startsWith('binder_filter_')
        )) {
            await this.handleBinderNavigation(interaction, bot);
            return true;
        }

        if (interaction.isButton() && (
            interaction.customId.startsWith('carddex_page_') ||
            interaction.customId.startsWith('carddex_filter_')
        )) {
            await this.handleCardDexNavigation(interaction, bot);
            return true;
        }

        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('carddex_set_')) {
            await this.handleCardDexSet(interaction, bot);
            return true;
        }

        if (interaction.isButton() && interaction.customId.startsWith('quest_')) {
            await this.handleQuest(interaction, bot);
            return true;
        }

        if (interaction.isButton() && interaction.customId.startsWith('help_')) {
            await this.handleHelp(interaction, bot);
            return true;
        }

        if (interaction.isButton() && interaction.customId.startsWith('faq_')) {
            await this.handleFaq(interaction, bot);
            return true;
        }

        if (interaction.isButton() && interaction.customId.startsWith('active_boosts_')) {
            await this.handleActiveBoosts(interaction, bot);
            return true;
        }

        if (interaction.isButton() && interaction.customId.startsWith('use_item_')) {
            await this.handleUseItem(interaction, bot);
            return true;
        }

        if (interaction.isButton() && interaction.customId.startsWith('refresh_inventory_')) {
            await this.handleInventoryRefresh(interaction, bot);
            return true;
        }

        if (interaction.isButton() && (
            interaction.customId.startsWith('collector_collect_') ||
            interaction.customId.startsWith('collector_upgrade_')
        )) {
            await this.handleCollectorAction(interaction, bot);
            return true;
        }

        if (interaction.isButton() && interaction.customId.startsWith('shop_buy_')) {
            await this.handleShopPurchase(interaction, bot);
            return true;
        }

        if (interaction.isButton() && (
            interaction.customId.startsWith('shop_prev_') ||
            interaction.customId.startsWith('shop_next_')
        )) {
            await this.handleShopNavigation(interaction, bot);
            return true;
        }

        if (interaction.isButton() && interaction.customId.startsWith('view_holo_')) {
            await this.handleHoloViewer(interaction, bot);
            return true;
        }

        if (interaction.isButton() && interaction.customId.startsWith('collector_dept_')) {
            await this.handleCollectorDepartment(interaction, bot);
            return true;
        }

        if (interaction.isButton() && interaction.customId.startsWith('collector_overview_')) {
            await this.handleCollectorOverview(interaction, bot);
            return true;
        }

        if (interaction.isButton() && interaction.customId.startsWith('start_')) {
            await this.handleStart(interaction, bot);
            return true;
        }

        if (interaction.isButton() && interaction.customId.startsWith('vex_')) {
            await this.handleRiskyDeal(interaction, bot);
            return true;
        }

        return false;
    }

    static async handleBinderSet(interaction, bot) {
        const targetUserId = interaction.customId.split('_')[2];

        if (interaction.user.id !== targetUserId) {
            return await interaction.reply({
                content: 'You can only interact with your own binder!',
                flags: 64
            });
        }

        try {
            await interaction.deferUpdate();
            const binderCommand = bot.commands.get('binder');

            if (binderCommand) {
                const selectedSet = interaction.values[0];
                const user = await bot.userManager.getUser(targetUserId);
                const targetUser = await bot.client.users.fetch(targetUserId);
                const userCollection = await bot.userManager.getUserCollection(targetUserId, selectedSet);

                await binderCommand.createBinderEmbed(
                    interaction,
                    targetUser,
                    user,
                    selectedSet,
                    userCollection,
                    bot.database,
                    bot.userManager
                );
            }
        } catch (error) {
            console.error('Error handling binder dropdown:', error);
            await this.replyAfterFailure(interaction, 'Error loading the selected set. Please try again!');
        }
    }

    static async handleBinderNavigation(interaction, bot) {
        try {
            await interaction.deferUpdate();

            const parts = interaction.customId.split('_');
            const action = parts[1];
            const targetUserId = parts[2];
            const value = parts[3];

            if (interaction.user.id !== targetUserId) {
                return await interaction.editReply({
                    content: 'You can only interact with your own binder!',
                    components: []
                });
            }

            const binderCommand = bot.commands.get('binder');
            if (!binderCommand) return;

            const targetUser = await bot.client.users.fetch(targetUserId);
            const currentPage = action === 'page' ? parseInt(value) : 1;
            const typeFilter = action === 'filter' ? value : 'owned';
            const { cards, totalCards, totalPages } = await binderCommand.getFilteredCards(
                bot.database,
                targetUserId,
                null,
                null,
                null,
                typeFilter,
                currentPage
            );

            await binderCommand.displayBinder(interaction, targetUser, cards, {
                setFilter: null,
                pokemonFilter: null,
                rarityFilter: null,
                typeFilter,
                currentPage,
                totalCards,
                totalPages
            });
        } catch (error) {
            console.error('Error handling binder button interaction:', error);
            await this.replyAfterFailure(interaction, 'An error occurred while updating the binder. Please try again!');
        }
    }

    static async handleCardDexNavigation(interaction, bot) {
        try {
            await interaction.deferUpdate();

            const parts = interaction.customId.split('_');
            const action = parts[1];
            const targetUserId = parts[2];
            const value = parts[3];

            if (interaction.user.id !== targetUserId) {
                return await interaction.editReply({
                    content: 'You can only interact with your own Card Dex!',
                    components: []
                });
            }

            const cardDexCommand = bot.commands.get('carddex-reg');
            if (!cardDexCommand) return;

            const targetUser = await bot.client.users.fetch(targetUserId);
            const currentPage = action === 'page' ? parseInt(value) : 1;
            const ownershipFilter = action === 'filter' ? value : 'all';
            const dexData = await cardDexCommand.getDexData(bot.database, targetUserId, {
                setFilter: null,
                ownershipFilter,
                searchQuery: null,
                currentPage
            });

            await cardDexCommand.displayCardDex(interaction, targetUser, dexData);
        } catch (error) {
            console.error('Error handling card dex button interaction:', error);
            await this.replyAfterFailure(interaction, 'An error occurred while updating the Card Dex. Please try again!');
        }
    }

    static async handleCardDexSet(interaction, bot) {
        try {
            await interaction.deferUpdate();

            const targetUserId = interaction.customId.replace('carddex_set_', '');
            const selectedSet = interaction.values[0];

            if (interaction.user.id !== targetUserId) {
                return await interaction.editReply({
                    content: 'You can only interact with your own Card Dex!',
                    components: []
                });
            }

            const cardDexCommand = bot.commands.get('carddex-reg');
            if (!cardDexCommand) return;

            const targetUser = await bot.client.users.fetch(targetUserId);
            const dexData = await cardDexCommand.getDexData(bot.database, targetUserId, {
                setFilter: selectedSet === 'all' ? null : selectedSet,
                ownershipFilter: 'all',
                searchQuery: null,
                currentPage: 1
            });

            await cardDexCommand.displayCardDex(interaction, targetUser, dexData);
        } catch (error) {
            console.error('Error handling card dex set selection:', error);
            await this.replyAfterFailure(interaction, 'An error occurred while changing sets. Please try again!');
        }
    }

    static async handleQuest(interaction, bot) {
        try {
            await interaction.deferUpdate();
            const questCommand = bot.commands.get('quest');
            if (questCommand) {
                await questCommand.showQuestPage(
                    interaction,
                    bot.questManager,
                    interaction.user.id,
                    interaction.customId.replace('quest_', '')
                );
            }
        } catch (error) {
            console.error('Error handling quest button interaction:', error);
            await this.replyAfterFailure(interaction, 'An error occurred while switching quest pages. Please try again!');
        }
    }

    static async handleHelp(interaction, bot) {
        try {
            await interaction.deferUpdate();
            const helpCommand = bot.commands.get('help');
            if (helpCommand) {
                await helpCommand.showHelpCategory(
                    interaction,
                    interaction.customId.replace('help_', '')
                );
            }
        } catch (error) {
            console.error('Error handling help button:', error);
            await this.replyAfterFailure(interaction, 'An error occurred while navigating the help hub. Please try again!');
        }
    }

    static async handleFaq(interaction, bot) {
        try {
            await interaction.deferUpdate();
            const faqCommand = bot.commands.get('faq');
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
            await this.replyAfterFailure(interaction, 'An error occurred while navigating FAQ. Please try again!');
        }
    }

    static async handleActiveBoosts(interaction, bot) {
        try {
            await interaction.deferUpdate();
            const parts = interaction.customId.split('_');
            const targetUserId = parts[3];

            if (interaction.user.id !== targetUserId) {
                return await interaction.editReply({
                    content: 'You can only interact with your own active effects!',
                    components: []
                });
            }

            const activeBoostsCommand = bot.commands.get('active-boosts');
            if (activeBoostsCommand && parts[2] === 'page') {
                await activeBoostsCommand.displayActiveEffectsPage(
                    interaction,
                    bot.database,
                    targetUserId,
                    parseInt(parts[4])
                );
            }
        } catch (error) {
            console.error('Error handling active boosts button:', error);
            await this.replyAfterFailure(interaction, 'An error occurred while updating active effects. Please try again!');
        }
    }

    static async handleUseItem(interaction, bot) {
        try {
            await interaction.deferReply({ ephemeral: true });
            const parts = interaction.customId.split('_');
            const itemId = parts[2];
            const targetUserId = parts[3];

            if (interaction.user.id !== targetUserId) {
                return await interaction.editReply({ content: '❌ You can only use your own items!' });
            }

            const useCommand = bot.commands.get('use');
            if (!useCommand) {
                return await interaction.editReply({ content: '❌ Use command not found!' });
            }

            const fakeInteraction = {
                ...interaction,
                options: { getString: name => name === 'item' ? itemId : null },
                deferReply: async () => {},
                editReply: async options => interaction.editReply(options)
            };

            await useCommand.execute(fakeInteraction, {
                database: bot.database,
                userManager: bot.userManager,
                cardManager: bot.cardManager,
                questManager: bot.questManager
            });
        } catch (error) {
            console.error('Error handling use item button:', error);
            await this.replyAfterFailure(interaction, 'An error occurred while using the item. Please try again!');
        }
    }

    static async handleInventoryRefresh(interaction, bot) {
        try {
            const targetUserId = interaction.customId.split('_')[2];
            if (interaction.user.id !== targetUserId) {
                return await interaction.reply({
                    content: '❌ You can only refresh your own inventory!',
                    ephemeral: true
                });
            }

            const inventoryCommand = bot.commands.get('inventory');
            if (!inventoryCommand) {
                return await interaction.reply({
                    content: '❌ Inventory command not found!',
                    ephemeral: true
                });
            }

            const fakeInteraction = {
                ...interaction,
                options: { getUser: () => null },
                deferReply: async () => {},
                editReply: async options => interaction.update(options)
            };

            await inventoryCommand.execute(fakeInteraction, {
                database: bot.database,
                userManager: bot.userManager
            });
        } catch (error) {
            console.error('Error handling refresh inventory button:', error);
            await this.replyAfterFailure(interaction, '❌ An error occurred while refreshing inventory!');
        }
    }

    static async handleCollectorAction(interaction, bot) {
        try {
            const customId = interaction.customId;
            const parts = customId.split('_');
            let action = parts[1];
            let targetUserId = parts[2];
            let departmentId = null;

            if (customId.startsWith('collector_upgrade_shop_')) {
                action = 'upgrade-shop';
                targetUserId = parts[3];
            } else if (customId.startsWith('collector_upgrade_dept_')) {
                action = 'upgrade-dept';
                const lastUnderscoreIndex = customId.lastIndexOf('_');
                targetUserId = customId.substring(lastUnderscoreIndex + 1);
                departmentId = customId.substring('collector_upgrade_dept_'.length, lastUnderscoreIndex);
            }

            if (interaction.user.id !== targetUserId) {
                return await interaction.reply({
                    content: 'You can only interact with your own collector shop!',
                    ephemeral: true
                });
            }

            await interaction.deferUpdate();
            const collectorCommand = bot.commands.get('collector');
            const user = await bot.userManager.getUser(interaction.user.id);

            if (action === 'collect') {
                await collectorCommand.handleCollect(
                    interaction,
                    user,
                    bot.userManager,
                    bot.database,
                    bot.collectorShopManager,
                    bot.cardManager
                );
            } else if (action === 'upgrade' || action === 'upgrade-shop') {
                await collectorCommand.handleUpgrade(
                    interaction,
                    user,
                    bot.userManager,
                    bot.collectorShopManager
                );
            } else if (action === 'upgrade-dept') {
                const upgradeInteraction = {
                    ...interaction,
                    options: { getString: name => name === 'department' ? departmentId : null }
                };
                await collectorCommand.handleUpgradeDept(
                    upgradeInteraction,
                    user,
                    bot.userManager,
                    bot.collectorShopManager
                );
            }
        } catch (error) {
            console.error('Error handling collector shop button:', error);
            await this.replyAfterFailure(interaction, '❌ An error occurred. Please try again!');
        }
    }

    static async handleShopPurchase(interaction, bot) {
        try {
            await interaction.deferUpdate();
            const lastUnderscoreIndex = interaction.customId.lastIndexOf('_');
            const targetUserId = interaction.customId.substring(lastUnderscoreIndex + 1);
            const itemId = interaction.customId.substring(9, lastUnderscoreIndex);

            if (interaction.user.id !== targetUserId) {
                return await interaction.editReply({
                    content: 'You can only make purchases for yourself!',
                    components: []
                });
            }

            const shopCommand = bot.commands.get('shop');
            if (shopCommand) {
                await shopCommand.handlePurchase(interaction, bot.database, bot.userManager, itemId);
            }
        } catch (error) {
            console.error('Error handling shop purchase button:', error);
            await this.replyAfterFailure(interaction, 'An error occurred while processing your purchase. Please try again!');
        }
    }

    static async handleShopNavigation(interaction, bot) {
        try {
            const parts = interaction.customId.split('_');
            const targetUserId = parts[3];

            if (interaction.user.id !== targetUserId) {
                return await interaction.reply({
                    content: 'You can only navigate your own shop!',
                    ephemeral: true
                });
            }

            const shopCommand = bot.commands.get('shop');
            if (shopCommand) {
                await shopCommand.handlePageNavigation(
                    interaction,
                    bot.database,
                    bot.userManager,
                    parts[1],
                    parseInt(parts[2])
                );
            }
        } catch (error) {
            console.error('Error handling shop navigation:', error);
            await this.replyAfterFailure(interaction, '❌ An error occurred while navigating the shop. Please try again!');
        }
    }

    static async handleHoloViewer(interaction, bot) {
        try {
            const parts = interaction.customId.split('_');
            const action = parts[2];
            const isControlAction = action === 'close' || action === 'back';
            const targetUserId = isControlAction ? parts[3] : parts[2];

            if (interaction.user.id !== targetUserId) {
                return await interaction.reply({ content: 'You can only view your own cards!', ephemeral: true });
            }

            await interaction.deferUpdate();
            const collectorCommand = bot.commands.get('collector');
            const cacheData = collectorCommand?.holoCardCache?.get(targetUserId);

            if (action === 'close') {
                return await interaction.editReply({ content: '✅ Viewer closed.', embeds: [], components: [] });
            }

            if (action === 'back') {
                if (!cacheData?.resultsEmbed) {
                    return await interaction.editReply({ content: '❌ Results data expired. Please collect again!', embeds: [], components: [] });
                }

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`view_holo_${targetUserId}_0`)
                        .setLabel(`View Holo+ Cards (${cacheData.cards.length})`)
                        .setEmoji('✨')
                        .setStyle(ButtonStyle.Primary)
                );
                return await interaction.editReply({ embeds: [cacheData.resultsEmbed], components: [row] });
            }

            if (!cacheData) {
                return await interaction.editReply({ content: '❌ Card data expired. Please collect again!', embeds: [], components: [] });
            }

            const page = parseInt(parts[3]);
            const currentPage = Math.min(Math.max(0, page), cacheData.cards.length - 1);
            const card = cacheData.cards[currentPage];
            const embed = new EmbedBuilder()
                .setTitle(`✨ ${card.name}`)
                .setDescription(`**Rarity:** ${card.rarity}\n**Set:** ${card.set_name}\n**Card ID:** ${card.id}`)
                .setColor('#FFD700')
                .setFooter({ text: `Card ${currentPage + 1} of ${cacheData.cards.length}` })
                .setTimestamp();

            if (card.image_large || card.image_small) embed.setImage(card.image_large || card.image_small);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`view_holo_back_${targetUserId}`).setLabel('◀ Back to Results').setStyle(ButtonStyle.Success)
            );
            if (currentPage > 0) {
                row.addComponents(new ButtonBuilder().setCustomId(`view_holo_${targetUserId}_${currentPage - 1}`).setLabel('Previous').setStyle(ButtonStyle.Secondary));
            }
            if (currentPage < cacheData.cards.length - 1) {
                row.addComponents(new ButtonBuilder().setCustomId(`view_holo_${targetUserId}_${currentPage + 1}`).setLabel('Next').setStyle(ButtonStyle.Secondary));
            }
            row.addComponents(new ButtonBuilder().setCustomId(`view_holo_close_${targetUserId}`).setLabel('Close').setStyle(ButtonStyle.Danger));

            await interaction.editReply({ embeds: [embed], components: [row] });
        } catch (error) {
            console.error('Error handling holo card viewer:', error);
            await this.replyAfterFailure(interaction, 'An error occurred while viewing cards. Please try again!');
        }
    }

    static async handleCollectorDepartment(interaction, bot) {
        try {
            const lastUnderscoreIndex = interaction.customId.lastIndexOf('_');
            const targetUserId = interaction.customId.substring(lastUnderscoreIndex + 1);
            const deptId = interaction.customId.substring('collector_dept_'.length, lastUnderscoreIndex);

            if (interaction.user.id !== targetUserId) {
                return await interaction.reply({ content: 'You can only view your own departments!', ephemeral: true });
            }

            await interaction.deferUpdate();
            const command = bot.commands.get('collector');
            const cacheData = command?.collectorStatusCache?.get(targetUserId);
            if (!cacheData) {
                return await interaction.editReply({ content: '❌ Status data expired. Use /collector to refresh!', embeds: [], components: [] });
            }

            const embed = await command.buildDepartmentEmbed(interaction, deptId, cacheData.shop, cacheData.departments, bot.collectorShopManager);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`collector_overview_${targetUserId}`).setLabel('◀ Back to Overview').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`collector_upgrade_dept_${deptId}_${targetUserId}`).setLabel('Upgrade Department').setEmoji('⬆️').setStyle(ButtonStyle.Primary)
            );
            await interaction.editReply({ embeds: [embed], components: [row] });
        } catch (error) {
            console.error('Error handling collector department button:', error);
            await this.replyAfterFailure(interaction, 'An error occurred while loading the department. Please try again!');
        }
    }

    static async handleCollectorOverview(interaction, bot) {
        try {
            const targetUserId = interaction.customId.split('_')[2];
            if (interaction.user.id !== targetUserId) {
                return await interaction.reply({ content: 'You can only view your own shop!', ephemeral: true });
            }

            await interaction.deferUpdate();
            const command = bot.commands.get('collector');
            const cacheData = command?.collectorStatusCache?.get(targetUserId);
            if (!cacheData) {
                return await interaction.editReply({ content: '❌ Status data expired. Use /collector to refresh!', embeds: [], components: [] });
            }

            const user = await bot.userManager.getUser(targetUserId);
            const embed = await command.buildOverviewEmbed(interaction, user, cacheData.shop, cacheData.departments, bot.collectorShopManager);
            const components = [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`collector_collect_${targetUserId}`)
                        .setLabel('Collect Resources')
                        .setEmoji('📦')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`collector_upgrade_shop_${targetUserId}`)
                        .setLabel('Upgrade Shop')
                        .setEmoji('⬆️')
                        .setStyle(ButtonStyle.Primary)
                ),
                ...command.buildDepartmentButtons(cacheData.departments, bot.collectorShopManager, targetUserId)
            ];
            await interaction.editReply({ embeds: [embed], components });
        } catch (error) {
            console.error('Error handling collector overview button:', error);
            await this.replyAfterFailure(interaction, 'An error occurred while loading your shop. Please try again!');
        }
    }

    static async handleStart(interaction, bot) {
        try {
            const parts = interaction.customId.split('_');
            const command = bot.commands.get('start');
            if (command) {
                await command.handleStartAction(interaction, bot.database, bot.userManager, parts[1], parts[2]);
            }
        } catch (error) {
            console.error('Error handling start button interaction:', error);
            await this.replyAfterFailure(interaction, 'An error occurred while processing the action. Please try again!');
        }
    }

    static async handleRiskyDeal(interaction, bot) {
        try {
            const parts = interaction.customId.split('_');
            const action = parts[1];
            const targetUserId = parts[2];
            const cardId = parts[3];

            if (interaction.user.id !== targetUserId) {
                return await interaction.reply({
                    content: '🚫 This isn\'t your gamble! Use `/risky_deal` to make your own.',
                    ephemeral: true
                });
            }

            if (action === 'cancel') {
                return await interaction.update({
                    embeds: [new EmbedBuilder()
                        .setTitle('🚶 You Walked Away')
                        .setDescription(
                            '*Vex scowls as you turn away...*\n\n' +
                            '"Coward. Come back when you have the guts to gamble."\n\n' +
                            '*He vanishes into the shadows with a mocking laugh.*'
                        )
                        .setColor('#555555')],
                    components: []
                });
            }

            if (action !== 'confirm') return;

            const command = bot.commands.get('risky_deal');
            if (!command || typeof command.handleConfirmation !== 'function') {
                throw new Error('Risky deal confirmation handler not found');
            }

            await command.handleConfirmation(interaction, {
                database: bot.database,
                userManager: bot.userManager,
                cardManager: bot.cardManager
            }, cardId);
        } catch (error) {
            console.error('Error handling Vex button interaction:', error);
            await this.replyAfterFailure(interaction, 'Vex has disappeared into the shadows. Try again later!');
        }
    }

    static async replyAfterFailure(interaction, content) {
        if (!interaction.replied && !interaction.deferred) {
            return await interaction.reply({ content, ephemeral: true });
        }

        return await interaction.editReply({ content });
    }
}

module.exports = InteractionRouter;