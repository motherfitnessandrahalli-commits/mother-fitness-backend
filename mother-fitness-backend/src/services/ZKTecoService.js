const ZKLib = require('zklib');
const logger = require('../config/logger');
const { getIO } = require('../config/socket');
const accessControl = require('./AccessControlService');

/**
 * ZKTeco Biometric Device Service
 * Manages multiple device connections for IN/OUT access control
 */
class ZKTecoService {
    constructor() {
        this.devices = new Map(); // Store devices: { instance: ZKLib, config: { ip, port, role }, isConnected: boolean }
        this.config = {
            timeout: parseInt(process.env.ZKTECO_TIMEOUT) || 5000,
            inport: 5200
        };
    }

    /**
     * Connect to a ZKTeco device
     * @param {String} ip - Device IP address
     * @param {Number} port - Device port (default: 4370)
     * @param {String} role - Device role ('IN' or 'OUT')
     * @returns {Promise<Boolean>}
     */
    async connect(ip, port = 4370, role = 'IN') {
        try {
            if (!ip) throw new Error('Device IP address is required');

            // Validate IP format
            const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
            if (!ipRegex.test(ip)) {
                throw new Error('Invalid IP address format');
            }

            // If already connected to this IP, disconnect first
            if (this.devices.has(ip)) {
                await this.disconnect(ip);
            }

            const deviceRole = (role || 'IN').toUpperCase();
            const deviceInstance = new ZKLib({
                ip,
                port,
                timeout: this.config.timeout,
                inport: this.config.inport
            });

            // Attempt connection with timeout
            logger.info(`🔌 Attempting to connect to ${ip}:${port}...`);

            const connectionPromise = deviceInstance.createSocket();
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Connection timeout - device not responding')), 10000)
            );

            await Promise.race([connectionPromise, timeoutPromise]);

            // Verify connection by attempting to get device info
            try {
                const deviceInfo = await deviceInstance.getInfo();
                logger.info(`📱 Device Info: ${JSON.stringify(deviceInfo)}`);
            } catch (infoError) {
                // If we can't get device info, connection failed
                await deviceInstance.disconnect();
                throw new Error('Device connected but not responding to commands. Check device IP and network.');
            }

            this.devices.set(ip, {
                instance: deviceInstance,
                config: { ip, port, role: deviceRole },
                isConnected: true
            });

            logger.info(`✅ Connected to ZKTeco [${deviceRole}] device at ${ip}:${port}`);

            // Start listening for attendance events
            this.startAttendanceListener(ip);

            return true;
        } catch (error) {
            logger.error(`❌ Failed to connect to ZKTeco device at ${ip}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Disconnect from a ZKTeco device
     * @param {String} ip - Device IP address
     * @returns {Promise<Boolean>}
     */
    async disconnect(ip) {
        try {
            const deviceObj = this.devices.get(ip);
            if (deviceObj && deviceObj.isConnected) {
                this.stopAttendanceListener(ip);
                await deviceObj.instance.disconnect();
                this.devices.delete(ip);
                logger.info(`🔌 Disconnected from ZKTeco device at ${ip}`);
                return true;
            }
            return false;
        } catch (error) {
            logger.error(`Error disconnecting from device ${ip}: ${error.message}`);
            return false;
        }
    }

    /**
     * Start listening for real-time events for a specific device
     */
    startAttendanceListener(ip) {
        const deviceObj = this.devices.get(ip);
        if (!deviceObj) return;

        try {
            deviceObj.instance.on('attendance', (data) => {
                this.handleAttendanceEvent(data, deviceObj.config);
            });
            logger.info(`👂 Listening for [${deviceObj.config.role}] events from ${ip}`);
        } catch (error) {
            logger.error(`Error starting listener for ${ip}: ${error.message}`);
        }
    }

    stopAttendanceListener(ip) {
        const deviceObj = this.devices.get(ip);
        if (deviceObj) {
            deviceObj.instance.removeAllListeners('attendance');
        }
    }

    /**
     * Handle incoming attendance event
     */
    async handleAttendanceEvent(data, config) {
        try {
            logger.info(`📍 [${config.role}] Event: User ${data.deviceUserId} from ${config.ip}`);

            const eventData = {
                userId: data.deviceUserId,
                timestamp: data.recordTime,
                type: data.attendState,
                deviceRole: config.role,
                deviceIp: config.ip
            };

            // Emit to Socket.IO for real-time dashboard updates
            getIO().emit('zkteco:attendance', eventData);

            // Process through Access Control Service
            await accessControl.processAccessRequest(eventData);

        } catch (error) {
            logger.error(`Error handling attendance event: ${error.message}`);
        }
    }

    /**
     * Get all users from a specific device
     */
    async getEnrolledUsers(ip) {
        const deviceObj = this.ensureConnected(ip);
        try {
            const users = await deviceObj.instance.getUsers();
            return users.data || [];
        } catch (error) {
            logger.error(`Error getting enrolled users from ${ip}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Enroll user on all connected devices
     */
    async enrollUser(userId, name, cardNumber = 0) {
        const results = [];
        for (const [ip, deviceObj] of this.devices.entries()) {
            try {
                await deviceObj.instance.setUser({
                    uid: userId.toString(),
                    userid: userId.toString(),
                    name: name,
                    cardno: cardNumber,
                    role: 0,
                    password: ''
                });
                results.push({ ip, success: true });
            } catch (error) {
                results.push({ ip, success: false, error: error.message });
            }
        }
        return results;
    }

    /**
     * Remove user from all connected devices
     */
    async removeUser(userId) {
        for (const [ip, deviceObj] of this.devices.entries()) {
            try {
                await deviceObj.instance.deleteUser(userId.toString());
            } catch (error) {
                logger.error(`Error removing user ${userId} from ${ip}: ${error.message}`);
            }
        }
    }

    getStatus() {
        const status = [];
        for (const [ip, deviceObj] of this.devices.entries()) {
            status.push({
                ip,
                role: deviceObj.config.role,
                connected: deviceObj.isConnected
            });
        }
        return status;
    }

    ensureConnected(ip) {
        const deviceObj = this.devices.get(ip);
        if (!deviceObj || !deviceObj.isConnected) {
            throw new Error(`Device at ${ip} is not connected.`);
        }
        return deviceObj;
    }
}

// Singleton instance
const zktecoService = new ZKTecoService();
module.exports = zktecoService;
