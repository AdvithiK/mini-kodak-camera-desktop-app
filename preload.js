'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kodak', {
  /** Save a JPEG data URL. Resolves to the saved file path. */
  savePhoto: (dataUrl) => ipcRenderer.invoke('save-photo', dataUrl),
  /** Move a saved photo to the Trash. Resolves true on success. */
  deletePhoto: (filePath) => ipcRenderer.invoke('delete-photo', filePath),
  /** Open the KodakMini photo folder in Finder. */
  openFolder: () => ipcRenderer.invoke('open-folder'),
  /** Quit the app. */
  quit: () => ipcRenderer.invoke('quit-app'),
});
