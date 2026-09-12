/**
 * Enterprise Structured Logger for Pokezam
 * 
 * Provides consistent log levels, ISO timestamps, contextual metadata,
 * and production-ready formatting.
 */

class Logger {
    static levels = {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3
    };

    static currentLevel = process.env.LOG_LEVEL ? (Logger.levels[process.env.LOG_LEVEL.toUpperCase()] ?? 1) : 1;

    static formatMessage(level, message, meta = null) {
        const timestamp = new Date().toISOString();
        const metaStr = meta ? ` | ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] [${level}] ${message}${metaStr}`;
    }

    static debug(message, meta = null) {
        if (Logger.currentLevel <= Logger.levels.DEBUG) {
            console.debug(Logger.formatMessage('DEBUG', message, meta));
        }
    }

    static info(message, meta = null) {
        if (Logger.currentLevel <= Logger.levels.INFO) {
            console.log(Logger.formatMessage('INFO', message, meta));
        }
    }

    static warn(message, meta = null) {
        if (Logger.currentLevel <= Logger.levels.WARN) {
            console.warn(Logger.formatMessage('WARN', message, meta));
        }
    }

    static error(message, meta = null) {
        if (Logger.currentLevel <= Logger.levels.ERROR) {
            console.error(Logger.formatMessage('ERROR', message, meta));
        }
    }
}

module.exports = Logger;
