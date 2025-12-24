require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const connectDB = require('./src/config/database');
const logger = require('./src/config/logger');

const { initSocket } = require('./src/config/socket');

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = initSocket(server);

// Connect to database and start server
const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDB();

        // Start server - bind to 0.0.0.0 for Render compatibility
        server.listen(PORT, '0.0.0.0', () => {
            logger.info(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
            logger.info(`📊 Health check: http://localhost:${PORT}/health`);

            // Start Cloud Sync Worker (only on Local Master)
            if (process.env.IS_CLOUD_MIRROR !== 'true' && process.env.CLOUD_API_URL) {
                const CloudSyncService = require('./src/services/CloudSyncService');
                CloudSyncService.startWorker();
                logger.info('🔄 Cloud Sync Worker started');
            }
        });
    } catch (error) {
        logger.error(`Failed to start server: ${error.message}`);
        process.exit(1);
    }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    logger.error(`Unhandled Rejection: ${err.message}`);
    server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    logger.error(`Uncaught Exception: ${err.message}`);
    process.exit(1);
});

// Start the server
startServer();
