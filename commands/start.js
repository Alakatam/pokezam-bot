const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('start')
        .setDescription('Welcome to Pokézam! Get your starter package and learn the basics'),

    async execute(interaction, { database, userManager, cardManager, questManager }) {
        try {
            await interaction.deferReply();

            const userId = interaction.user.id;
            let user = await userManager.getUser(userId);

            // Check if user already claimed starter package
            if (user && user.has_started) {
                return await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('🎮 **Welcome Back to Pokézam!**')
                            .setDescription('You\'ve already claimed your starter package, but here\'s a quick refresher on the basics!')
                            .addFields([
                                {
                                    name: '🎴 **Essential Commands**',
                                    value: `\`\`\`yaml
Card Collection:
  /zam: Draw random cards (5s cooldown)
  /profile: Check your stats and progress
  /binder: Browse your card collection

Discovery & Tracking:
  /carddex-reg: Explore complete TCG database
  /carddex-master: Track rare variant ownership
  /quest: View daily challenges for rewards

Strategic Gameplay:
  /shop: Purchase enhancement items
  /inventory: Manage your items and effects
  /use <item>: Activate items for bonuses
  /active-boosts: Monitor your active effects\`\`\``,
                                    inline: false
                                }
                            ])
                            .setColor('#4A90E2')
                            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                            .setFooter({ text: 'Need more help? Use /help for detailed command information!' })
                    ],
                    components: [
                        new ActionRowBuilder().addComponents([
                            new ButtonBuilder()
                                .setCustomId(`start_zam_${userId}`)
                                .setLabel('🎴 Draw a Card')
                                .setStyle(ButtonStyle.Primary),
                            new ButtonBuilder()
                                .setCustomId(`start_shop_${userId}`)
                                .setLabel('🛒 Visit Shop')
                                .setStyle(ButtonStyle.Success),
                            new ButtonBuilder()
                                .setCustomId(`start_quests_${userId}`)
                                .setLabel('🎯 Check Quests')
                                .setStyle(ButtonStyle.Secondary)
                        ])
                    ]
                });
            }

            // Create user if doesn't exist
            if (!user) {
                user = await userManager.createUser(userId, interaction.user.username);
            }

            // Give starter package
            await userManager.addGold(userId, 1000);
            await database.addUserItem(userId, 'treasure_chest', 1);
            
            // Check if Welcome Charm already exists
            const existingEffects = await database.getUserActiveEffects(userId);
            const hasWelcomeCharm = existingEffects.some(effect => effect.effect_type === 'welcome_charm');
            
            // Add Welcome Charm effect only if not already present (125 uses, 1.25x gold + 2x luck)
            if (!hasWelcomeCharm) {
                await database.addActiveEffect(
                    userId,
                    'welcome_charm',
                    'multi_boost',
                    1.0, // Base multiplier (we'll handle the specifics in /zam)
                    null, // No time expiry
                    125 // 125 uses
                );
            }

            // Mark user as started
            await database.run('UPDATE users SET has_started = TRUE WHERE id = ?', [userId]);

            // Create welcome embed
            const embed = new EmbedBuilder()
                .setTitle('🎉 **Welcome to Pokézam!**')
                .setDescription(`**Greetings, ${interaction.user.displayName}!** 🌟\n\nWelcome to the ultimate Pokémon TCG collecting experience! You're about to embark on an incredible journey through **101 TCG sets** spanning from Base Set to the latest releases.\n\n**Your adventure starts now!**`)
                .addFields([
                    {
                        name: '🎁 **Starter Package Received!**',
                        value: `\`\`\`yaml
💰 Starting Gold: 1,000g
🪙 Welcome Charm: +25% gold & 2x rare chance (125 draws)
💰 Treasure Chest: Random valuable items (500-2000g value)
\`\`\``,
                        inline: false
                    },
                    {
                        name: '🎴 **Core Commands - Your Journey Begins**',
                        value: `\`\`\`yaml
Essential Basics:
  /zam: Draw random cards (your main activity!)
  /profile: Check your stats and level
  /binder: Browse your growing collection
  
Quest & Rewards:
  /quest: Daily challenges for extra gold & XP
  
Strategic Enhancement:
  /shop: Buy items to boost your luck & gold
  /inventory: Manage your items
  /use <item>: Activate powerful bonuses
\`\`\``,
                        inline: false
                    },
                    {
                        name: '🔍 **Advanced Discovery Tools**',
                        value: `\`\`\`yaml
Collection Tracking:
  /carddex-reg: Explore all 101 TCG sets
  /carddex-master: Track rare variants & completion
  
Effect Management:
  /active-boosts: Monitor your active bonuses
\`\`\``,
                        inline: false
                    },
                    {
                        name: '🚀 **Quick Start Guide**',
                        value: `**1.** Use the buttons below to try key features\n**2.** Open your **Treasure Chest** with \`/use treasure-chest\`\n**3.** Start drawing cards with \`/zam\` (enhanced by Welcome Charm!)\n**4.** Check \`/quest\` for daily challenges\n**5.** Visit \`/shop\` when you want to enhance your gameplay`,
                        inline: false
                    }
                ])
                .setColor('#FFD700')
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                .setFooter({ 
                    text: '💡 Your Welcome Charm gives +25% gold & 2x rare chance for 125 card draws!' 
                });

            // Create action buttons
            const actionRow = new ActionRowBuilder().addComponents([
                new ButtonBuilder()
                    .setCustomId(`start_zam_${userId}`)
                    .setLabel('🎴 Draw Your First Card')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`start_treasure_${userId}`)
                    .setLabel('💰 Open Treasure Chest')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`start_quests_${userId}`)
                    .setLabel('🎯 Check Daily Quests')
                    .setStyle(ButtonStyle.Secondary)
            ]);

            await interaction.editReply({
                embeds: [embed],
                components: [actionRow]
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

    // Handle button interactions for start command
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
                    // Guide them to use /zam
                    await interaction.followUp({
                        content: '🎴 **Ready to draw your first card?**\n\nUse the `/zam` command to draw a random card! Your **Welcome Charm** will give you **+25% gold** and **2x rare chance** on this draw!\n\n*Tip: You have 125 enhanced card draws with your Welcome Charm!*',
                        ephemeral: true
                    });
                    break;

                case 'treasure':
                    // Guide them to use /use treasure-chest
                    await interaction.followUp({
                        content: '💰 **Time to open your Treasure Chest!**\n\nUse `/use treasure-chest` to open your starter Treasure Chest and receive random valuable items worth 500-2000g!\n\n*Tip: Check your inventory with `/inventory` to see all your items!*',
                        ephemeral: true
                    });
                    break;

                case 'quests':
                    // Guide them to use /quest
                    await interaction.followUp({
                        content: '🎯 **Daily Quests Available!**\n\nUse the `/quest` command to see your daily challenges! Complete them for extra **gold** and **XP** to level up faster!\n\n*Tip: Quests reset daily at 10 PM ET, so check back regularly!*',
                        ephemeral: true
                    });
                    break;

                case 'shop':
                    // Guide them to use /shop
                    await interaction.followUp({
                        content: '🛒 **Welcome to the Shop!**\n\nUse `/shop` to browse enhancement items! You can buy items to boost your gold earning, increase rare card chances, or skip cooldowns!\n\n*Tip: Start with cheaper items like Quick Ball (300g) for quality of life improvements!*',
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