// Minimal preload to expose safe APIs if needed
// Currently not strictly required as we just load static files
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Add any desktop integration features here
});
