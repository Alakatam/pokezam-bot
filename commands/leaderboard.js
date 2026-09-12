const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View top trainers by level, XP, gold, or collection')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Leaderboard type to view')
                .setRequired(false)
                .addChoices(
                    { name: '🏆 Level', value: 'level' },
                    { name: '✨ Total XP', value: 'xp' },
                    { name: '🪙 Gold', value: 'gold' },
                    { name: '📊 Collection Size', value: 'collection' }
                )),

    async execute(interaction, { database, userManager }) {
        try {
            await interaction.deferReply();

            const type = interaction.options.getString('type') || 'level';
            const limit = 10;

            let leaderboardData = [];
            let title = '';
            let emoji = '';
            let sortField = '';

            switch (type) {
                case 'level':
                    title = 'Top Trainers by Level';
                    emoji = '🏆';
                    sortField = 'level';
                    leaderboardData = await database.all(`
                        SELECT id, username, level, xp
                        FROM users
                        WHERE has_started = TRUE
                        ORDER BY level DESC, xp DESC
                        LIMIT ?
                    `, [limit]);
                    break;

                case 'xp':
                    title = 'Top Trainers by Total XP';
                    emoji = '✨';
                    sortField = 'xp';
                    leaderboardData = await database.all(`
                        SELECT id, username, level, xp
                        FROM users
                        WHERE has_started = TRUE
                        ORDER BY xp DESC
                        LIMIT ?
                    `, [limit]);
                    break;

                case 'gold':
                    title = 'Richest Trainers';
                    emoji = '🪙';
                    sortField = 'gold';
                    leaderboardData = await database.all(`
                        SELECT id, username, gold, level
                        FROM users
                        WHERE has_started = TRUE
                        ORDER BY gold DESC
                        LIMIT ?
                    `, [limit]);
                    break;

                case 'collection':
                    title = 'Largest Collections';
                    emoji = '📊';
                    sortField = 'collection';
                    leaderboardData = await database.all(`
                        SELECT u.id, u.username, u.level, COUNT(DISTINCT uc.card_id) as card_count
                        FROM users u
                        LEFT JOIN user_cards uc ON u.id = uc.user_id
                        WHERE u.has_started = TRUE
                        GROUP BY u.id, u.username, u.level
                        ORDER BY card_count DESC
                        LIMIT ?
                    `, [limit]);
                    break;
            }

            if (!leaderboardData || leaderboardData.length === 0) {
                return await interaction.editReply({
                    embeds: [EmbedUtils.createInfoEmbed(
                        `${emoji} ${title}`,
                        'No trainers found on the leaderboard yet! Use **/start** to begin your journey and climb the ranks.'
                    )]
                });
            }

            // Find user's rank
            let userRank = null;
            let userStats = null;
            
            if (type === 'collection') {
                const allUsers = await database.all(`
                    SELECT u.id, COUNT(DISTINCT uc.card_id) as card_count
                    FROM users u
                    LEFT JOIN user_cards uc ON u.id = uc.user_id
                    WHERE u.has_started = TRUE
                    GROUP BY u.id
                    ORDER BY card_count DESC
                `);
                userRank = allUsers.findIndex(u => u.id === interaction.user.id) + 1;
                userStats = allUsers.find(u => u.id === interaction.user.id);
            } else {
                const allUsers = await database.all(`
                    SELECT id, username, level, xp, gold
                    FROM users
                    WHERE has_started = TRUE
                    ORDER BY ${sortField} DESC
                `);
                userRank = allUsers.findIndex(u => u.id === interaction.user.id) + 1;
                userStats = allUsers.find(u => u.id === interaction.user.id);
            }

            // Build modern clean leaderboard display
            const lines = leaderboardData.map((user, index) => {
                const rank = index + 1;
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `\`#${rank}\``;
                const isCurrentUser = user.id === interaction.user.id;
                const nameTag = isCurrentUser ? `**${user.username}** *(YOU)*` : `**${user.username}**`;

                let statDisplay = '';
                switch (type) {
                    case 'level':
                    case 'xp':
                        statDisplay = `Lvl \`${user.level}\` • \`${user.xp.toLocaleString()} XP\``;
                        break;
                    case 'gold':
                        statDisplay = `\`${user.gold.toLocaleString()}\` 🪙`;
                        break;
                    case 'collection':
                        statDisplay = `\`${user.card_count.toLocaleString()}\` Unique Cards`;
                        break;
                }

                return `${medal} ${nameTag} — ${statDisplay}`;
            });

            let description = lines.join('\n');

            if (userRank && userRank > limit && userStats) {
                let myStat = '';
                if (type === 'collection') {
                    myStat = `\`${userStats.card_count.toLocaleString()}\` Unique Cards`;
                } else if (type === 'gold') {
                    myStat = `\`${userStats.gold.toLocaleString()}\` 🪙`;
                } else {
                    myStat = `Lvl \`${userStats.level}\` • \`${userStats.xp.toLocaleString()} XP\``;
                }
                description += `\n\n───────────────────────────\n📍 **Your Rank:** \`#${userRank}\` — ${myStat}`;
            }

            const embed = EmbedUtils.createBaseEmbed({
                author: { name: 'Pokézam Hall of Fame' },
                title: `${emoji} ${title}`,
                description,
                color: EmbedUtils.palette.gold,
                footerText: userRank ? `Your Rank: #${userRank} • Pokézam Rankings` : 'Use /start to join the leaderboard!',
                footerIcon: interaction.user.displayAvatarURL({ dynamic: true })
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in leaderboard command:', error);
            
            if (interaction.deferred && !interaction.replied) {
                await interaction.editReply({
                    embeds: [EmbedUtils.createErrorEmbed(
                        'Leaderboard Error',
                        '```yaml\n' +
                            '#═══════════════════════════════════════════════════\n' +
                            '# ❌ ERROR LOADING LEADERBOARD\n' +
                            '#═══════════════════════════════════════════════════\n\n' +
                            `error              : ${error.message}\n` +
                            'suggestion         : Try again in a moment\n' +
                            '```'
                    )]
                });
            }
        }
    }
};
