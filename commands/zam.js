const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EmbedUtils = require('../utils/EmbedUtils');
const DebugManager = require('../utils/DebugManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('zam')
        .setDescription('Draw a random Pokémon card! (5 second cooldown, admin bypassable)'),
    cooldown: 5, // 5 seconds
    
    async execute(interaction, { database, userManager, cardManager, questManager }) {
        try {
            // OPTIMIZATION: Defer reply immediately to prevent Discord timeout
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
            
            // DEEP DEBUG: Investigate card selection mystery
            const totalCardsInDB = await cardManager.getTotalCardCount();
            
            DebugManager.debugSystem({
                dbStatus: 'connected',
                cardsLoaded: totalCardsInDB,
                schemaVersion: 'v1.0'
            });
            
            // Draw a random card based on user level
            const drawnCard = await cardManager.getRandomCard(user.level, guildLuckBonus);
            
            // DEEP DEBUG: ZAM command investigation
            DebugManager.debugZam({
                userLevel: user.level,
                guildLuckBonus: guildLuckBonus,
                unlockedGenerations: unlockedGenerations,
                totalCardsInDB: totalCardsInDB,
                drawnCard: drawnCard ? { id: drawnCard.id, name: drawnCard.name, set: drawnCard.set_name } : null
            });
            
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
            
            // OPTIMIZED: Get all active effects in a single query and clean up expired ones
            const now = Math.floor(Date.now() / 1000);
            
            // Single query to get all valid active effects
            const allEffects = await database.all(`
                SELECT * FROM active_effects 
                WHERE user_id = ? 
                AND (expires_at IS NULL OR expires_at > ?) 
                AND (uses_remaining IS NULL OR uses_remaining > 0)
                ORDER BY created_at DESC
            `, [userId, now]);
            
            // Clean up expired effects in a single query (async to not block response)
            setImmediate(async () => {
                try {
                    await database.run(`
                        DELETE FROM active_effects 
                        WHERE user_id = ? AND (
                            (expires_at IS NOT NULL AND expires_at <= ?) OR 
                            (uses_remaining IS NOT NULL AND uses_remaining <= 0)
                        )
                    `, [userId, now]);
                } catch (error) {
                    console.error('Error cleaning up expired effects:', error);
                }
            });
            let totalGoldMultiplier = 1.0;
            let totalLuckMultiplier = 1.0;
            const activeEffectNames = [];
            
            // Add reference to this for helper method
            const self = this;
            
            for (const effect of allEffects) {
                // Check if effect is still valid
                if (effect.expires_at && effect.expires_at <= now) continue;
                if (effect.uses_remaining !== null && effect.uses_remaining <= 0) continue;
                
                // Apply effect based on category
                if (effect.category === 'gold_boost' || effect.category === 'multi_boost') {
                    totalGoldMultiplier *= effect.multiplier || 1.0;
                    activeEffectNames.push(self.getEffectDisplayName(effect.effect_type));
                }
                if (effect.category === 'luck_boost' || effect.category === 'luck' || effect.category === 'multi_boost') {
                    totalLuckMultiplier *= effect.multiplier || 1.0;
                    if (!activeEffectNames.includes(self.getEffectDisplayName(effect.effect_type))) {
                        activeEffectNames.push(self.getEffectDisplayName(effect.effect_type));
                    }
                }
                
                // Decrement uses for limited-use effects
                if (effect.uses_remaining !== null && effect.uses_remaining > 0) {
                    await database.run(`UPDATE active_effects SET uses_remaining = uses_remaining - 1 WHERE id = ?`, [effect.id]);
                }
            }
            
            // Apply gold multiplier
            goldReward = Math.floor(goldReward * totalGoldMultiplier);
            
            // Store for display (keep old variable name for compatibility)
            const welcomeCharmActive = activeEffectNames.length > 0;
            
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
            if (totalGoldMultiplier > 1) {
                bonuses.push(`${totalGoldMultiplier}x ${activeEffectNames.join(', ')}`);
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

            // Update quest progress for all applicable quests using enhanced system
            let questResults = [];
            
            try {
                await questManager.autoAssignQuests(userId);
                
                // Card drawing quests
                questResults.push(
                    ...await questManager.updateEnhancedQuestProgress(userId, 'card_draws', 1, detailedCard)
                );
                
                // Type-specific quests  
                if (detailedCard.types) {
                    const cardTypes = typeof detailedCard.types === 'string' ? 
                        JSON.parse(detailedCard.types) : detailedCard.types;
                    
                    for (const type of cardTypes) {
                        const targetType = `type_${type.toLowerCase()}`;
                        questResults.push(
                            ...await questManager.updateEnhancedQuestProgress(userId, targetType, 1, detailedCard)
                        );
                    }
                }
                
                // Rarity-specific quests
                const rarity = detailedCard.rarity?.toLowerCase() || '';
                if (rarity.includes('rare') || rarity.includes('ultra') || rarity.includes('secret')) {
                    questResults.push(
                        ...await questManager.updateEnhancedQuestProgress(userId, 'rarity_rare_plus', 1, detailedCard)
                    );
                }
                if (rarity.includes('holo')) {
                    questResults.push(
                        ...await questManager.updateEnhancedQuestProgress(userId, 'rarity_holo', 1, detailedCard)
                    );
                }
                if (rarity.includes('ultra')) {
                    questResults.push(
                        ...await questManager.updateEnhancedQuestProgress(userId, 'rarity_ultra', 1, detailedCard)
                    );
                }
                
                // Gold accumulation quests (add gold value from draw)
                const goldValue = rarityInfo ? rarityInfo.gold_value || 0 : 0;
                if (goldValue > 0) {
                    questResults.push(
                        ...await questManager.updateEnhancedQuestProgress(userId, 'gold_from_zam', goldValue, detailedCard)
                    );
                }
                
                // Generation-specific quests
                const cardSetId = detailedCard.set_id;
                if (cardSetId) {
                    // Gen 1 sets
                    if (['base1', 'base2', 'base3', 'gym1', 'gym2'].includes(cardSetId)) {
                        questResults.push(
                            ...await questManager.updateEnhancedQuestProgress(userId, 'generation_1', 1, detailedCard)
                        );
                    }
                    // Modern sets (example)
                    else if (['swsh9', 'swsh10', 'swsh11', 'swsh12'].includes(cardSetId)) {
                        questResults.push(
                            ...await questManager.updateEnhancedQuestProgress(userId, 'generation_modern', 1, detailedCard)
                        );
                    }
                }
                
            } catch (error) {
                console.error('Enhanced quest system error:', error.message);
                // Fall back to basic quest system if enhanced system fails
                console.log('⚠️ Falling back to basic quest progress update');
                try {
                    await questManager.updateQuestProgress(userId, 'draw_card', 1);
                } catch (fallbackError) {
                    console.error('Basic quest fallback also failed:', fallbackError.message);
                }
            }
            
            // Combine all completed quests
            const completedQuests = questResults.flat();
            
            // Send initial card draw response
            // OPTIMIZATION: Send Discord response FIRST for speed ⚡
            await interaction.editReply({ embeds: [embed] });
            
            // ASYNC PROCESSING: Run background tasks without blocking Discord response
            setImmediate(async () => {
                try {
                    // Initialize smart notification system
                    const SmartNotificationManager = require('../utils/SmartNotificationManager');
                    const notificationManager = new SmartNotificationManager();
                    
                    // Send enhanced rare card notifications (for Holo Rare+)
                    await notificationManager.sendRareCardNotification(
                        interaction, detailedCard, variant, variantInfo, rarityInfo
                    );

                    // Post to Global showcase channel for rare cards (Holo Rare or above)
                    await this.checkAndPostToGlobalShowcase(interaction, detailedCard, variant, variantInfo, rarityInfo);

                    // Check for achievements (now runs async after Discord response!)
                    await this.checkCardDrawAchievements(userId, drawnCard, updatedUser, { database, userManager, cardManager, questManager });
                } catch (asyncError) {
                    console.error('Background processing error:', asyncError);
                }
            });

            // Update set completion progress and check for new completions
            await this.checkSetCompletion(userId, detailedCard, interaction);

            // Notify about completed quests (simplified)
            if (completedQuests.length > 0) {
                // Get user's daily quests to find the correct quest positions
                const dailyQuests = await questManager.getUserQuests(userId);
                const dailyQuestList = dailyQuests.filter(q => q.quest_type === 'daily');
                
                let completionText = '';
                
                completedQuests.forEach((q, index) => {
                    // Find the actual position of this quest in the daily quest list
                    const questPosition = dailyQuestList.findIndex(dailyQuest => dailyQuest.name === q.name) + 1;
                    const displayPosition = questPosition > 0 ? questPosition : index + 1;
                    
                    completionText += `✅ Quest ${displayPosition} completed!\n`;
                });

                const questEmbed = new EmbedBuilder()
                    .setDescription(completionText.trim())
                    .setColor('#00ff00')
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
    },

    async checkAndPostToGlobalShowcase(interaction, detailedCard, variant, variantInfo, rarityInfo) {
        try {
            // Global showcase channel ID
            const GLOBAL_SHOWCASE_CHANNEL_ID = '1434216182017167480';
            
            // Check if this card qualifies for global showcase (ONLY Holo rarity cards or higher)
            const rarity = detailedCard.rarity.toLowerCase();
            const isShowcaseWorthy = rarity.includes('holo') || 
                                   rarity.includes('ultra') || 
                                   rarity.includes('secret') ||
                                   rarity.includes('legendary');
            
            if (!isShowcaseWorthy) {
                return; // Not rare enough for showcase - must be actual holo rarity or higher
            }

            // Get the global showcase channel
            const showcaseChannel = await interaction.client.channels.fetch(GLOBAL_SHOWCASE_CHANNEL_ID).catch(() => null);
            if (!showcaseChannel) {
                console.log('Global showcase channel not found or not accessible');
                return;
            }

            // Create a special showcase embed (more compact than the main one)
            const isSpecialVariant = variant !== 'normal';
            const showcaseEmbed = new EmbedBuilder()
                .setTitle(`${isSpecialVariant ? variantInfo.emoji : rarityInfo.emoji} ${detailedCard.rarity} Pulled!`)
                .setColor(isSpecialVariant ? variantInfo.color : rarityInfo.color)
                .setTimestamp();

            // Add card image if available
            const imageUrl = detailedCard.image_large || detailedCard.image_small;
            if (imageUrl) {
                showcaseEmbed.setThumbnail(imageUrl);
            }

            // Compact YAML-style description for showcase
            let showcaseDescription = '```yaml\n';
            showcaseDescription += '#══════════════════════════════════════\n';
            showcaseDescription += `# 🎯 RARE CARD SHOWCASE\n`;
            showcaseDescription += '#══════════════════════════════════════\n\n';
            showcaseDescription += `Card Name          : "${detailedCard.name}"\n`;
            showcaseDescription += `Set                : "${detailedCard.set_name || 'Unknown'}"\n`;
            showcaseDescription += `Rarity             : "${detailedCard.rarity}"\n`;
            
            if (isSpecialVariant) {
                showcaseDescription += `Variant            : "${variantInfo.displayName}" ${variantInfo.emoji}\n`;
            }
            
            showcaseDescription += `Pulled By          : "${interaction.user.username}"\n`;
            showcaseDescription += `Server             : "${interaction.guild?.name || 'Unknown Server'}"\n`;
            
            // Add rarity status
            if (rarity.includes('secret')) {
                showcaseDescription += `Status             : "🌟 LEGENDARY PULL! 🌟"\n`;
            } else if (rarity.includes('ultra')) {
                showcaseDescription += `Status             : "💎 ULTRA RARE FIND! 💎"\n`;
            } else if (rarity.includes('holo')) {
                showcaseDescription += `Status             : "✨ HOLO SHINE! ✨"\n`;
            } else if (isSpecialVariant) {
                showcaseDescription += `Status             : "${variantInfo.emoji} SPECIAL VARIANT! ${variantInfo.emoji}"\n`;
            }
            
            showcaseDescription += '\n#══════════════════════════════════════\n';
            showcaseDescription += '```';

            showcaseEmbed.setDescription(showcaseDescription);
            
            // Set footer with trainer info
            showcaseEmbed.setFooter({
                text: `Congratulations ${interaction.user.username}! • Pokézam Global Showcase`,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true })
            });

            // Send to global showcase channel
            await showcaseChannel.send({ embeds: [showcaseEmbed] });
            
            // Update showcase count for achievement tracking
            try {
                await database.run(`
                    UPDATE users SET showcase_count = COALESCE(showcase_count, 0) + 1 WHERE id = ?
                `, [interaction.user.id]);
            } catch (error) {
                console.error('Error updating showcase count:', error);
            }
            
            console.log(`✨ Showcased ${detailedCard.rarity} "${detailedCard.name}" pulled by ${interaction.user.username} in Global channel`);
            
        } catch (error) {
            console.log('Error posting to global showcase:', error);
            // Don't throw error - just log it so it doesn't break the main command
        }
    },

    async checkCardDrawAchievements(userId, drawnCard, userData, managers) {
        try {
            // Only check if AchievementManager is available
            const AchievementManager = require('../database/AchievementManager');
            const achievementManager = new AchievementManager(managers.database);
            
            // Check various achievement conditions
            const achievements = [];
            
            // Total draws achievement
            achievements.push(...await achievementManager.checkAndUpdateAchievement(userId, 'total_draws', userData.total_draws));
            
            // Level achievements  
            achievements.push(...await achievementManager.checkAndUpdateAchievement(userId, 'level', userData.level));
            
            // Gold achievements
            achievements.push(...await achievementManager.checkAndUpdateAchievement(userId, 'gold', userData.gold));
            
            // Rarity-based achievements
            const rarity = drawnCard.rarity.toLowerCase();
            if (rarity.includes('rare')) {
                // Get current rare card count
                const rareCount = await managers.database.get(`
                    SELECT COUNT(DISTINCT uc.card_id) as count FROM user_cards uc
                    JOIN cards c ON uc.card_id = c.id 
                    WHERE uc.user_id = ? AND (c.rarity LIKE '%rare%' OR c.rarity LIKE '%ultra%' OR c.rarity LIKE '%secret%')
                `, [userId]);
                
                achievements.push(...await achievementManager.checkAndUpdateAchievement(userId, 'rare_cards', rareCount?.count || 0));
            }
            
            if (rarity.includes('holo')) {
                const holoCount = await managers.database.get(`
                    SELECT COUNT(DISTINCT uc.card_id) as count FROM user_cards uc
                    JOIN cards c ON uc.card_id = c.id 
                    WHERE uc.user_id = ? AND c.rarity LIKE '%holo%'
                `, [userId]);
                
                achievements.push(...await achievementManager.checkAndUpdateAchievement(userId, 'holo_cards', holoCount?.count || 0));
            }
            
            if (rarity.includes('ultra')) {
                const ultraCount = await managers.database.get(`
                    SELECT COUNT(DISTINCT card_id) as count FROM user_cards uc
                    JOIN cards c ON uc.card_id = c.id 
                    WHERE uc.user_id = ? AND c.rarity LIKE '%ultra%'
                `, [userId]);
                
                achievements.push(...await achievementManager.checkAndUpdateAchievement(userId, 'ultra_cards', ultraCount?.count || 0));
            }
            
            if (rarity.includes('secret')) {
                const secretCount = await managers.database.get(`
                    SELECT COUNT(DISTINCT card_id) as count FROM user_cards uc
                    JOIN cards c ON uc.card_id = c.id 
                    WHERE uc.user_id = ? AND c.rarity LIKE '%secret%'
                `, [userId]);
                
                achievements.push(...await achievementManager.checkAndUpdateAchievement(userId, 'secret_cards', secretCount?.count || 0));
            }
            
            // If any achievements were earned, we could notify here
            // For now, just log them
            if (achievements.length > 0) {
                console.log(`🏆 ${achievements.length} achievement(s) earned by user ${userId}`);
            }
            
        } catch (error) {
            // Don't break the main command if achievements fail
            console.error('Error checking achievements:', error);
        }
    },

    // Check for set completion and award rewards
    async checkSetCompletion(userId, card, interaction) {
        try {
            const setCompletionManager = interaction.client.setCompletionManager;
            if (!setCompletionManager) return;

            // Update set completion for the card's set
            const completion = await setCompletionManager.updateSingleSetCompletion(userId, card.set_id, card.set_name);
            
            if (completion && completion.isCompleted) {
                // Check if this is a new completion (check if reward was just awarded)
                const setRecord = await interaction.client.database.get(`
                    SELECT * FROM set_completion 
                    WHERE user_id = ? AND set_id = ? AND is_completed = TRUE AND reward_claimed = TRUE
                `, [userId, card.set_id]);

                if (setRecord) {
                    // Get the reward that was given
                    const reward = await setCompletionManager.checkAndAwardSetReward(userId, card.set_id, card.set_name);
                    
                    if (reward) {
                        // Send set completion notification
                        const completionEmbed = new EmbedBuilder()
                            .setColor('#ffd700')
                            .setTitle('🎉 SET COMPLETED!')
                            .setDescription(`**Congratulations!** You have completed the **${card.set_name}** set!`)
                            .addFields({
                                name: '🎁 **Reward Earned**',
                                value: reward.description || `${reward.value} ${reward.type}`,
                                inline: false
                            })
                            .setFooter({ text: 'Use /sets progress to view all your set completion progress' })
                            .setTimestamp();

                        // Send completion notification after a short delay
                        setTimeout(async () => {
                            try {
                                await interaction.followUp({ embeds: [completionEmbed] });
                            } catch (error) {
                                console.error('Error sending set completion notification:', error);
                            }
                        }, 2000);
                    }
                }
            }

        } catch (error) {
            // Don't break the main command if set completion fails
            console.error('Error checking set completion:', error);
        }
    },

    // Helper method to get display names for effects
    getEffectDisplayName(effectType) {
        const displayNames = {
            'daily_charm': 'Daily Charm',
            'welcome_charm': 'Welcome Charm', 
            'amulet_coin': 'Amulet Coin',
            'golden_horseshoe': 'Golden Horseshoe',
            'fortune_charm': 'Fortune Charm',
            'lucky_coin': 'Lucky Coin',
            'collectors_charm': "Collector's Charm",
            'shiny_charm': 'Shiny Charm',
            'rainbow_feather': 'Rainbow Feather',
            'sacred_orb': 'Sacred Orb',
            'divine_blessing': 'Divine Blessing'
        };
        return displayNames[effectType] || effectType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
};