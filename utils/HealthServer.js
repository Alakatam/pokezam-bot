const http = require('http');
const https = require('https');

class HealthServer {
    constructor({ port, getHealthSnapshot, getCommands }) {
        this.port = port;
        this.getHealthSnapshot = getHealthSnapshot;
        this.getCommands = getCommands;
        this.server = null;
    }

    start() {
        this.server = http.createServer((req, res) => {
            if (req.url === '/health' || req.url === '/') {
                const healthData = this.getHealthSnapshot();
                healthData.timestamp = new Date().toISOString();
                healthData.version = '2.1.0';

                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify(healthData, null, 2));
                return;
            }

            if (req.url === '/metrics') {
                const metricsData = {
                    ...this.getHealthSnapshot(),
                    timestamp: new Date().toISOString(),
                    commands: this.getCommands()
                };

                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify(metricsData, null, 2));
                return;
            }

            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Pokézam TCG Bot - Health check available at /health');
        });

        this.server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.warn(`⚠️ Health check port ${this.port} is already in use; continuing without startup health server.`);
                return;
            }

            console.error('⚠️ Health check server error:', error.message);
        });

        this.server.listen(this.port, () => {
            console.log(`🏥 Health check server listening on port ${this.port}`);
        });

        return this.server;
    }

    startKeepalive() {
        if (!process.env.PORT) return;

        const keepaliveInterval = 10 * 60 * 1000;
        const selfUrl = `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'pokezam-bot.onrender.com'}/health`;

        setInterval(() => {
            try {
                https.get(selfUrl, () => {}).on('error', () => {});
            } catch {
                // Keepalive is best effort and must not affect the bot process.
            }
        }, keepaliveInterval);
    }
}

module.exports = HealthServer;