const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EmbedUtils = require('../utils/EmbedUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('zam')
        .setDescription('Draw a random Pokémon card! (5 second cooldown, admin bypassable)'),
    cooldown: 5, // 5 seconds
    
    async execute(interaction, { database, userManager, cardManager, questManager }) {
        try {
            // Defer reply for database operations
            await interaction.deferReply();
            
            const userId = interaction.user.id;
            let user = await userManager.getUser(userId);
            
            // Create user if doesn't exist
            if (!user) {
                user = await userManager.createUser(userId, interaction.user.username);
            }

            // Check if user has started their adventure
            if (!user.has_started) {
                const yamlContent = `\`\`\`yaml
#═══════════════════════════════════════════════════
# 🚫 ADVENTURE NOT STARTED - WELCOME TO POKÉZAM! 
#═══════════════════════════════════════════════════

trainer status         : "NOT STARTED"
required action        : "Use /start command to begin"
adventure progress     : "0% - Journey awaits!"

#───────────────────────────────────────────────────
# 🎒 WHAT YOU'LL UNLOCK WITH /START
#───────────────────────────────────────────────────

starter package:
  welcome charm        : "125 uses - Boosts everything!"
  initial gold         : "500 🪙 coins"
  starter items        : "Essential trainer kit"
  
gameplay features:
  card drawing         : "Access to /zam command"
  quest system         : "Daily/Weekly/Monthly challenges"
  item shop           : "Purchase powerful boosts"
  progression         : "Level up and unlock more!"

#───────────────────────────────────────────────────
# 🎯 READY TO START YOUR JOURNEY?
#───────────────────────────────────────────────────

next step              : "Type '/start' to begin!"
experience awaiting    : "Cards, quests, and adventure!"

#═══════════════════════════════════════════════════
\`\`\``;

                return await interaction.editReply({
                    embeds: [{
                        title: '🚫 Adventure Not Started - Welcome to Pokézam!',
                        description: yamlContent,
                        color: 0xff6b6b,
                        timestamp: new Date().toISOString(),
                        footer: {
                            text: `Welcome ${interaction.user.username}! Use /start to begin`,
                            icon_url: interaction.user.displayAvatarURL()
                        }
                    }]
                });
            }

            // Check for guild bonuses (implement guild system first)
            let guildLuckBonus = 0;
            if (user.guild_id) {
                // TODO: Check guild perks for luck bonus
                guildLuckBonus = 0; // Placeholder
            }

            // Get unlocked generations for this user
            const unlockedGenerations = await userManager.getUnlockedGenerations(user.id);
            
            // Draw a random card based on user level
            const drawnCard = await cardManager.getRandomCard(user.level, guildLuckBonus);
            
            if (!drawnCard) {
                return await interaction.editReply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        'No Cards Available',
                        `No cards are available for your current level!\n\nUnlocked generations: ${unlockedGenerations.map(g => g.name).join(', ')}`
                    )]
                });
            }

            // Determine Master Set variant for this draw
            const variant = cardManager.determineVariant(drawnCard, 'normal');
            const variantInfo = cardManager.getVariantInfo(variant);
            
            // Add card variant to user's collection
            await cardManager.addVariantToUser(userId, drawnCard.id, variant);
            
            // Calculate rewards with rarity-based XP and variant bonuses
            const baseXpReward = this.getXPReward(drawnCard.rarity);
            const xpReward = baseXpReward + variantInfo.xpBonus;
            let baseGoldReward = this.getGoldReward(drawnCard.rarity);
            let goldReward = Math.floor(baseGoldReward * variantInfo.goldMultiplier);
            
            // Check for Welcome Charm effect
            const welcomeCharm = await database.getUserEffectsByCategory(userId, 'multi_boost');
            const activeWelcomeCharm = welcomeCharm.find(effect => 
                effect.effect_type === 'welcome_charm' && 
                effect.uses_remaining && 
                effect.uses_remaining > 0
            );
            
            let welcomeCharmActive = false;
            if (activeWelcomeCharm) {
                // Apply Welcome Charm: +25% gold bonus
                goldReward = Math.floor(goldReward * 1.25);
                welcomeCharmActive = true;
                
                // Decrement uses
                await database.updateEffectUses(activeWelcomeCharm.id, activeWelcomeCharm.uses_remaining - 1);
            }
            
            // Add XP, Gold and update draws
            const xpResult = await userManager.addXP(userId, xpReward);
            await userManager.addGold(userId, goldReward);
            await userManager.updateUser(userId, { 
                total_draws: user.total_draws + 1 
            });

            // Determine rarity tier and add special effects
            const rarityInfo = this.getRarityInfo(drawnCard.rarity);
            
            // Get detailed card information with cached data
            const detailedCard = await cardManager.getDetailedCard(drawnCard.id);
            
            // Create clean response embed with Pokemon info
            // Map set names to set IDs for better display
            const setNameToId = {
                'Base Set': 'base1',
                'Jungle': 'base2', 
                'Fossil': 'base3',
                'Base': 'base1'
            };
            
            // Card number lookup for common Base Set Pokemon
            const baseSetNumbers = {
                'Alakazam': '1', 'Blastoise': '2', 'Chansey': '3', 'Charizard': '4', 'Clefairy': '5',
                'Gyarados': '6', 'Hitmonchan': '7', 'Machamp': '8', 'Magneton': '9', 'Mewtwo': '10',
                'Nidoking': '11', 'Ninetales': '12', 'Poliwrath': '13', 'Raichu': '14', 'Venomoth': '15',
                'Venusaur': '16', 'Zapdos': '17', 'Beedrill': '18', 'Dragonair': '19', 'Dugtrio': '20',
                'Electabuzz': '21', 'Electrode': '22', 'Pidgeotto': '23', 'Arcanine': '24', 'Charmeleon': '25',
                'Dewgong': '26', 'Dratini': '27', 'Farfetchd': '28', 'Growlithe': '29', 'Haunter': '30',
                'Ivysaur': '31', 'Jynx': '32', 'Kadabra': '33', 'Kakuna': '34', 'Machoke': '35',
                'Magikarp': '36', 'Magmar': '37', 'Nidorino': '38', 'Poliwhirl': '39', 'Porygon': '40',
                'Raticate': '41', 'Seel': '42', 'Wartortle': '43', 'Abra': '44', 'Bulbasaur': '45',
                'Caterpie': '46', 'Charmander': '47', 'Diglett': '48', 'Doduo': '49', 'Drowzee': '50',
                'Gastly': '51', 'Koffing': '52', 'Machop': '53', 'Magnemite': '54', 'Metapod': '55',
                'Nidoran♂': '56', 'Onix': '57', 'Pidgey': '58', 'Pikachu': '59', 'Poliwag': '60',
                'Ponyta': '61', 'Rattata': '62', 'Sandshrew': '63', 'Squirtle': '64', 'Starmie': '65',
                'Staryu': '66', 'Tangela': '67', 'Voltorb': '68', 'Vulpix': '69', 'Weedle': '70'
            };
            
            const setId = detailedCard.set_id || setNameToId[detailedCard.set_name] || detailedCard.set_name || 'Unknown';
            
            // Use actual card number if available, otherwise lookup, otherwise N/A
            let cardId = detailedCard.number;
            if (!cardId && detailedCard.set_name === 'Base Set' && baseSetNumbers[detailedCard.name]) {
                cardId = baseSetNumbers[detailedCard.name];
            }
            cardId = cardId || 'N/A';
            
            // Get user's updated gold total
            const updatedUser = await userManager.getUser(userId);
            
            // Build ultra-clean YAML card draw result with Master Set variant info
            const isSpecialVariant = variant !== 'normal';
            let yamlDescription = '```yaml\n';
            yamlDescription += '#═══════════════════════════════════════════════════\n';
            yamlDescription += `# ${isSpecialVariant ? variantInfo.emoji : '🎴'} ${detailedCard.name.toUpperCase()}\n`;
            yamlDescription += '#═══════════════════════════════════════════════════\n\n';
            
            yamlDescription += '🃏 CARD INFO:\n';
            yamlDescription += `   Name               : "${detailedCard.name}"\n`;
            yamlDescription += `   Set ID             : "${setId}"\n`;
            yamlDescription += `   Card Number        : "${cardId}"\n`;
            yamlDescription += `   Rarity             : "${detailedCard.rarity}"\n`;
            
            // Only add Master Set variant information if it's a special variant
            if (isSpecialVariant) {
                yamlDescription += `   Variant            : "${variantInfo.displayName}" ${variantInfo.emoji}\n`;
            }
            
            // Add type if available
            if (detailedCard.is_cached && detailedCard.types) {
                try {
                    const types = JSON.parse(detailedCard.types);
                    if (types && types.length > 0) {
                        yamlDescription += `   Type               : "${types.join(', ')}"\n`;
                    }
                } catch (e) {
                    // Ignore JSON parsing errors
                }
            }
            
            yamlDescription += '\n💰 REWARDS EARNED:\n';
            yamlDescription += `   Experience         : ${xpReward} XP${variantInfo.xpBonus > 0 ? ` (${baseXpReward} base +${variantInfo.xpBonus} variant)` : ` (${baseXpReward} rarity bonus)`}\n`;
            
            // Build gold reward display with bonuses
            let goldDisplay = `${goldReward.toLocaleString()} 🪙`;
            const bonuses = [];
            if (variantInfo.goldMultiplier > 1) {
                bonuses.push(`${variantInfo.goldMultiplier}x variant`);
            }
            if (welcomeCharmActive) {
                bonuses.push('1.25x Welcome Charm');
            }
            if (bonuses.length > 0) {
                goldDisplay += ` (${bonuses.join(' + ')})`;
            }
            
            yamlDescription += `   Gold Reward        : ${goldDisplay}\n`;
            yamlDescription += `   Rarity Bonus       : "${rarityInfo.description.replace(/\*\*/g, '').replace('!', '')}"\n`;
            if (isSpecialVariant) {
                yamlDescription += `   Variant Bonus      : "${variantInfo.description}"\n`;
            }
            yamlDescription += '\n';
            yamlDescription += '#═══════════════════════════════════════════════════\n';
            yamlDescription += '```';
            
            const embed = new EmbedBuilder()
                .setTitle(`${isSpecialVariant ? variantInfo.emoji : rarityInfo.emoji} ${isSpecialVariant ? `${variantInfo.displayName} ` : ''}Card Drawn!`)
                .setDescription(yamlDescription)
                .setColor(isSpecialVariant ? variantInfo.color : rarityInfo.color)
                .setTimestamp()
                .setFooter({ 
                    text: `Collected by ${interaction.user.username}`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                });
            
            // Ensure image is set if available (prioritize large image)
            const imageUrl = detailedCard.image_large || detailedCard.image_small;
            if (imageUrl) {
                embed.setImage(imageUrl);
            }

            // No additional fields needed - all info is in description

            // Check for level up
            if (xpResult.leveledUp) {
                embed.addFields([
                    { name: '🎉 LEVEL UP!', value: `You reached level ${xpResult.newLevel}!`, inline: false }
                ]);

                // Check for new generation unlocks 
                const newUnlockedGenerations = await userManager.getUnlockedGenerations(userId);
                const newGenerations = newUnlockedGenerations.filter(gen => !unlockedGenerations.map(g => g.name).includes(gen.name));
                
                if (newGenerations.length > 0) {
                    embed.addFields([
                        { name: '🔓 New Generations Unlocked!', value: newGenerations.map(gen => gen.name).join(', '), inline: false }
                    ]);
                }
                
                embed.setColor('#ffd700'); // Gold for level up
            }

            // Update quest progress for all applicable quests
            await questManager.initializeUserQuests(userId);
            const questResults = await Promise.all([
                questManager.updateQuestProgress(userId, 'Daily Card Hunter', 1),
                questManager.updateQuestProgress(userId, 'Daily Collection Builder', 1), 
                questManager.updateQuestProgress(userId, 'Daily Dedication', 1),
                questManager.updateQuestProgress(userId, 'Weekly Collector', 1),
                questManager.updateQuestProgress(userId, 'Weekly Explorer', 1),
                questManager.updateQuestProgress(userId, 'Weekly Master', 1),
                questManager.updateQuestProgress(userId, 'Monthly Champion', 1),
                questManager.updateQuestProgress(userId, 'Monthly Legend', 1),
                questManager.updateQuestProgress(userId, 'Monthly Pokemon Master', 1)
            ]);
            
            // Combine all completed quests
            const completedQuests = questResults.flat();
            
            // Add reaction for showcase (for quest tracking)
            await interaction.editReply({ embeds: [embed] });
            
            const reply = await interaction.fetchReply();
            await reply.react('⭐');

            // Notify about completed quests
            if (completedQuests.length > 0) {
                // Get user's daily quests to find the correct quest positions
                const dailyQuests = await questManager.getUserQuests(userId);
                const dailyQuestList = dailyQuests.filter(q => q.quest_type === 'daily');
                
                let yamlDescription = '```yaml\n';
                yamlDescription += '#═══════════════════════════════════════════════════\n';
                yamlDescription += '# 🎯 QUEST REWARDS EARNED\n';
                yamlDescription += '#═══════════════════════════════════════════════════\n\n';
                
                completedQuests.forEach((q, index) => {
                    // Find the actual position of this quest in the daily quest list
                    const questPosition = dailyQuestList.findIndex(dailyQuest => dailyQuest.name === q.name) + 1;
                    const displayPosition = questPosition > 0 ? questPosition : index + 1; // Fallback to array index if not found
                    
                    yamlDescription += `🎉 QUEST ${displayPosition} COMPLETED:\n`;
                    yamlDescription += `   Name               : "${q.name}"\n`;
                    yamlDescription += `   Gold Reward        : ${q.reward_gold.toLocaleString()} 🪙\n`;
                    yamlDescription += `   XP Reward          : ${q.reward_xp} ✨\n`;
                    
                    // Add level up information if available
                    if (q.levelUp) {
                        yamlDescription += `   Level Up           : ${q.levelUp.oldLevel} → ${q.levelUp.newLevel} 🎉\n`;
                    }
                    
                    if (index < completedQuests.length - 1) {
                        yamlDescription += '\n';
                    }
                });
                
                yamlDescription += '\n#═══════════════════════════════════════════════════\n';
                yamlDescription += '```';

                const questEmbed = new EmbedBuilder()
                    .setTitle('🎉 Quest Completed!')
                    .setDescription(yamlDescription)
                    .setColor('#ffd700')
                    .setTimestamp();
                
                setTimeout(async () => {
                    try {
                        await interaction.followUp({ embeds: [questEmbed], ephemeral: true });
                    } catch (error) {
                        console.error('Error sending quest completion notification:', error);
                    }
                }, 1000);
            }

        } catch (error) {
            console.error('Error in draw command:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        'Draw Error',
                        'An error occurred while drawing a card. Please try again!'
                    )],
                    flags: 64
                });
            } else {
                await interaction.editReply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        'Draw Error',
                        'An error occurred while drawing a card. Please try again!'
                    )]
                });
            }
        }
    },

    getRarityInfo(rarity) {
        const rarityLower = rarity.toLowerCase();
        
        if (rarityLower.includes('secret')) {
            return {
                emoji: '🌟✨',
                description: '**LEGENDARY SECRET RARE!** An incredibly rare find!',
                color: '#FF5722', // Orange
                goldRange: [5000, 10000]
            };
        } else if (rarityLower.includes('ultra')) {
            return {
                emoji: '💎',
                description: '**ULTRA RARE!** A magnificent discovery!',
                color: '#E91E63', // Pink
                goldRange: [2000, 5000]
            };
        } else if (rarityLower.includes('holo')) {
            return {
                emoji: '✨',
                description: '**HOLOGRAPHIC RARE!** Shimmering with power!',
                color: '#9B59B6', // Purple
                goldRange: [1000, 2000]
            };
        } else if (rarityLower.includes('rare')) {
            return {
                emoji: '⭐',
                description: '**RARE CARD!** A valuable addition!',
                color: '#3498DB', // Blue
                goldRange: [400, 1000]
            };
        } else if (rarityLower.includes('uncommon')) {
            return {
                emoji: '🎴',
                description: '**Uncommon card** - Nice find!',
                color: '#2ECC71', // Green
                goldRange: [250, 400]
            };
        } else {
            return {
                emoji: '📄',
                description: 'A **common card** for your collection.',
                color: '#FFFFFF', // White
                goldRange: [100, 250]
            };
        }
    },

    getXPReward(rarity) {
        const rarityLower = rarity.toLowerCase();
        
        // Secret/Legendary rarities (highest tier)
        if (rarityLower.includes('secret') || rarityLower.includes('rainbow')) {
            return 50; // Legendary XP for the rarest cards
        }
        
        // Ultra rare tier (EX, GX, V, VMAX, etc.)
        if (rarityLower.includes('ultra') || rarityLower.includes('ex') || 
            rarityLower.includes('gx') || rarityLower.includes('vmax') ||
            rarityLower.includes(' v ') || rarityLower.includes('vstar') ||
            rarityLower.includes('break') || rarityLower.includes('prime')) {
            return 25; // High XP for ultra rare mechanics
        }
        
        // Special rare categories
        if (rarityLower.includes('prism') || rarityLower.includes('amazing') ||
            rarityLower.includes('radiant') || rarityLower.includes('ace spec')) {
            return 35; // Special XP for unique mechanics
        }
        
        // Holographic rares
        if (rarityLower.includes('holo')) {
            return 10; // Solid XP for holographic cards
        }
        
        // Standard rares
        if (rarityLower.includes('rare')) {
            return 5; // Moderate XP for rare cards
        }
        
        // Uncommon cards
        if (rarityLower.includes('uncommon')) {
            return 2; // Small XP boost for uncommons
        }
        
        // Common cards (baseline)
        return 1; // Base XP for common cards
    },

    getGoldReward(rarity) {
        const rarityInfo = this.getRarityInfo(rarity);
        const [min, max] = rarityInfo.goldRange;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    getRarityBonus(rarity) {
        const rarityLower = rarity.toLowerCase();
        if (rarityLower.includes('secret')) return 'LEGENDARY STATUS';
        if (rarityLower.includes('ultra')) return 'ULTRA POWER';
        if (rarityLower.includes('holo')) return 'HOLOGRAPHIC SHINE';
        if (rarityLower.includes('rare')) return 'RARE FIND';
        if (rarityLower.includes('uncommon')) return 'NICE DISCOVERY';
        return 'SOLID ADDITION';
    },

    getNextMilestone(totalDraws) {
        const milestones = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
        const nextMilestone = milestones.find(m => m > totalDraws);
        return nextMilestone ? `${nextMilestone} draws` : 'Max milestone reached!';
    }
};