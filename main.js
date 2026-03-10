const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false
        }
    }).loadFile('index.html');
}

app.whenReady().then(() => {
    Array(2).fill().forEach(() => createWindow()); // Open two windows for testing
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (!BrowserWindow.getAllWindows().length) createWindow();
});