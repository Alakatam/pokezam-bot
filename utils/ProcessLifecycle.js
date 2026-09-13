class ProcessLifecycle {
    static register({ client, getDatabase }) {
        let shuttingDown = false;

        const shutdown = (signal) => {
            if (shuttingDown) return;
            shuttingDown = true;

            console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);

            const database = getDatabase();
            if (database && typeof database.close === 'function') {
                try {
                    database.close();
                } catch (error) {
                    console.error('Error closing database:', error.message);
                }
            }

            client.destroy();
            process.exit(0);
        };

        process.once('SIGINT', () => shutdown('SIGINT'));
        process.once('SIGTERM', () => shutdown('SIGTERM'));

        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
        });

        process.on('uncaughtException', (error) => {
            console.error('Uncaught Exception:', error);
        });
    }
}

module.exports = ProcessLifecycle;