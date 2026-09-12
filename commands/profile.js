const { SlashCommandBuilder } = require('discord.js');
const EmbedUtils = require('../utils/EmbedUtils');

function getTrainerTier(level) {
    if (level >= 200) return 'Legendary Elite';
    if (level >= 150) return 'Master Collector';
    if (level >= 100) return 'Elite Trainer';
    if (level >= 60) return 'Rising Pro';
    if (level >= 25) return 'Ambitious Trainer';
    return 'New Recruit';
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('View your profile and collection statistics')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('View another user\'s profile')
                .setRequired(false)
        ),

    async execute(interaction, { database, userManager }) {
        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const userId = targetUser.id;

            await interaction.deferReply();

            const [user, collectionStats, unlockedGenerations] = await Promise.all([
                userManager.getUser(userId),
                userManager.getCollectionStats(userId),
                userManager.getUnlockedGenerations(userId)
            ]);

            if (!user) {
                if (targetUser.id === interaction.user.id) {
                    const newUser = await userManager.createUser(userId, targetUser.username);
                    const [newCollectionStats, newUnlockedGenerations] = await Promise.all([
                        userManager.getCollectionStats(userId),
                        userManager.getUnlockedGenerations(userId)
                    ]);

                    const xpInfo = userManager.getXPForNextLevel(newUser.xp, newUser.level);
                    const progressBar = EmbedUtils.createProgressBar(xpInfo.current, xpInfo.required);
                    const trainerTier = getTrainerTier(newUser.level);
                    const embed = EmbedUtils.createBaseEmbed({
                        title: `🏆 ${targetUser.username} • Trainer Profile`,
                        description: `${targetUser.username} just entered the arena as a **${trainerTier}**.`,
                        color: EmbedUtils.palette.warning,
                        thumbnail: EmbedUtils.resolveAvatarURL(targetUser),
                        footerText: 'Fresh trainer account • Build your collection and climb the ranks.',
                        footerIcon: EmbedUtils.resolveAvatarURL(interaction.user),
                        fields: [
                            { name: '🎖️ Rank', value: trainerTier, inline: true },
                            { name: '📈 Level', value: `${newUser.level}`, inline: true },
                            { name: '💰 Gold', value: `${newUser.gold.toLocaleString()} 🪙`, inline: true },
                            { name: '🎴 Unique Cards', value: `${newCollectionStats.unique_cards.toLocaleString()}`, inline: true },
                            { name: '👟 Total Draws', value: `${newUser.total_draws.toLocaleString()}`, inline: true },
                            { name: 'XP Progress', value: progressBar, inline: false },
                            { name: '🧭 Generations', value: newUnlockedGenerations.length ? newUnlockedGenerations.map(g => g.name).join(', ') : 'None yet', inline: false }
                        ]
                    });

                    return await interaction.editReply({ embeds: [embed] });
                }

                return await interaction.editReply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        'Profile Not Found',
                        `${targetUser.username} hasn’t started their collection yet.`
                    )]
                });
            }

            const xpInfo = userManager.getXPForNextLevel(user.xp, user.level);
            const progressBar = EmbedUtils.createProgressBar(xpInfo.current, xpInfo.required);
            const trainerTier = getTrainerTier(user.level);
            const generationLevels = {
                'Generation I': 1,
                'Generation II': 10,
                'Generation II (e-Card)': 20,
                'Generation III': 35,
                'Generation IV (D&P)': 60,
                'Generation IV (Platinum)': 80,
                'Generation IV (HGSS)': 90,
                'Generation V': 110,
                'Generation VI': 130,
                'Generation VII': 150,
                'Generation VIII': 170,
                'Generation IX': 200
            };

            const allGenerations = [
                { name: 'Generation I', requiredLevel: 1 },
                { name: 'Generation II', requiredLevel: 10 },
                { name: 'Generation II (e-Card)', requiredLevel: 20 },
                { name: 'Generation III', requiredLevel: 35 },
                { name: 'Generation IV (D&P)', requiredLevel: 60 },
                { name: 'Generation IV (Platinum)', requiredLevel: 80 },
                { name: 'Generation IV (HGSS)', requiredLevel: 90 },
                { name: 'Generation V', requiredLevel: 110 },
                { name: 'Generation VI', requiredLevel: 130 },
                { name: 'Generation VII', requiredLevel: 150 },
                { name: 'Generation VIII', requiredLevel: 170 },
                { name: 'Generation IX', requiredLevel: 200 }
            ];

            const nextGeneration = allGenerations.find(gen => gen.requiredLevel > user.level);
            const unlockedSummary = unlockedGenerations.length > 0
                ? unlockedGenerations.map(gen => `${gen.name} (${generationLevels[gen.name] || '?'}+)`).join(', ')
                : 'None yet';

            const embed = EmbedUtils.createBaseEmbed({
                title: `🏆 ${targetUser.username} • Trainer Profile`,
                description: `${targetUser.username} is a **${trainerTier}** with a collection built for long-term dominance.`,
                color: user.level >= 150 ? EmbedUtils.palette.brand : EmbedUtils.palette.warning,
                thumbnail: EmbedUtils.resolveAvatarURL(targetUser),
                footerText: `${user.total_draws.toLocaleString()} total draws • ${interaction.user.username} viewed this trainer`,
                footerIcon: EmbedUtils.resolveAvatarURL(interaction.user),
                fields: [
                    { name: '🎖️ Rank', value: trainerTier, inline: true },
                    { name: '📈 Level', value: `${user.level}`, inline: true },
                    { name: '💰 Gold', value: `${user.gold.toLocaleString()} 🪙`, inline: true },
                    { name: '🎴 Unique Cards', value: `${collectionStats.unique_cards.toLocaleString()}`, inline: true },
                    { name: '👟 Total Draws', value: `${user.total_draws.toLocaleString()}`, inline: true },
                    { name: 'XP Progress', value: progressBar, inline: false },
                    { name: '🧭 Generations', value: unlockedSummary, inline: false },
                    { name: '🚀 Next Goal', value: nextGeneration ? `${nextGeneration.name} • ${nextGeneration.requiredLevel - user.level} levels away` : 'All generation unlocks complete!', inline: false }
                ]
            });

            if (user.guild_id) {
                const guild = await database.get('SELECT name FROM guilds WHERE id = ?', [user.guild_id]);
                if (guild) {
                    embed.addFields({ name: '🏛️ Guild', value: guild.name, inline: true });
                }
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in profile command:', error);

            if (error.code === 10062) {
                console.log('⚠️ Profile command timed out - interaction expired');
                return;
            }

            try {
                const errorResponse = {
                    embeds: [EmbedUtils.createErrorEmbed(
                        'Profile Error',
                        'An error occurred while loading the profile. Please try again!'
                    )]
                };

                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply(errorResponse);
                } else {
                    await interaction.reply({ ...errorResponse, flags: 64 });
                }
            } catch (replyError) {
                console.log('⚠️ Could not reply to interaction:', replyError.message);
            }
        }
    }
};