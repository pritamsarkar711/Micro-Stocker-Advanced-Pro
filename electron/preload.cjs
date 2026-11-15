/**
 * Preload: the ONLY bridge between the sandboxed renderer and the OS.
 * Everything is exposed as `window.desktop` (typed in src/lib/desktop.ts).
 */
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const api = {
  isDesktop: true,
  platform: process.platform,

  app: {
    info: () => ipcRenderer.invoke('app:info'),
    onNavigate: (callback) => {
      const listener = (_event, path) => callback(path);
      ipcRenderer.on('app:navigate', listener);
      return () => ipcRenderer.removeListener('app:navigate', listener);
    },
  },

  data: {
    read: (key) => ipcRenderer.invoke('data:read', key),
    write: (key, value) => ipcRenderer.invoke('data:write', key, value),
    remove: (key) => ipcRenderer.invoke('data:remove', key),
    list: () => ipcRenderer.invoke('data:list'),
  },

  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    onMaximizeChanged: (callback) => {
      const listener = (_event, value) => callback(value);
      ipcRenderer.on('window:maximized-changed', listener);
      return () => ipcRenderer.removeListener('window:maximized-changed', listener);
    },
  },

  view: {
    zoom: (delta) => ipcRenderer.invoke('view:zoom', delta),
    setZoom: (factor) => ipcRenderer.invoke('view:zoom-set', factor),
    getZoom: () => ipcRenderer.invoke('view:zoom-get'),
  },

  theme: {
    set: (theme) => ipcRenderer.invoke('theme:set', theme),
  },

  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  },

  fs: {
    exportText: (payload) => ipcRenderer.invoke('fs:export-text', payload),
    openJson: () => ipcRenderer.invoke('dialog:open-json'),
  },
};

contextBridge.exposeInMainWorld('desktop', api);
