const AchievementManager = require('../database/AchievementManager');

async function recordAchievementEvent(database, userId, eventType, eventValue = 1, metadata = null) {
    try {
        const achievementManager = new AchievementManager(database);
        await achievementManager.recordEvent(userId, eventType, eventValue, metadata);
    } catch (error) {
        console.error(`Achievement event '${eventType}' could not be recorded:`, error.message);
    }
}

module.exports = recordAchievementEvent;
