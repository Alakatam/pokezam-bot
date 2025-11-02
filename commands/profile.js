const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EmbedUtils = require('../utils/EmbedUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('View your profile and collection statistics')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('View another user\'s profile')
                .setRequired(false)
        ),
    
    async execute(interaction, { database, userManager, cardManager, questManager }) {
        try {
            await interaction.deferReply();
            
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const userId = targetUser.id;
            
            let user = await userManager.getUser(userId);
            
            if (!user) {
                if (targetUser.id === interaction.user.id) {
                    // Create profile for the user
                    user = await userManager.createUser(userId, targetUser.username);
                } else {
                    return await interaction.editReply({
                        embeds: [EmbedUtils.createErrorEmbed(
                            'Profile Not Found',
                            `${targetUser.username} hasn't started their collection yet!`
                        )]
                    });
                }
            }

            // Get collection statistics
            const collectionStats = await userManager.getCollectionStats(userId);
            const unlockedGenerations = await userManager.getUnlockedGenerations(userId);

            // Create vertical profile embed
            const xpInfo = userManager.getXPForNextLevel(user.xp, user.level);
            const progressBar = EmbedUtils.createProgressBar(xpInfo.current, xpInfo.required);
            
            // Generation mapping for display
            const generationLevels = {
                'Generation I': 1, 'Generation II': 10, 'Generation II (e-Card)': 20, 'Generation III': 35,
                'Generation IV (D&P)': 60, 'Generation IV (Platinum)': 80, 'Generation IV (HGSS)': 90,
                'Generation V': 110, 'Generation VI': 130, 'Generation VII': 150,
                'Generation VIII': 170, 'Generation IX': 200
            };
            
            // Build ultra-clean YAML-style description
            let description = '```yaml\n';
            description += `#═══════════════════════════════════════════════════\n`;
            description += `# 🎮 ${targetUser.username.toUpperCase()}'S TRAINER PROFILE\n`;
            description += `#═══════════════════════════════════════════════════\n\n`;
            
            // Trainer section with clean alignment
            description += `🔥 TRAINER:\n`;
            description += `   level          : ${user.level}\n`;
            description += `   experience     : ${xpInfo.current.toLocaleString()} / ${xpInfo.required.toLocaleString()} XP\n`;
            description += `   progress       : ${progressBar}\n`;
            description += `   currency       : ${user.gold.toLocaleString()} 🪙 Gold\n\n`;
            
            // Collection stats with better formatting
            description += `📚 COLLECTION:\n`;
            description += `   total draws    : ${user.total_draws.toLocaleString()}\n`;
            description += `   unique cards   : ${collectionStats.unique_cards.toLocaleString()}\n`;
            description += `   star cards     : ${(collectionStats.star_cards || 0).toLocaleString()}\n\n`;
            
            // Unlocked generations with cleaner format
            description += `🌟 UNLOCKED GENERATIONS:\n`;
            if (unlockedGenerations.length > 0) {
                unlockedGenerations.forEach((gen, index) => {
                    const level = generationLevels[gen.name] || '?';
                    const icon = index === unlockedGenerations.length - 1 ? '🔓' : '✅';
                    description += `   ${icon} ${gen.name.padEnd(25)} : Level ${level}+\n`;
                });
            } else {
                description += `   ❌ none                         : Start drawing cards!\n`;
            }
            
            // Next unlock with countdown
            const allGenerations = [
                { name: 'Generation I', requiredLevel: 1 }, { name: 'Generation II', requiredLevel: 10 },
                { name: 'Generation II (e-Card)', requiredLevel: 20 }, { name: 'Generation III', requiredLevel: 35 },
                { name: 'Generation IV (D&P)', requiredLevel: 60 }, { name: 'Generation IV (Platinum)', requiredLevel: 80 },
                { name: 'Generation IV (HGSS)', requiredLevel: 90 }, { name: 'Generation V', requiredLevel: 110 },
                { name: 'Generation VI', requiredLevel: 130 }, { name: 'Generation VII', requiredLevel: 150 },
                { name: 'Generation VIII', requiredLevel: 170 }, { name: 'Generation IX', requiredLevel: 200 }
            ];
            
            const nextGeneration = allGenerations.find(gen => gen.requiredLevel > user.level);
            if (nextGeneration) {
                const levelsRemaining = nextGeneration.requiredLevel - user.level;
                description += `\n🎯 NEXT UNLOCK:\n`;
                description += `   🔒 ${nextGeneration.name.padEnd(25)} : ${levelsRemaining} levels to go!\n`;
                description += `   📊 Target Level               : ${nextGeneration.requiredLevel}\n`;
            } else {
                description += `\n🏆 STATUS:\n`;
                description += `   🎊 ALL GENERATIONS UNLOCKED!  : Maximum Level Reached\n`;
            }
            
            description += `\n#═══════════════════════════════════════════════════\n`;
            description += '```';
            
            const embed = new EmbedBuilder()
                .setTitle(`🎮 Trainer Profile`)
                .setDescription(description)
                .setColor('#ffd700')
                .setTimestamp()
                .setFooter({ 
                    text: `Profile viewed by ${interaction.user.username}`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                });

            // Add guild info to YAML if user is in a guild
            if (user.guild_id) {
                const guild = await database.get(
                    'SELECT name FROM guilds WHERE id = ?',
                    [user.guild_id]
                );
                
                if (guild) {
                    // Add guild info to the description before closing the YAML block
                    let newDescription = description.replace('```', '');
                    newDescription += `\nguild:\n`;
                    newDescription += `  name: "${guild.name}"\n`;
                    newDescription += `  member since: "Active"\n`;
                    newDescription += '```';
                    embed.setDescription(newDescription);
                }
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in profile command:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        'Profile Error',
                        'An error occurred while loading the profile. Please try again!'
                    )],
                    flags: 64
                });
            } else {
                await interaction.editReply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        'Profile Error',
                        'An error occurred while loading the profile. Please try again!'
                    )]
                });
            }
        }
    }
};