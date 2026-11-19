/**
 * Preload: the sole bridge between the sandboxed renderer and the OS.
 * Exposed as `window.desktop` and typed in src/lib/desktop.ts.
 */
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

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

  net: {
    request: (payload) => ipcRenderer.invoke('net:request', payload),
  },

  fs: {
    exportText: (payload) => ipcRenderer.invoke('fs:export-text', payload),
    openJson: () => ipcRenderer.invoke('dialog:open-json'),
    readBytes: async (targetPath) => {
      const result = await ipcRenderer.invoke('fs:read-base64', targetPath);
      if (!result.ok) throw new Error(result.error || 'Read failed');
      return base64ToBytes(result.base64);
    },
    writeBytes: (targetPath, bytes) =>
      ipcRenderer.invoke('fs:write-base64', targetPath, bytesToBase64(bytes)),
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

  models: {
    list: () => ipcRenderer.invoke('model:list'),
    install: (spec) => ipcRenderer.invoke('model:install', spec),
    cancel: (id) => ipcRenderer.invoke('model:cancel', id),
    remove: (id) => ipcRenderer.invoke('model:remove', id),
    readBytes: async (id, fileName) => {
      const result = await ipcRenderer.invoke('model:read', { id, fileName });
      if (!result.ok) throw new Error(result.error || 'Model read failed');
      return base64ToBytes(result.base64);
    },
    onProgress: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('model:progress', listener);
      return () => ipcRenderer.removeListener('model:progress', listener);
    },
  },

  upscaler: {
    ensure: (url, binary, models, engineGroup) =>
      ipcRenderer.invoke('upscaler:ensure', { url, binary, models, engineGroup }),
    run: async (args) => {
      let inBase64 = args.inBase64;
      if (!inBase64 && !args.inPath && args.blob) {
        inBase64 = bytesToBase64(new Uint8Array(await args.blob.arrayBuffer()));
      }
      const result = await ipcRenderer.invoke('upscaler:run', {
        inPath: args.inPath,
        inBase64,
        binary: args.binary,
        engineGroup: args.engineGroup,
        engineFamily: args.engineFamily,
        modelsSubDir: args.modelsSubDir,
        modelId: args.modelId,
        noiseLevel: args.noiseLevel,
        passes: args.passes,
        tailScale: args.tailScale,
        tileSize: args.tileSize,
        outFormat: args.outFormat,
        quality: args.quality,
      });
      if (!result.ok) return { ok: false, error: result.error, log: result.log };
      const bytes = base64ToBytes(result.base64);
      const mime = `image/${args.outFormat === 'jpg' ? 'jpeg' : args.outFormat}`;
      return { ok: true, blob: new Blob([bytes], { type: mime }), log: result.log };
    },
  },

  video: {
    probeFfmpeg: () => ipcRenderer.invoke('video:probe-ffmpeg'),
  },

  updates: {
    check: () => ipcRenderer.invoke('updates:check'),
    download: () => ipcRenderer.invoke('updates:download'),
    install: () => ipcRenderer.invoke('updates:install'),
    onProgress: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('updates:progress', listener);
      return () => ipcRenderer.removeListener('updates:progress', listener);
    },
  },
};

contextBridge.exposeInMainWorld('desktop', api);
