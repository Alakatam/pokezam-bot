const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sets')
        .setDescription('View Pokemon TCG set completion progress and rewards')
        .addSubcommand(subcommand =>
            subcommand
                .setName('progress')
                .setDescription('View your set completion progress')
                .addStringOption(option =>
                    option
                        .setName('filter')
                        .setDescription('Filter sets by completion status')
                        .addChoices(
                            { name: '📊 All Sets', value: 'all' },
                            { name: '✅ Completed Only', value: 'completed' },
                            { name: '⏳ In Progress', value: 'incomplete' }
                        ))
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('View another user\'s set completion (optional)')))
        .addSubcommand(subcommand =>
            subcommand
                .setName('leaderboard')
                .setDescription('View set completion leaderboard')
                .addStringOption(option =>
                    option
                        .setName('set')
                        .setDescription('Specific set to view leaderboard for (optional)')
                        .setAutocomplete(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('rewards')
                .setDescription('View available set completion rewards'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('titles')
                .setDescription('View and manage your earned titles')
                .addStringOption(option =>
                    option
                        .setName('action')
                        .setDescription('Action to perform')
                        .addChoices(
                            { name: '👀 View Titles', value: 'view' },
                            { name: '⭐ Set Active Title', value: 'set' }
                        ))
                .addStringOption(option =>
                    option
                        .setName('title')
                        .setDescription('Title to set as active (for set action)'))),

    async execute(interaction, { database, userManager, cardManager, questManager }) {
        const subcommand = interaction.options.getSubcommand();

        // Initialize managers
        const SetCompletionManager = require('../database/SetCompletionManager');
        const setManager = new SetCompletionManager(database);

        try {
            switch (subcommand) {
                case 'progress':
                    await handleProgressCommand(interaction, setManager, userManager);
                    break;
                case 'leaderboard':
                    await handleLeaderboardCommand(interaction, setManager);
                    break;
                case 'rewards':
                    await handleRewardsCommand(interaction, setManager);
                    break;
                case 'titles':
                    await handleTitlesCommand(interaction, setManager, userManager);
                    break;
            }
        } catch (error) {
            console.error('Set command error:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('❌ Command Error')
                .setDescription('An error occurred while processing your request. Please try again later.')
                .setTimestamp();

            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    },

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        
        if (interaction.options.getSubcommand() === 'leaderboard') {
            // Get popular sets for autocomplete
            const sets = [
                { name: 'Base Set', value: 'base1' },
                { name: 'Jungle', value: 'base2' },
                { name: 'Fossil', value: 'base3' },
                { name: 'Team Rocket', value: 'base5' },
                { name: 'Sword & Shield', value: 'swsh1' },
                { name: 'Brilliant Stars', value: 'swsh9' },
                { name: 'Astral Radiance', value: 'swsh10' },
                { name: 'XY', value: 'xy1' },
                { name: 'Sun & Moon', value: 'sm1' }
            ];

            const filtered = sets.filter(set => 
                set.name.toLowerCase().includes(focusedValue.toLowerCase())
            ).slice(0, 25);

            await interaction.respond(
                filtered.map(set => ({ name: set.name, value: set.value }))
            );
        }
    }
};

async function handleProgressCommand(interaction, setManager, userManager) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('user') || interaction.user;
    const filter = interaction.options.getString('filter') || 'all';
    
    // Check if user exists and has started
    const user = await userManager.getUser(targetUser.id);
    if (!user || !user.has_started) {
        const embed = new EmbedBuilder()
            .setColor('#ffd93d')
            .setTitle('🎴 Set Completion Progress')
            .setDescription(`${targetUser.id === interaction.user.id ? 'You haven\'t' : `${targetUser.username} hasn't`} started collecting cards yet!\\n\\nUse \`/start\` to begin your Pokemon TCG journey.`)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }

    // Update user's set completion before showing progress
    await setManager.updateSetCompletion(targetUser.id);

    // Get completion progress based on filter
    let showCompleted = null;
    if (filter === 'completed') showCompleted = true;
    if (filter === 'incomplete') showCompleted = false;

    const completions = await setManager.getUserSetCompletion(targetUser.id, 15, showCompleted);
    const stats = await setManager.getUserCompletionStats(targetUser.id);

    if (!completions || completions.length === 0) {
        const embed = new EmbedBuilder()
            .setColor('#ff9ff3')
            .setTitle('📊 Set Completion Progress')
            .setDescription(`${targetUser.id === interaction.user.id ? 'You haven\'t' : `${targetUser.username} hasn't`} made progress on any Pokemon TCG sets yet.\\n\\nTry using \`/zam\` to collect some cards first!`)
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }

    // Create progress embed
    const embed = new EmbedBuilder()
        .setColor('#4CAF50')
        .setTitle(`📊 ${targetUser.username}'s Set Completion Progress`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }));

    // Add overview stats
    if (stats) {
        embed.addFields({
            name: '📈 **Overview Statistics**',
            value: [
                `🎯 **Completed Sets:** ${stats.completed_sets}/${stats.total_sets_tracked}`,
                `📊 **Average Completion:** ${stats.average_completion}%`,
                `🏆 **Best Progress:** ${stats.highest_completion}%`,
                `👑 **Titles Earned:** ${stats.totalTitles}`
            ].join('\\n'),
            inline: false
        });
    }

    // Add individual set progress
    const progressText = completions.slice(0, 12).map(completion => {
        const progressBar = createProgressBar(completion.completion_percentage);
        const completionIcon = completion.is_completed ? '✅' : '⏳';
        const rewardInfo = completion.reward_description ? ` 🎁 ${completion.reward_description}` : '';
        
        return `${completionIcon} **${completion.set_name}**\\n${progressBar} ${completion.owned_cards}/${completion.total_cards} (${completion.completion_percentage.toFixed(1)}%)${rewardInfo}`;
    }).join('\\n\\n');

    embed.addFields({
        name: `🎴 **Set Progress** (${filter === 'all' ? 'All Sets' : filter === 'completed' ? 'Completed' : 'In Progress'})`,
        value: progressText || 'No sets found with current filter.',
        inline: false
    });

    // Add footer with navigation info
    if (completions.length > 12) {
        embed.setFooter({ text: `Showing 12 of ${completions.length} sets. Use different filters to explore more!` });
    }

    embed.setTimestamp();

    // Create filter buttons
    const filterRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`sets_progress_all_${targetUser.id}`)
                .setLabel('📊 All Sets')
                .setStyle(filter === 'all' ? ButtonStyle.Primary : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`sets_progress_completed_${targetUser.id}`)
                .setLabel('✅ Completed')
                .setStyle(filter === 'completed' ? ButtonStyle.Primary : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`sets_progress_incomplete_${targetUser.id}`)
                .setLabel('⏳ In Progress')
                .setStyle(filter === 'incomplete' ? ButtonStyle.Primary : ButtonStyle.Secondary)
        );

    await interaction.editReply({ embeds: [embed], components: [filterRow] });
}

async function handleLeaderboardCommand(interaction, setManager) {
    await interaction.deferReply();

    const setId = interaction.options.getString('set');
    const leaderboard = await setManager.getSetCompletionLeaderboard(setId, 15);

    if (!leaderboard || leaderboard.length === 0) {
        const embed = new EmbedBuilder()
            .setColor('#ffd93d')
            .setTitle('🏆 Set Completion Leaderboard')
            .setDescription('No completion data found yet. Players need to collect cards to appear on the leaderboard!')
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }

    const embed = new EmbedBuilder()
        .setColor('#ffd700')
        .setTitle(`🏆 Set Completion Leaderboard${setId ? ` - ${leaderboard[0].set_name}` : ''}`)
        .setDescription(setId ? `Top collectors for **${leaderboard[0].set_name}**` : 'Top collectors across all Pokemon TCG sets');

    const leaderboardText = leaderboard.map((entry, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;
        const completionStatus = entry.is_completed ? '✅' : '⏳';
        const setInfo = setId ? '' : ` - ${entry.set_name}`;
        
        return `${medal} **${entry.username}** ${completionStatus}\\n📊 ${entry.completion_percentage.toFixed(1)}% completion${setInfo}`;
    }).join('\\n\\n');

    embed.addFields({
        name: '🎯 **Top Collectors**',
        value: leaderboardText,
        inline: false
    });

    embed.setTimestamp();
    embed.setFooter({ text: 'Complete sets to earn rewards and climb the leaderboard!' });

    await interaction.editReply({ embeds: [embed] });
}

async function handleRewardsCommand(interaction, setManager) {
    await interaction.deferReply();

    // Get available rewards from database
    const rewards = await setManager.database.all(`
        SELECT sr.*, sc.username as completed_by
        FROM set_rewards sr
        LEFT JOIN (
            SELECT DISTINCT set_id, u.username
            FROM set_completion sc2
            JOIN users u ON sc2.user_id = u.id
            WHERE sc2.is_completed = TRUE
            LIMIT 1
        ) sc ON sr.set_id = sc.set_id
        WHERE sr.is_active = TRUE
        ORDER BY sr.bonus_multiplier DESC, sr.set_name ASC
    `);

    if (!rewards || rewards.length === 0) {
        const embed = new EmbedBuilder()
            .setColor('#ff9ff3')
            .setTitle('🎁 Set Completion Rewards')
            .setDescription('No set rewards are currently configured. Check back later!')
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }

    const embed = new EmbedBuilder()
        .setColor('#9c88ff')
        .setTitle('🎁 Set Completion Rewards')
        .setDescription('Complete Pokemon TCG sets to earn these amazing rewards!\\n\\n*Rewards are automatically awarded when you complete a set.*');

    // Group rewards by type
    const goldRewards = rewards.filter(r => r.reward_type === 'gold');
    const titleRewards = rewards.filter(r => r.reward_type === 'title');
    const otherRewards = rewards.filter(r => !['gold', 'title'].includes(r.reward_type));

    // Add gold rewards
    if (goldRewards.length > 0) {
        const goldText = goldRewards.map(reward => {
            const goldAmount = parseInt(reward.reward_value) * reward.bonus_multiplier;
            const completedIcon = reward.completed_by ? '✅' : '⏳';
            return `${completedIcon} **${reward.set_name}**\\n💰 ${goldAmount.toLocaleString()} Gold${reward.bonus_multiplier > 1 ? ` (${reward.bonus_multiplier}x bonus!)` : ''}`;
        }).join('\\n\\n');

        embed.addFields({
            name: '💰 **Gold Rewards**',
            value: goldText,
            inline: false
        });
    }

    // Add title rewards
    if (titleRewards.length > 0) {
        const titleText = titleRewards.map(reward => {
            const completedIcon = reward.completed_by ? '✅' : '⏳';
            return `${completedIcon} **${reward.set_name}**\\n👑 Title: "${reward.reward_value}"`;
        }).join('\\n\\n');

        embed.addFields({
            name: '👑 **Title Rewards**',
            value: titleText,
            inline: false
        });
    }

    // Add other rewards
    if (otherRewards.length > 0) {
        const otherText = otherRewards.map(reward => {
            const completedIcon = reward.completed_by ? '✅' : '⏳';
            return `${completedIcon} **${reward.set_name}**\\n🎁 ${reward.reward_description}`;
        }).join('\\n\\n');

        embed.addFields({
            name: '🎁 **Special Rewards**',
            value: otherText,
            inline: false
        });
    }

    embed.setFooter({ text: '✅ = Someone has completed this set | ⏳ = Still available to earn' });
    embed.setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function handleTitlesCommand(interaction, setManager, userManager) {
    await interaction.deferReply();

    const action = interaction.options.getString('action') || 'view';
    const targetTitle = interaction.options.getString('title');

    // Check if user exists
    const user = await userManager.getUser(interaction.user.id);
    if (!user || !user.has_started) {
        const embed = new EmbedBuilder()
            .setColor('#ffd93d')
            .setTitle('👑 Your Titles')
            .setDescription('You haven\'t started collecting cards yet!\\n\\nUse `/start` to begin your Pokemon TCG journey.')
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }

    if (action === 'set' && targetTitle) {
        // Set active title
        const success = await setManager.setActiveTitle(interaction.user.id, targetTitle);
        
        const embed = new EmbedBuilder()
            .setTimestamp();

        if (success) {
            embed
                .setColor('#4CAF50')
                .setTitle('👑 Title Updated!')
                .setDescription(`Your active title has been set to: **"${targetTitle}"**\\n\\nThis title will now appear in your profile and other displays.`);
        } else {
            embed
                .setColor('#ff6b6b')
                .setTitle('❌ Title Error')
                .setDescription(`Could not set title "${targetTitle}". Make sure you own this title and try again.`);
        }

        return interaction.editReply({ embeds: [embed] });
    }

    // View titles (default action)
    const titles = await setManager.getUserTitles(interaction.user.id);

    if (!titles || titles.length === 0) {
        const embed = new EmbedBuilder()
            .setColor('#ff9ff3')
            .setTitle('👑 Your Titles')
            .setDescription('You haven\'t earned any titles yet!\\n\\nComplete Pokemon TCG sets to earn exclusive titles like "Base Set Master" or "Kalos Champion".')
            .setFooter({ text: 'Use /sets rewards to see available title rewards' })
            .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
    }

    const embed = new EmbedBuilder()
        .setColor('#9c88ff')
        .setTitle(`👑 ${interaction.user.username}'s Titles`)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setDescription(`You have earned **${titles.length}** title${titles.length === 1 ? '' : 's'}!`);

    // Group titles by type
    const setTitles = titles.filter(t => t.title_type === 'set_completion');
    const otherTitles = titles.filter(t => t.title_type !== 'set_completion');

    // Add set completion titles
    if (setTitles.length > 0) {
        const setTitleText = setTitles.map(title => {
            const activeIcon = title.is_active ? '⭐' : '👑';
            const earnedDate = new Date(title.earned_at * 1000).toLocaleDateString();
            return `${activeIcon} **"${title.title}"**${title.is_active ? ' (Active)' : ''}\\n📅 Earned: ${earnedDate}`;
        }).join('\\n\\n');

        embed.addFields({
            name: '🎴 **Set Completion Titles**',
            value: setTitleText,
            inline: false
        });
    }

    // Add other titles
    if (otherTitles.length > 0) {
        const otherTitleText = otherTitles.map(title => {
            const activeIcon = title.is_active ? '⭐' : '🏆';
            const earnedDate = new Date(title.earned_at * 1000).toLocaleDateString();
            return `${activeIcon} **"${title.title}"**${title.is_active ? ' (Active)' : ''}\\n📅 Earned: ${earnedDate}`;
        }).join('\\n\\n');

        embed.addFields({
            name: '🏆 **Special Titles**',
            value: otherTitleText,
            inline: false
        });
    }

    embed.setFooter({ text: '⭐ = Active Title | Use "/sets titles set <title>" to change your active title' });
    embed.setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

// Helper function to create visual progress bar
function createProgressBar(percentage, length = 10) {
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    return `${'█'.repeat(filled)}${'░'.repeat(empty)}`;
}