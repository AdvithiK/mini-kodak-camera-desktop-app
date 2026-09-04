'use strict';

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

// Frameless transparent window sized to the camera shape (plus a small
// transparent margin for the drop shadow and the keychain loop).
const WIN_WIDTH = 660;
const WIN_HEIGHT = 360;

const PHOTO_DIR = path.join(os.homedir(), 'Pictures', 'KodakMini');

function ensurePhotoDir() {
  fs.mkdirSync(PHOTO_DIR, { recursive: true });
}

function createWindow() {
  const win = new BrowserWindow({
    width: WIN_WIDTH,
    height: WIN_HEIGHT,
    resizable: false,
    fullscreenable: false,
    maximizable: false,
    frame: false,          // no OS window chrome — the app IS the camera
    transparent: true,     // let the desktop show around the camera shape
    hasShadow: false,      // CSS provides the drop shadow
    title: 'Kodak Mini',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setMenuBarVisibility(false);

  // Forward renderer console + crashes to stdout so the app is observable
  // from the terminal (useful for headless verification).
  win.webContents.on('console-message', (_e, level, message) => {
    console.log(`[renderer] ${message}`);
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[renderer gone]', details.reason);
  });

  win.loadFile('index.html');
}

// Save a base64 JPEG data URL to the photo folder. Returns the file path.
ipcMain.handle('save-photo', async (_event, dataUrl) => {
  ensurePhotoDir();
  const match = /^data:image\/\w+;base64,(.+)$/.exec(dataUrl || '');
  if (!match) {
    throw new Error('Invalid image data');
  }
  const { photoFilename } = require('./lib/helpers');
  const filename = photoFilename(new Date());
  const filePath = path.join(PHOTO_DIR, filename);
  await fs.promises.writeFile(filePath, Buffer.from(match[1], 'base64'));
  return filePath;
});

// Move a photo to the macOS Trash (recoverable). Refuses any path
// outside the KodakMini folder as a safety guard.
ipcMain.handle('delete-photo', async (_event, filePath) => {
  const resolved = path.resolve(String(filePath || ''));
  if (resolved !== PHOTO_DIR && !resolved.startsWith(PHOTO_DIR + path.sep)) {
    throw new Error('refusing to delete outside the photo folder');
  }
  await shell.trashItem(resolved);
  return true;
});

// Open the photo folder in Finder.
ipcMain.handle('open-folder', async () => {
  ensurePhotoDir();
  await shell.openPath(PHOTO_DIR);
  return PHOTO_DIR;
});

// Quit the app (the frameless window has no OS close button).
ipcMain.handle('quit-app', () => {
  app.quit();
});

app.whenReady().then(() => {
  ensurePhotoDir();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
