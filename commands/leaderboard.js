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
                    embeds: [{
                        title: `${emoji} ${title}`,
                        description: '```yaml\n' +
                            '#═══════════════════════════════════════════════════\n' +
                            '# 🏆 LEADERBOARD - NO DATA\n' +
                            '#═══════════════════════════════════════════════════\n\n' +
                            'status             : No trainers found\n' +
                            'suggestion         : Use /start to begin your journey!\n' +
                            '```',
                        color: 0xffd700,
                        timestamp: new Date().toISOString()
                    }]
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

            // Build YAML leaderboard
            let yamlContent = '```yaml\n';
            yamlContent += '#═══════════════════════════════════════════════════\n';
            yamlContent += `# ${emoji} ${title.toUpperCase()}\n`;
            yamlContent += '#═══════════════════════════════════════════════════\n\n';

            leaderboardData.forEach((user, index) => {
                const rank = index + 1;
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
                const isCurrentUser = user.id === interaction.user.id;
                const indicator = isCurrentUser ? ' ← YOU' : '';

                yamlContent += `${medal} rank ${rank}:\n`;
                yamlContent += `   trainer            : "${user.username}"${indicator}\n`;
                yamlContent += `   level              : ${user.level}\n`;

                switch (type) {
                    case 'level':
                        yamlContent += `   total xp           : ${user.xp.toLocaleString()}\n`;
                        break;
                    case 'xp':
                        yamlContent += `   total xp           : ${user.xp.toLocaleString()}\n`;
                        break;
                    case 'gold':
                        yamlContent += `   gold balance       : ${user.gold.toLocaleString()} 🪙\n`;
                        break;
                    case 'collection':
                        yamlContent += `   unique cards       : ${user.card_count.toLocaleString()}\n`;
                        break;
                }

                if (index < leaderboardData.length - 1) {
                    yamlContent += '\n# ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n\n';
                }
            });

            // Add user's rank if not in top 10
            if (userRank && userRank > limit && userStats) {
                yamlContent += '\n\n#───────────────────────────────────────────────────\n';
                yamlContent += '# YOUR RANK\n';
                yamlContent += '#───────────────────────────────────────────────────\n\n';
                yamlContent += `rank ${userRank}:\n`;
                yamlContent += `   trainer            : "${interaction.user.username}"\n`;
                
                if (type === 'collection') {
                    yamlContent += `   unique cards       : ${userStats.card_count.toLocaleString()}\n`;
                } else {
                    yamlContent += `   level              : ${userStats.level}\n`;
                    if (type === 'level' || type === 'xp') {
                        yamlContent += `   total xp           : ${userStats.xp.toLocaleString()}\n`;
                    } else if (type === 'gold') {
                        yamlContent += `   gold balance       : ${userStats.gold.toLocaleString()} 🪙\n`;
                    }
                }
            }

            yamlContent += '\n#═══════════════════════════════════════════════════\n';
            yamlContent += '```';

            const embed = new EmbedBuilder()
                .setTitle(`${emoji} ${title}`)
                .setDescription(yamlContent)
                .setColor(0xffd700)
                .setTimestamp()
                .setFooter({
                    text: userRank ? `Your rank: #${userRank}` : 'Use /start to join the leaderboard!',
                    iconURL: interaction.user.displayAvatarURL()
                });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in leaderboard command:', error);
            
            if (interaction.deferred && !interaction.replied) {
                await interaction.editReply({
                    embeds: [{
                        title: '❌ Leaderboard Error',
                        description: '```yaml\n' +
                            '#═══════════════════════════════════════════════════\n' +
                            '# ❌ ERROR LOADING LEADERBOARD\n' +
                            '#═══════════════════════════════════════════════════\n\n' +
                            `error              : ${error.message}\n` +
                            'suggestion         : Try again in a moment\n' +
                            '```',
                        color: 0xff0000,
                        timestamp: new Date().toISOString()
                    }]
                });
            }
        }
    }
};
