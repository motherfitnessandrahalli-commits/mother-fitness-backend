const ZKLib = require('zklib');
const logger = require('../config/logger');
const { getIO } = require('../config/socket');

/**
 * ZKTeco Biometric Device Service
 * Manages connection, enrollment, and attendance from ZKTeco devices
 */
class ZKTecoService {
    constructor() {
        this.device = null;
        this.isConnected = false;
        this.config = {
            ip: process.env.ZKTECO_IP || null,
            port: parseInt(process.env.ZKTECO_PORT) || 4370,
            timeout: parseInt(process.env.ZKTECO_TIMEOUT) || 5000,
            inport: 5200
        };
        this.attendanceListener = null;
    }

    /**
     * Connect to ZKTeco device
     * @param {String} ip - Device IP address
     * @param {Number} port - Device port (default: 4370)
     * @returns {Promise<Boolean>}
     */
    async connect(ip = null, port = null) {
        try {
            // Use provided IP or fallback to config
            const deviceIp = ip || this.config.ip;
            const devicePort = port || this.config.port;

            if (!deviceIp) {
                throw new Error('Device IP address is required');
            }

            // Create new ZKLib instance
            this.device = new ZKLib({
                ip: deviceIp,
                port: devicePort,
                timeout: this.config.timeout,
                inport: this.config.inport
            });

            // Attempt connection
            await this.device.createSocket();
            this.isConnected = true;

            // Update config
            this.config.ip = deviceIp;
            this.config.port = devicePort;

            logger.info(`✅ Connected to ZKTeco device at ${deviceIp}:${devicePort}`);

            // Start listening for attendance events
            this.startAttendanceListener();

            return true;
        } catch (error) {
            this.isConnected = false;
            logger.error(`❌ Failed to connect to ZKTeco device: ${error.message}`);
            throw error;
        }
    }

    /**
     * Disconnect from ZKTeco device
     * @returns {Promise<Boolean>}
     */
    async disconnect() {
        try {
            if (this.device && this.isConnected) {
                // Stop attendance listener
                this.stopAttendanceListener();

                // Disconnect socket
                await this.device.disconnect();
                this.isConnected = false;
                this.device = null;

                logger.info('🔌 Disconnected from ZKTeco device');
                return true;
            }
            return false;
        } catch (error) {
            logger.error(`Error disconnecting from device: ${error.message}`);
            this.isConnected = false;
            return false;
        }
    }

    /**
     * Get device information
     * @returns {Promise<Object>}
     */
    async getDeviceInfo() {
        this.ensureConnected();
        try {
            const info = await this.device.getInfo();
            return info;
        } catch (error) {
            logger.error(`Error getting device info: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get all users enrolled on the device
     * @returns {Promise<Array>}
     */
    async getEnrolledUsers() {
        this.ensureConnected();
        try {
            const users = await this.device.getUsers();
            return users.data || [];
        } catch (error) {
            logger.error(`Error getting enrolled users: ${error.message}`);
            throw error;
        }
    }

    /**
     * Enroll/Add a user to the device
     * @param {String} userId - Unique user ID (member ID)
     * @param {String} name - User name
     * @param {Number} cardNumber - Optional card number
     * @returns {Promise<Boolean>}
     */
    async enrollUser(userId, name, cardNumber = 0) {
        this.ensureConnected();
        try {
            // ZKTeco user object
            const user = {
                uid: userId.toString(),
                userid: userId.toString(),
                name: name,
                cardno: cardNumber,
                role: 0, // 0 = normal user, 14 = admin
                password: ''
            };

            await this.device.setUser(user);
            logger.info(`👤 Enrolled user: ${name} (ID: ${userId})`);
            return true;
        } catch (error) {
            logger.error(`Error enrolling user ${userId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Remove a user from the device
     * @param {String} userId - User ID to remove
     * @returns {Promise<Boolean>}
     */
    async removeUser(userId) {
        this.ensureConnected();
        try {
            await this.device.deleteUser(userId.toString());
            logger.info(`🗑️ Removed user ID: ${userId} from device`);
            return true;
        } catch (error) {
            logger.error(`Error removing user ${userId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Bulk enroll multiple users
     * @param {Array} users - Array of {userId, name, cardNumber} objects
     * @returns {Promise<Object>} - {success: count, failed: count}
     */
    async bulkEnrollUsers(users) {
        this.ensureConnected();
        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        for (const user of users) {
            try {
                await this.enrollUser(user.userId, user.name, user.cardNumber || 0);
                results.success++;
            } catch (error) {
                results.failed++;
                results.errors.push({
                    userId: user.userId,
                    error: error.message
                });
            }
        }

        logger.info(`📊 Bulk enrollment complete: ${results.success} success, ${results.failed} failed`);
        return results;
    }

    /**
     * Get attendance logs from device
     * @returns {Promise<Array>}
     */
    async getAttendanceLogs() {
        this.ensureConnected();
        try {
            const logs = await this.device.getAttendances();
            return logs.data || [];
        } catch (error) {
            logger.error(`Error getting attendance logs: ${error.message}`);
            throw error;
        }
    }

    /**
     * Clear all attendance records from device
     * @returns {Promise<Boolean>}
     */
    async clearAttendanceLogs() {
        this.ensureConnected();
        try {
            await this.device.clearAttendanceLog();
            logger.info('🧹 Cleared all attendance logs from device');
            return true;
        } catch (error) {
            logger.error(`Error clearing attendance logs: ${error.message}`);
            throw error;
        }
    }

    /**
     * Start listening for real-time attendance events
     */
    startAttendanceListener() {
        if (!this.device || !this.isConnected) {
            logger.warn('Cannot start attendance listener: device not connected');
            return;
        }

        try {
            // Listen for real-time attendance events
            this.device.on('attendance', (data) => {
                this.handleAttendanceEvent(data);
            });

            logger.info('👂 Started listening for attendance events');
        } catch (error) {
            logger.error(`Error starting attendance listener: ${error.message}`);
        }
    }

    /**
     * Stop listening for attendance events
     */
    stopAttendanceListener() {
        if (this.device) {
            this.device.removeAllListeners('attendance');
            logger.info('🔇 Stopped attendance listener');
        }
    }

    /**
     * Handle incoming attendance event from device
     * @param {Object} data - Attendance data from ZKTeco
     */
    async handleAttendanceEvent(data) {
        try {
            logger.info(`📍 Attendance event: User ${data.deviceUserId} at ${data.recordTime}`);

            // Emit to Socket.IO for frontend notification
            getIO().emit('zkteco:attendance', {
                userId: data.deviceUserId,
                timestamp: data.recordTime,
                type: data.attendState
            });

            // Note: Actual attendance saving to MongoDB will be handled by controller
        } catch (error) {
            logger.error(`Error handling attendance event: ${error.message}`);
        }
    }

    /**
     * Get connection status
     * @returns {Object}
     */
    getStatus() {
        return {
            connected: this.isConnected,
            ip: this.config.ip,
            port: this.config.port
        };
    }

    /**
     * Ensure device is connected before operations
     */
    ensureConnected() {
        if (!this.device || !this.isConnected) {
            throw new Error('Device is not connected. Please connect first.');
        }
    }
}

// Singleton instance
const zktecoService = new ZKTecoService();

module.exports = zktecoService;
