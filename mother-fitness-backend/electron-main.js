const { app, BrowserWindow, Menu, Tray, ipcMain } = require('electron');
const path = require('path');
const http = require('http');

// Import the Express app and server setup
require('dotenv').config();
const expressApp = require('./src/app');
const connectDB = require('./src/config/database');
const logger = require('./src/config/logger');
const { initSocket } = require('./src/config/socket');

let mainWindow = null;
let expressServer = null;
let tray = null;
const PORT = process.env.PORT || 5000;

// Check if a port is in use
function isPortAvailable(port) {
    return new Promise((resolve) => {
        const server = http.createServer();
        server.once('error', () => resolve(false));
        server.once('listening', () => {
            server.close();
            resolve(true);
        });
        server.listen(port);
    });
}

// Start the Express backend server
async function startBackendServer() {
    try {
        // Connect to MongoDB
        await connectDB();
        logger.info('✅ Connected to MongoDB');

        // Check if port is available
        const portAvailable = await isPortAvailable(PORT);
        if (!portAvailable) {
            logger.error(`❌ Port ${PORT} is already in use`);
            throw new Error(`Port ${PORT} is already in use. Please close other instances or change the PORT in .env file.`);
        }

        // Create HTTP server
        const server = http.createServer(expressApp);

        // Initialize Socket.io
        initSocket(server);

        // Start server
        return new Promise((resolve, reject) => {
            expressServer = server.listen(PORT, '0.0.0.0', () => {
                logger.info(`✅ Backend server running on http://localhost:${PORT}`);
                resolve();
            });

            expressServer.on('error', (error) => {
                logger.error(`❌ Failed to start backend server: ${error.message}`);
                reject(error);
            });
        });
    } catch (error) {
        logger.error(`❌ Backend server error: ${error.message}`);
        throw error;
    }
}

// Create the main application window
function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        icon: path.join(__dirname, 'build', 'icon.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'electron-preload.js'),
        },
        backgroundColor: '#1a1a2e',
        show: false, // Don't show until ready
        title: 'Mother Fitness - Gym Management System'
    });

    // Load the app
    mainWindow.loadURL(`http://localhost:${PORT}`);

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        logger.info('✅ Application window ready');
    });

    // Handle window close
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Open DevTools in development mode
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }

    // Handle external links (open in default browser)
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        require('electron').shell.openExternal(url);
        return { action: 'deny' };
    });
}

// Create application menu
function createMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Reload',
                    accelerator: 'CmdOrCtrl+R',
                    click: () => {
                        if (mainWindow) mainWindow.reload();
                    }
                },
                { type: 'separator' },
                {
                    label: 'Exit',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Toggle Full Screen',
                    accelerator: 'F11',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.setFullScreen(!mainWindow.isFullScreen());
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Toggle Developer Tools',
                    accelerator: 'CmdOrCtrl+Shift+I',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.toggleDevTools();
                        }
                    }
                }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About',
                    click: () => {
                        const { dialog } = require('electron');
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'About Mother Fitness',
                            message: 'Mother Fitness - Gym Management System',
                            detail: 'Version 6.3\n\nA comprehensive gym management solution.\n\nBuilt by Black Embracing',
                            buttons: ['OK']
                        });
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// App ready event
app.whenReady().then(async () => {
    try {
        logger.info('🚀 Starting Mother Fitness Desktop Application...');

        // Start backend server first
        await startBackendServer();

        // Create the main window
        createMainWindow();

        // Create menu
        createMenu();

        logger.info('✅ Application started successfully');
    } catch (error) {
        logger.error(`❌ Failed to start application: ${error.message}`);

        const { dialog } = require('electron');
        dialog.showErrorBox(
            'Startup Error',
            `Failed to start the application:\n\n${error.message}\n\nPlease check your MongoDB connection and ensure the .env file is configured correctly.`
        );

        app.quit();
    }
});

// Activate event (macOS)
app.on('activate', () => {
    if (mainWindow === null && expressServer !== null) {
        createMainWindow();
    }
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Graceful shutdown
app.on('before-quit', async () => {
    logger.info('🛑 Shutting down application...');

    // Close Express server
    if (expressServer) {
        await new Promise((resolve) => {
            expressServer.close(() => {
                logger.info('✅ Backend server closed');
                resolve();
            });
        });
    }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error(`Uncaught Exception: ${error.message}`);
    console.error(error);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
    logger.error(`Unhandled Rejection: ${error.message}`);
    console.error(error);
});
