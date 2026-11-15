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
    readBytes: async (path) => {
      const result = await ipcRenderer.invoke('fs:read-base64', path);
      if (!result.ok) throw new Error(result.error || 'Read failed');
      const binary = atob(result.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    },
    writeBytes: (path, bytes) => {
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
      }
      return ipcRenderer.invoke('fs:write-base64', path, btoa(binary));
    },
    pickFiles: (title) => ipcRenderer.invoke('fs:pick-files', title),
    rename: (from, to) => ipcRenderer.invoke('fs:rename', from, to),
  },

  watch: {
    start: () => ipcRenderer.invoke('watch:start'),
    stop: () => ipcRenderer.invoke('watch:stop'),
    onFile: (callback) => {
      const listener = (_event, file) => callback(file);
      ipcRenderer.on('watch:file', listener);
      return () => ipcRenderer.removeListener('watch:file', listener);
    },
  },

  upscaler: {
    ensure: (url, binary, models) => ipcRenderer.invoke('upscaler:ensure', { url, binary, models }),
    run: async (args) => {
      let inBase64 = args.inBase64;
      if (!inBase64 && !args.inPath && args.blob) {
        const bytes = new Uint8Array(await args.blob.arrayBuffer());
        let binary = '';
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
        }
        inBase64 = btoa(binary);
      }
      const result = await ipcRenderer.invoke('upscaler:run', {
        inPath: args.inPath,
        inBase64,
        binary: args.binary,
        modelId: args.modelId,
        passes: args.passes,
        outFormat: args.outFormat,
        quality: args.quality,
      });
      if (!result.ok) return { ok: false, error: result.error, log: result.log };
      const binary = atob(result.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return { ok: true, blob: new Blob([bytes], { type: `image/${args.outFormat === 'jpg' ? 'jpeg' : args.outFormat}` }), log: result.log };
    },
  },
};

contextBridge.exposeInMainWorld('desktop', api);
