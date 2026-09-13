class CommandExecutor {
    static async execute(interaction, bot) {
        const command = bot.commands.get(interaction.commandName);
        if (!command) return;

        try {
            if (!bot.cooldowns.has(command.data.name)) {
                bot.cooldowns.set(command.data.name, new Map());
            }

            const now = Date.now();
            const timestamps = bot.cooldowns.get(command.data.name);
            const cooldownAmount = (command.cooldown || 0) * 1000;

            if (cooldownAmount > 0 && timestamps.has(interaction.user.id)) {
                const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;
                if (now < expirationTime) {
                    const user = bot.userManager ? await bot.userManager.getUser(interaction.user.id) : null;
                    const hasCooldownBypass = user && user.cooldown_bypass === true;

                    if (!hasCooldownBypass) {
                        bot.runtime.metrics.commandCooldownHits = (bot.runtime.metrics.commandCooldownHits || 0) + 1;
                        const timeLeft = (expirationTime - now) / 1000;
                        return await bot.safeReply(
                            interaction,
                            {
                                content: `Please wait ${timeLeft.toFixed(1)} more seconds before using \`/${command.data.name}\` again.`,
                                flags: 64
                            },
                            'Please wait a bit longer and try again.'
                        );
                    }
                }
            }

            timestamps.set(interaction.user.id, now);
            if (cooldownAmount > 0) {
                setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);
            }

            bot.trackCommandUse(command.data.name, interaction.user.id);

            await command.execute(interaction, {
                database: bot.database,
                userManager: bot.userManager,
                cardManager: bot.cardManager,
                questManager: bot.questManager,
                collectorShopManager: bot.collectorShopManager
            });
        } catch (error) {
            bot.recordCommandFailure(error);
            console.error('Error executing command:', error);

            if (error.code === 10062) {
                console.log('⚠️ Command timed out - interaction expired');
                return;
            }

            await bot.safeReply(
                interaction,
                {
                    content: 'There was an error while executing this command!',
                    flags: 64
                },
                'There was an error while executing this command!'
            );
        }
    }
}

module.exports = CommandExecutor;