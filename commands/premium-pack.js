const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EmbedUtils = require('../utils/EmbedUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('premium-pack')
        .setDescription('Open a premium pack with guaranteed special variants! (Cost: 100,000 🪙)'),
    cooldown: 10, // 10 seconds
    
    async execute(interaction, { database, userManager, cardManager, questManager }) {
        try {
            await interaction.deferReply();
            
            const userId = interaction.user.id;
            let user = await userManager.getUser(userId);
            
            if (!user) {
                user = await userManager.createUser(userId, interaction.user.username);
            }

            const packCost = 100000;
            
            // Check if user has enough gold
            if (user.gold < packCost) {
                return await interaction.editReply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        'Insufficient Gold',
                        `You need ${packCost.toLocaleString()} 🪙 to open a Premium Pack!\n\nYour current gold: ${user.gold.toLocaleString()} 🪙\nNeeded: ${(packCost - user.gold).toLocaleString()} 🪙 more`
                    )]
                });
            }

            // Deduct gold
            await userManager.addGold(userId, -packCost);

            // Get unlocked eras
            const unlockedEras = await userManager.getUnlockedEras(user.id);
            
            const packResults = [];
            let totalGold = 0;
            let totalXP = 0;

            // Draw 3 cards with premium pack odds
            for (let i = 0; i < 3; i++) {
                const drawnCard = await cardManager.getRandomCard(user.level);
                
                if (!drawnCard) continue;

                // Determine variant with premium pack odds
                const variant = cardManager.determineVariant('premium');
                const variantInfo = cardManager.getVariantInfo(variant);
                
                // Add card variant to user's collection
                await cardManager.addVariantToUser(userId, drawnCard.id, variant);
                
                // Calculate rewards
                const baseGoldReward = this.getGoldReward(drawnCard.rarity);
                const goldReward = Math.floor(baseGoldReward * variantInfo.goldMultiplier);
                const xpReward = 1 + variantInfo.xpBonus;
                
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
                total_draws: user.total_draws + 3 
            });

            // Update quests
            const completedQuests = await questManager.updateQuestProgress(userId, 'draw_cards', 3);

            // Create pack opening embed
            let yamlDescription = '```yaml\n';
            yamlDescription += '#═══════════════════════════════════════════════════\n';
            yamlDescription += '# 💎 PREMIUM PACK OPENING RESULTS\n';
            yamlDescription += '#═══════════════════════════════════════════════════\n\n';

            packResults.forEach((result, index) => {
                yamlDescription += `🎴 CARD_${index + 1}:\n`;
                yamlDescription += `   Name               : "${result.card.name}"\n`;
                yamlDescription += `   Rarity             : "${result.card.rarity}"\n`;
                yamlDescription += `   Variant            : "${result.variantInfo.name}" ${result.variantInfo.emoji}\n`;
                yamlDescription += `   Gold Earned        : ${result.goldReward.toLocaleString()} 🪙\n`;
                yamlDescription += `   XP Earned          : ${result.xpReward} XP\n\n`;
            });

            yamlDescription += '💰 PACK TOTALS:\n';
            yamlDescription += `   Pack Cost          : -${packCost.toLocaleString()} 🪙\n`;
            yamlDescription += `   Gold Earned        : +${totalGold.toLocaleString()} 🪙\n`;
            yamlDescription += `   Net Gold           : ${totalGold >= packCost ? '+' : ''}${(totalGold - packCost).toLocaleString()} 🪙\n`;
            yamlDescription += `   Total XP           : +${totalXP} XP\n\n`;
            yamlDescription += '#═══════════════════════════════════════════════════\n';
            yamlDescription += '```';

            // Determine pack quality based on variants
            const hasFirstEdition = packResults.some(r => r.variant === 'first_edition');
            const hasHolo = packResults.some(r => r.variant === 'holo');
            const variantCount = packResults.filter(r => r.variant !== 'normal').length;

            let packTitle = '💎 Premium Pack Opened!';
            let packColor = '#9B59B6';
            
            if (hasFirstEdition) {
                packTitle = '🥇✨ LEGENDARY Premium Pack!';
                packColor = '#FFD700';
            } else if (hasHolo) {
                packTitle = '✨🌈 HOLOGRAPHIC Premium Pack!';
                packColor = '#E91E63';
            } else if (variantCount >= 2) {
                packTitle = '🔸✨ SPECIAL Premium Pack!';
                packColor = '#E1BEE7';
            }

            const embed = new EmbedBuilder()
                .setTitle(packTitle)
                .setDescription(yamlDescription)
                .setColor(packColor)
                .setTimestamp()
                .setFooter({ 
                    text: `Opened by ${interaction.user.username}`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                });

            await interaction.editReply({ embeds: [embed] });

            // Add reactions
            const reply = await interaction.fetchReply();
            await reply.react('💎');
            if (hasFirstEdition) await reply.react('🥇');
            if (hasHolo) await reply.react('✨');

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
            console.error('Error in premium pack command:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        'Premium Pack Error',
                        'An error occurred while opening your premium pack. Your gold has not been deducted!'
                    )],
                    flags: 64
                });
            } else {
                await interaction.editReply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        'Premium Pack Error',
                        'An error occurred while opening your premium pack. Please contact support if gold was deducted!'
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