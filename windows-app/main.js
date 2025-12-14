const { app, BrowserWindow } = require('electron');

const createWindow = () => {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        title: "Ultra Fitness Gym Management",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        },
        autoHideMenuBar: true
    });

    // Load the deployed application
    win.loadURL('https://ultra-fitness-backend.onrender.com');

    // Handle external links
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https://ultra-fitness-backend.onrender.com')) {
            return { action: 'allow' };
        }
        require('shell').openExternal(url);
        return { action: 'deny' };
    });
};

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
