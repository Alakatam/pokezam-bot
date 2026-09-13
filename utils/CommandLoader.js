const fs = require('fs');
const path = require('path');

const DISABLED_COMMANDS = new Set([
    'carddex-master.js',
    'master-pack.js',
    'master-collection.js'
]);

class CommandLoader {
    static loadCommands(commandsPath, commandCollection) {
        if (!fs.existsSync(commandsPath)) {
            console.error('❌ Commands directory not found:', commandsPath);
            return [];
        }

        const commandFiles = fs.readdirSync(commandsPath)
            .filter(file => file.endsWith('.js'));
        const commands = [];

        for (const file of commandFiles) {
            if (DISABLED_COMMANDS.has(file)) {
                console.log(`⏸️  Skipped (disabled): ${file.replace('.js', '')}`);
                continue;
            }

            const filePath = path.join(commandsPath, file);

            try {
                const command = require(filePath);

                if (!('data' in command) || !('execute' in command)) {
                    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
                    continue;
                }

                commandCollection.set(command.data.name, command);
                commands.push(command);
            } catch (error) {
                console.error(`❌ Failed to load command: ${filePath}`);
                console.error(error.message);
            }
        }

        return commands;
    }

    static loadEvents(eventsPath, client, bot) {
        if (!fs.existsSync(eventsPath)) {
            console.error('❌ Events directory not found:', eventsPath);
            return;
        }

        const eventFiles = fs.readdirSync(eventsPath)
            .filter(file => file.endsWith('.js'));

        for (const file of eventFiles) {
            const filePath = path.join(eventsPath, file);

            try {
                const event = require(filePath);
                const handler = (...args) => event.execute(...args, bot);

                if (event.once) {
                    client.once(event.name, handler);
                } else {
                    client.on(event.name, handler);
                }

                console.log(`Loaded event: ${event.name}`);
            } catch (error) {
                console.error(`❌ Failed to load event: ${filePath}`);
                console.error(error.message);
            }
        }
    }
}

module.exports = CommandLoader;