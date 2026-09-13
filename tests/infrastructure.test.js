const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CommandLoader = require('../utils/CommandLoader');
const InteractionRouter = require('../utils/InteractionRouter');
const PokezamBot = require('../index');
const settingsCommand = require('../commands/settings');
const AchievementManager = require('../database/AchievementManager');

test('loading the bot class does not start runtime services', () => {
    assert.equal(typeof PokezamBot, 'function');
});

test('settings command exposes privacy and display preferences', () => {
    const options = settingsCommand.data.toJSON().options;
    const optionNames = options.map(option => option.name);

    assert.equal(settingsCommand.data.name, 'settings');
    assert.deepEqual(optionNames, ['showcase', 'image', 'profile', 'stats']);
});

test('CommandLoader loads valid commands and skips disabled commands', () => {
    const commandsPath = fs.mkdtempSync(path.join(os.tmpdir(), 'pokezam-commands-'));

    try {
        fs.writeFileSync(
            path.join(commandsPath, 'enabled.js'),
            "module.exports = { data: { name: 'enabled' }, execute() {} };"
        );
        fs.writeFileSync(
            path.join(commandsPath, 'master-pack.js'),
            "module.exports = { data: { name: 'master-pack' }, execute() {} };"
        );

        const commands = new Map();
        const loaded = CommandLoader.loadCommands(commandsPath, commands);

        assert.equal(loaded.length, 1);
        assert.equal(commands.has('enabled'), true);
        assert.equal(commands.has('master-pack'), false);
    } finally {
        fs.rmSync(commandsPath, { recursive: true, force: true });
    }
});

test('InteractionRouter leaves unknown interactions unhandled', async () => {
    const handled = await InteractionRouter.handle({
        isButton: () => true,
        isStringSelectMenu: () => false,
        customId: 'unrelated_action'
    }, {});

    assert.equal(handled, false);
});

test('InteractionRouter rejects Risky Deal interactions from another user', async () => {
    let response;
    const interaction = {
        isButton: () => true,
        isStringSelectMenu: () => false,
        customId: 'vex_confirm_target-card',
        user: { id: 'different-user' },
        reply: async payload => {
            response = payload;
        }
    };

    const handled = await InteractionRouter.handle(interaction, {});

    assert.equal(handled, true);
    assert.equal(response.ephemeral, true);
    assert.match(response.content, /isn't your gamble/);
});

test('AchievementManager exposes historical event tracking', () => {
    assert.equal(typeof AchievementManager.prototype.recordEvent, 'function');
    assert.equal(typeof AchievementManager.prototype.getEventCount, 'function');
});