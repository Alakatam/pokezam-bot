const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EmbedUtils = require('../utils/EmbedUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vintage-pack')
        .setDescription('Open an ultra-exclusive Vintage Pack focused on 1st Edition! (Cost: 500,000 🪙)'),
    cooldown: 30, // 30 seconds
    
    async execute(interaction, { database, userManager, cardManager, questManager }) {
        try {
            await interaction.deferReply();
            
            const userId = interaction.user.id;
            let user = await userManager.getUser(userId);
            
            if (!user) {
                user = await userManager.createUser(userId, interaction.user.username);
            }

            const packCost = 500000;
            
            // Check if user has enough gold
            if (user.gold < packCost) {
                return await interaction.editReply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        'Insufficient Gold',
                        `You need ${packCost.toLocaleString()} 🪙 to open a Vintage Pack!\n\nYour current gold: ${user.gold.toLocaleString()} 🪙\nNeeded: ${(packCost - user.gold).toLocaleString()} 🪙 more\n\n💡 **Tip**: Vintage Packs have 40% chance for 1st Edition cards!`
                    )]
                });
            }

            // Check level requirement (high-end pack)
            if (user.level < 25) {
                return await interaction.editReply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        'Level Requirement Not Met',
                        `Vintage Packs require **Level 25** or higher!\n\nYour current level: **${user.level}**\nRequired level: **25**\n\n💡 **Tip**: Keep drawing cards to gain XP and level up!`
                    )]
                });
            }

            // Deduct gold
            await userManager.addGold(userId, -packCost);

            const packResults = [];
            let totalGold = 0;
            let totalXP = 0;

            // Draw 7 cards with vintage pack odds (1st Edition focus)
            for (let i = 0; i < 7; i++) {
                const drawnCard = await cardManager.getRandomCard(user.level);
                
                if (!drawnCard) continue;

                // Determine variant with vintage pack odds
                const variant = cardManager.determineVariant('vintage');
                const variantInfo = cardManager.getVariantInfo(variant);
                
                // Add card variant to user's collection
                await cardManager.addVariantToUser(userId, drawnCard.id, variant);
                
                // Calculate rewards with vintage bonus
                const baseGoldReward = this.getGoldReward(drawnCard.rarity);
                const goldReward = Math.floor(baseGoldReward * variantInfo.goldMultiplier * 1.2); // 20% vintage bonus
                const xpReward = 3 + variantInfo.xpBonus; // Base 3 XP for vintage packs
                
                totalGold += goldReward;
                totalXP += xpReward;

                packResults.push({
                    card: drawnCard,
                    variant,
                    variantInfo,
                    goldReward,
                    xpReward
                });
            }

            // Award total rewards
            await userManager.addXP(userId, totalXP);
            await userManager.addGold(userId, totalGold);
            await userManager.updateUser(userId, { 
                total_draws: user.total_draws + 7 
            });

            // Update quests
            const completedQuests = await questManager.updateQuestProgress(userId, 'draw_cards', 7);

            // Create pack opening embed
            let yamlDescription = '```yaml\n';
            yamlDescription += '#═══════════════════════════════════════════════════\n';
            yamlDescription += '# 🏺 VINTAGE PACK OPENING RESULTS\n';
            yamlDescription += '#═══════════════════════════════════════════════════\n\n';

            packResults.forEach((result, index) => {
                yamlDescription += `🎴 CARD_${index + 1}:\n`;
                yamlDescription += `   Name               : "${result.card.name}"\n`;
                yamlDescription += `   Set                : "${result.card.set_name}"\n`;
                yamlDescription += `   Rarity             : "${result.card.rarity}"\n`;
                yamlDescription += `   Variant            : "${result.variantInfo.name}" ${result.variantInfo.emoji}\n`;
                yamlDescription += `   Gold Earned        : ${result.goldReward.toLocaleString()} 🪙\n`;
                yamlDescription += `   XP Earned          : ${result.xpReward} XP\n\n`;
            });

            const netGold = totalGold - packCost;
            yamlDescription += '💰 VINTAGE PACK TOTALS:\n';
            yamlDescription += `   Pack Cost          : -${packCost.toLocaleString()} 🪙\n`;
            yamlDescription += `   Gold Earned        : +${totalGold.toLocaleString()} 🪙\n`;
            yamlDescription += `   Vintage Bonus      : +20% Gold Multiplier\n`;
            yamlDescription += `   Net Gold           : ${netGold >= 0 ? '+' : ''}${netGold.toLocaleString()} 🪙\n`;
            yamlDescription += `   Total XP           : +${totalXP} XP\n\n`;
            
            // Pack statistics
            const firstEditionCount = packResults.filter(r => r.variant === 'first_edition').length;
            const holoCount = packResults.filter(r => r.variant === 'holo').length;
            const reverseCount = packResults.filter(r => r.variant === 'reverse').length;
            
            yamlDescription += '📊 VINTAGE PACK STATS:\n';
            yamlDescription += `   1st Edition Cards  : ${firstEditionCount}/7\n`;
            yamlDescription += `   Holographic Cards  : ${holoCount}/7\n`;
            yamlDescription += `   Reverse Holo Cards : ${reverseCount}/7\n`;
            yamlDescription += `   Normal Cards       : ${7 - firstEditionCount - holoCount - reverseCount}/7\n\n`;
            
            yamlDescription += '#═══════════════════════════════════════════════════\n';
            yamlDescription += '```';

            // Determine pack quality based on 1st Edition pulls
            let packTitle = '🏺 Vintage Pack Opened!';
            let packColor = '#8B4513';
            let achievementMessage = '';
            
            if (firstEditionCount >= 5) {
                packTitle = '🥇🏆 LEGENDARY VINTAGE PACK!';
                packColor = '#FFD700';
                achievementMessage = '\n🏆 **LEGENDARY PULL!** Museum-quality collection!';
            } else if (firstEditionCount >= 3) {
                packTitle = '🥇✨ FIRST EDITION VINTAGE PACK!';
                packColor = '#FFA500';
                achievementMessage = '\n🥇 **INCREDIBLE PULL!** Multiple 1st Editions!';
            } else if (firstEditionCount >= 1) {
                packTitle = '🏺✨ VINTAGE PACK SUCCESS!';
                packColor = '#CD853F';
                achievementMessage = '\n✨ **Great pull!** 1st Edition secured!';
            }

            const embed = new EmbedBuilder()
                .setTitle(packTitle)
                .setDescription(yamlDescription + (achievementMessage ? `\n${achievementMessage}` : ''))
                .setColor(packColor)
                .setTimestamp()
                .setFooter({ 
                    text: `Opened by ${interaction.user.username} • Vintage Collector Level ${user.level}`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                });

            await interaction.editReply({ embeds: [embed] });

            // Add reactions based on results
            const reply = await interaction.fetchReply();
            await reply.react('🏺');
            if (firstEditionCount >= 1) await reply.react('🥇');
            if (firstEditionCount >= 3) await reply.react('🏆');
            if (holoCount >= 2) await reply.react('✨');
            if (netGold >= 10000) await reply.react('💰');

            // Special achievement for incredible pulls
            if (firstEditionCount >= 4) {
                setTimeout(async () => {
                    try {
                        await interaction.followUp({ 
                            embeds: [EmbedUtils.createSuccessEmbed(
                                '🏆 Vintage Master Achievement!',
                                `**${firstEditionCount}/7 First Edition cards!**\nYou've achieved legendary status in vintage collecting! This is an incredibly rare pull that showcases true collector's luck! 🥇✨`
                            )], 
                            ephemeral: true 
                        });
                    } catch (error) {
                        console.error('Error sending achievement notification:', error);
                    }
                }, 2000);
            }

            // Notify about completed quests
            if (completedQuests.length > 0) {
                const questEmbed = EmbedUtils.createSuccessEmbed(
                    '🎉 Quest Completed!',
                    completedQuests.map(q => `**${q.name}** - Earned ${q.reward} 🪙 Gold!`).join('\n')
                );
                
                setTimeout(async () => {
                    try {
                        await interaction.followUp({ embeds: [questEmbed], ephemeral: true });
                    } catch (error) {
                        console.error('Error sending quest completion notification:', error);
                    }
                }, 1000);
            }

        } catch (error) {
            console.error('Error in vintage pack command:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        'Vintage Pack Error',
                        'An error occurred while opening your vintage pack. Your gold has not been deducted!'
                    )],
                    flags: 64
                });
            } else {
                await interaction.editReply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        'Vintage Pack Error',
                        'An error occurred while opening your vintage pack. Please contact support if gold was deducted!'
                    )]
                });
            }
        }
    },

    getGoldReward(rarity) {
        const rarityLower = rarity.toLowerCase();
        let min, max;
        
        if (rarityLower.includes('secret')) {
            min = 5000; max = 10000;
        } else if (rarityLower.includes('ultra')) {
            min = 2000; max = 5000;
        } else if (rarityLower.includes('holo')) {
            min = 1000; max = 2000;
        } else if (rarityLower.includes('rare')) {
            min = 400; max = 1000;
        } else if (rarityLower.includes('uncommon')) {
            min = 250; max = 400;
        } else {
            min = 100; max = 250;
        }
        
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
};