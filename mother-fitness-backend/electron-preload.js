const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    'electron',
    {
        // You can add custom APIs here if needed
        // For now, this is just a basic setup for security
        isElectron: true,
        platform: process.platform,
        versions: {
            node: process.versions.node,
            chrome: process.versions.chrome,
            electron: process.versions.electron
        }
    }
);
