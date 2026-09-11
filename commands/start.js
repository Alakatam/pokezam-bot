const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const EmbedUtils = require('../utils/EmbedUtils');

function buildStarterButtons(userId) {
    return new ActionRowBuilder().addComponents([
        new ButtonBuilder()
            .setCustomId(`start_zam_${userId}`)
            .setLabel('🎴 Draw First Card')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`start_treasure_${userId}`)
            .setLabel('💰 Open Chest')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`start_quests_${userId}`)
            .setLabel('🎯 Quests')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`start_shop_${userId}`)
            .setLabel('🛒 Shop')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`start_help_${userId}`)
            .setLabel('📚 Help')
            .setStyle(ButtonStyle.Secondary)
    ]);
}

async function safeStarterStep(label, fn) {
    try {
        return await fn();
    } catch (error) {
        console.warn(`⚠️ Starter step failed (${label}):`, error.message || error);
        return { skipped: true, error };
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('start')
        .setDescription('Welcome to Pokézam! Get your starter package and learn the basics'),

    async execute(interaction, { database, userManager, cardManager, questManager }) {
        try {
            await interaction.deferReply();

            const userId = interaction.user.id;
            let user = await userManager.getUser(userId);

            if (user && user.has_started) {
                return await interaction.editReply({
                    embeds: [
                        EmbedUtils.createBaseEmbed({
                            title: '🎮 Welcome Back to Pokézam',
                            description: `**${interaction.user.displayName}, your trainer journey is already in motion.** Keep building momentum and stay on the fast track to elite collection power.`,
                            color: EmbedUtils.palette.accent,
                            thumbnail: interaction.user.displayAvatarURL({ dynamic: true }),
                            footerText: 'Use /help for the full command hub or jump back in with a quick action below.',
                            fields: [
                                {
                                    name: '⚡ Elite Starter Path',
                                    value: '1. Draw cards with `/zam`\n2. Complete quests with `/quest`\n3. Open chest rewards with `/use`\n4. Upgrade your progression with `/shop`',
                                    inline: false
                                },
                                {
                                    name: '🧠 Core Commands',
                                    value: '`/profile` • `/binder` • `/inventory` • `/shop` • `/quest` • `/daily` • `/carddex-reg`',
                                    inline: false
                                }
                            ]
                        })
                    ],
                    components: [buildStarterButtons(userId)]
                });
            }

            if (!user) {
                user = await userManager.createUser(userId, interaction.user.username);
            }

            if (!user) {
                user = await userManager.getUser(userId);
            }

            const starterResults = {
                gold: await safeStarterStep('add_gold', async () => {
                    if (userManager && typeof userManager.addGold === 'function') {
                        return await userManager.addGold(userId, 1500);
                    }
                    return null;
                }),
                item: await safeStarterStep('add_item', async () => {
                    if (database && typeof database.addUserItem === 'function') {
                        return await database.addUserItem(userId, 'treasure_chest', 1);
                    }
                    return null;
                }),
                effects: await safeStarterStep('effect_check', async () => {
                    if (!database || typeof database.getUserActiveEffects !== 'function') {
                        return { hasWelcomeCharm: false };
                    }

                    const existingEffects = await database.getUserActiveEffects(userId);
                    const hasWelcomeCharm = Array.isArray(existingEffects) && existingEffects.some(effect => effect.effect_type === 'welcome_charm');

                    if (!hasWelcomeCharm && typeof database.addActiveEffect === 'function') {
                        await database.addActiveEffect(
                            userId,
                            'welcome_charm',
                            'multi_boost',
                            1.0,
                            null,
                            125
                        );
                    }

                    return { hasWelcomeCharm };
                }),
                started: await safeStarterStep('mark_started', async () => {
                    if (!database || typeof database.run !== 'function') return null;
                    return await database.run('UPDATE users SET has_started = TRUE WHERE id = ?', [userId]);
                })
            };

            const starterWarnings = Object.entries(starterResults)
                .filter(([, result]) => result && result.skipped)
                .map(([key]) => key);

            if (starterWarnings.length > 0) {
                console.warn(`Starter package partially applied for ${userId}. Skipped steps: ${starterWarnings.join(', ')}`);
            }

            const embed = EmbedUtils.createBaseEmbed({
                title: '🎉 Pokézam Trainer Launch Complete',
                description: `**${interaction.user.displayName}, welcome aboard.** 🌟\n\nYour starter kit is live, your trainer profile is active, and you’re ready to start collecting, grinding, and building a serious card empire.`,
                color: EmbedUtils.palette.warning,
                thumbnail: interaction.user.displayAvatarURL({ dynamic: true }),
                footerText: 'Welcome Charm bonus: +25% gold and 2x rare draw potential for 125 uses.',
                fields: [
                    {
                        name: '🎁 Starter Rewards',
                        value: '`💰 Gold:` 1,500\n`🧩 Welcome Charm:` +25% gold, 2x rare chance\n`🎁 Treasure Chest:` Premium starter loot',
                        inline: false
                    },
                    {
                        name: '🚀 Elite 4-Step Launch Plan',
                        value: '1. `/zam` — pull your first card\n2. `/use treasure-chest` — open your starter chest\n3. `/quest` — complete daily objectives\n4. `/shop` — upgrade your progression plan',
                        inline: false
                    },
                    {
                        name: '🧠 Essential Commands',
                        value: '`/profile` • `/binder` • `/inventory` • `/shop` • `/quest` • `/daily` • `/carddex-reg`',
                        inline: false
                    },
                    {
                        name: '✨ Premium Tip',
                        value: 'Elite collectors win by staying consistent: draw, complete quests, and stack gold before buying flashy upgrades.',
                        inline: false
                    }
                ]
            });

            await interaction.editReply({
                embeds: [embed],
                components: [buildStarterButtons(userId)]
            });

        } catch (error) {
            console.error('Error in start command:', error);
            const reply = {
                content: '❌ An error occurred while setting up your starter package. Please try again!',
                ephemeral: true
            };

            if (interaction.deferred) {
                await interaction.editReply(reply);
            } else {
                await interaction.reply(reply);
            }
        }
    },

    async handleStartAction(interaction, database, userManager, action, userId) {
        try {
            if (interaction.user.id !== userId) {
                return await interaction.reply({
                    content: 'You can only use your own starter buttons!',
                    ephemeral: true
                });
            }

            await interaction.deferUpdate();

            switch (action) {
                case 'zam':
                    await interaction.followUp({
                        content: '🎴 **Ready to draw your first card?**\n\nUse `/zam` to pull your opening pack. Your **Welcome Charm** boosts gold earnings and pushes rare pull odds higher.\n\n*This bonus lasts for 125 card draws.*',
                        ephemeral: true
                    });
                    break;

                case 'treasure':
                    await interaction.followUp({
                        content: '💰 **Starter treasure ready.**\n\nUse `/use treasure-chest` to open your chest and grab premium starter loot.\n\n*Tip: check `/inventory` after opening it to review your rewards.*',
                        ephemeral: true
                    });
                    break;

                case 'quests':
                    await interaction.followUp({
                        content: '🎯 **Quest board active.**\n\nUse `/quest` to complete your daily challenges for gold, XP, and faster progression.\n\n*Staying consistent is the fastest route to elite collector status.*',
                        ephemeral: true
                    });
                    break;

                case 'shop':
                    await interaction.followUp({
                        content: '🛒 **The market is open.**\n\nUse `/shop` to buy the best upgrades for your trainer. The strongest early investments improve gold income and draw efficiency.\n\n*Start smart: prioritize upgrades that increase value over vanity purchases.*',
                        ephemeral: true
                    });
                    break;

                case 'help':
                    await interaction.followUp({
                        content: '📚 **Training guide ready.**\n\nUse `/help` to open the full Pokézam command hub and explore the full command layout for collection, progression, and economy.\n\n*This keeps your trainer loop efficient from day one.*',
                        ephemeral: true
                    });
                    break;
            }

        } catch (error) {
            console.error('Error handling start action:', error);
            await interaction.followUp({
                content: '❌ An error occurred. Please try the command manually!',
                ephemeral: true
            });
        }
    }
};