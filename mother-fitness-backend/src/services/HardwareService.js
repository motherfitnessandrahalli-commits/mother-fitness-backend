const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const logger = require('../config/logger');

class HardwareService {
    constructor() {
        this.port = null;
        this.parser = null;
        this.isConnected = false;
        this.currentPortName = null;
    }

    /**
     * Connect to a specific serial port
     * @param {string} portName - e.g., 'COM3' or '/dev/ttyUSB0'
     */
    async connect(portName) {
        if (this.isConnected && this.currentPortName === portName) {
            return true;
        }

        if (this.port && this.port.isOpen) {
            await this.disconnect();
        }

        return new Promise((resolve) => {
            try {
                this.port = new SerialPort({
                    path: portName,
                    baudRate: 9600,
                    autoOpen: false
                });

                this.port.open((err) => {
                    if (err) {
                        logger.error(`❌ Failed to open port ${portName}: ${err.message}`);
                        return resolve(false);
                    }

                    this.isConnected = true;
                    this.currentPortName = portName;
                    this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

                    this.parser.on('data', (data) => {
                        logger.info(`[Hardware] Received from ${portName}: ${data}`);
                    });

                    this.port.on('close', () => {
                        logger.warn(`⚠️ Port ${portName} closed`);
                        this.isConnected = false;
                    });

                    logger.info(`✅ Connected to door controller on ${portName}`);
                    resolve(true);
                });

            } catch (error) {
                logger.error(`❌ Hardware Connection Error: ${error.message}`);
                resolve(false);
            }
        });
    }

    async disconnect() {
        return new Promise((resolve) => {
            if (!this.port || !this.port.isOpen) return resolve();

            this.port.close(() => {
                this.isConnected = false;
                this.currentPortName = null;
                resolve();
            });
        });
    }

    async openDoor() {
        if (!this.isConnected || !this.port || !this.port.isOpen) {
            logger.warn('⚠️ Door controller not connected. Cannot open door.');
            return false;
        }

        return new Promise((resolve) => {
            this.port.write('O', (err) => {
                if (err) {
                    logger.error(`❌ Error writing to port: ${err.message}`);
                    return resolve(false);
                }
                logger.info('🔓 Door open command sent');
                resolve(true);
            });
        });
    }

    async listPorts() {
        try {
            const ports = await SerialPort.list();
            return ports;
        } catch (error) {
            logger.error(`❌ Error listing ports: ${error.message}`);
            return [];
        }
    }
}

// Singleton instance
module.exports = new HardwareService();
