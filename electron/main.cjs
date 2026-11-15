/**
 * Micro Stocker Advanced Pro - Electron main process.
 *
 * Plain CommonJS on purpose: no extra build step, so `npm run dev` and
 * `electron-builder` both work without compiling the main process.
 *
 * Security model
 *  - contextIsolation: true   (renderer cannot touch Node)
 *  - nodeIntegration:  false
 *  - sandbox:            true (preload only gets the electron IPC bridge)
 *  - every privileged action goes through an explicit ipcMain.handle channel
 */
'use strict';

const { app, BrowserWindow, Menu, dialog, ipcMain, shell, nativeTheme, session } =
  require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const isDev = Boolean(DEV_SERVER_URL);

/** @type {BrowserWindow | null} */
let mainWindow = null;

/* -------------------------------------------------------------------------- */
/* Local key/value persistence (offline cache + settings)                     */
/* -------------------------------------------------------------------------- */

const dataDir = () => path.join(app.getPath('userData'), 'app-data');

const safeKey = (key) => {
  const clean = String(key || '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  if (!clean) throw new Error('Invalid storage key');
  return `${clean}.json`;
};

const filePathFor = (key) => path.join(dataDir(), safeKey(key));

async function readKey(key) {
  try {
    const raw = await fs.readFile(filePathFor(key), 'utf8');
    return { ok: true, value: JSON.parse(raw) };
  } catch (error) {
    if (error && error.code === 'ENOENT') return { ok: true, value: null };
    return { ok: false, error: String(error && error.message ? error.message : error) };
  }
}

async function writeKey(key, value) {
  try {
    await fs.mkdir(dataDir(), { recursive: true });
    await fs.writeFile(filePathFor(key), JSON.stringify(value, null, 2), 'utf8');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error && error.message ? error.message : error) };
  }
}

async function removeKey(key) {
  try {
    await fs.unlink(filePathFor(key));
    return { ok: true };
  } catch (error) {
    if (error && error.code === 'ENOENT') return { ok: true };
    return { ok: false, error: String(error && error.message ? error.message : error) };
  }
}

async function listKeys() {
  try {
    const entries = await fs.readdir(dataDir());
    return { ok: true, keys: entries.filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')) };
  } catch (error) {
    if (error && error.code === 'ENOENT') return { ok: true, keys: [] };
    return { ok: false, error: String(error && error.message ? error.message : error) };
  }
}

/* -------------------------------------------------------------------------- */
/* IPC channels                                                               */
/* -------------------------------------------------------------------------- */

function registerIpc() {
  ipcMain.handle('app:info', () => ({
    name: app.getName(),
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    isDev,
    userDataPath: app.getPath('userData'),
    dataDir: dataDir(),
  }));

  ipcMain.handle('data:read', (_event, key) => readKey(key));
  ipcMain.handle('data:write', (_event, key, value) => writeKey(key, value));
  ipcMain.handle('data:remove', (_event, key) => removeKey(key));
  ipcMain.handle('data:list', () => listKeys());

  ipcMain.handle('window:minimize', () => mainWindow && mainWindow.minimize());
  ipcMain.handle('window:toggle-maximize', () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
    return mainWindow.isMaximized();
  });
  ipcMain.handle('window:close', () => mainWindow && mainWindow.close());
  ipcMain.handle('window:is-maximized', () => Boolean(mainWindow && mainWindow.isMaximized()));

  ipcMain.handle('view:zoom', (_event, delta) => {
    if (!mainWindow) return 1;
    const webContents = mainWindow.webContents;
    const next = Math.min(3, Math.max(0.5, Number(webContents.getZoomFactor()) + Number(delta || 0)));
    webContents.setZoomFactor(next);
    return next;
  });
  ipcMain.handle('view:zoom-set', (_event, factor) => {
    if (!mainWindow) return 1;
    const next = Math.min(3, Math.max(0.5, Number(factor) || 1));
    mainWindow.webContents.setZoomFactor(next);
    return next;
  });
  ipcMain.handle('view:zoom-get', () => (mainWindow ? mainWindow.webContents.getZoomFactor() : 1));

  ipcMain.handle('theme:set', (_event, theme) => {
    nativeTheme.themeSource = theme === 'light' || theme === 'dark' ? theme : 'system';
    return nativeTheme.themeSource;
  });

  ipcMain.handle('shell:open-external', (_event, url) => {
    const value = String(url || '');
    if (!/^https?:\/\//i.test(value)) return { ok: false, error: 'Only http(s) links may be opened' };
    return shell.openExternal(value).then(() => ({ ok: true })).catch((error) => ({ ok: false, error: String(error) }));
  });

  // Export a text/CSV/JSON file with a native "Save as..." dialog.
  ipcMain.handle('fs:export-text', async (_event, payload) => {
    try {
      const { defaultName = 'export.txt', text = '', filters } = payload || {};
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Export file',
        defaultPath: path.join(app.getPath('documents'), defaultName),
        filters: Array.isArray(filters) && filters.length
          ? filters
          : [{ name: 'All files', extensions: ['*'] }],
      });
      if (canceled || !filePath) return { ok: false, canceled: true };
      await fs.writeFile(filePath, String(text), 'utf8');
      return { ok: true, filePath };
    } catch (error) {
      return { ok: false, error: String(error && error.message ? error.message : error) };
    }
  });

  ipcMain.handle('dialog:open-json', async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Open JSON file',
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (canceled || !filePaths || !filePaths[0]) return { ok: false, canceled: true };
      const raw = await fs.readFile(filePaths[0], 'utf8');
      return { ok: true, filePath: filePaths[0], value: JSON.parse(raw) };
    } catch (error) {
      return { ok: false, error: String(error && error.message ? error.message : error) };
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Window                                                                     */
/* -------------------------------------------------------------------------- */

function createWindow() {
  mainWindow = new BrowserWindow({
    // Responsive-friendly minimums: the UI stays usable down to a small window.
    width: 1440,
    height: 900,
    minWidth: 360,
    minHeight: 560,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0b1020' : '#f6f7fb',
    autoHideMenuBar: !isDev,
    title: 'Micro Stocker Advanced Pro',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('maximize', () => mainWindow && mainWindow.webContents.send('window:maximized-changed', true));
  mainWindow.on('unmaximize', () => mainWindow && mainWindow.webContents.send('window:maximized-changed', false));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in the real browser, never inside the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  /** @type {Electron.MenuItemConstructorOptions[]} */
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        ...(isDev ? [{ role: 'toggleDevTools' }] : []),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: 'About Micro Stocker Advanced Pro',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('app:navigate', '/about');
          },
        },
        {
          label: 'Project on GitHub',
          click: () => shell.openExternal('https://github.com/pritamsarkar711/Micro-Stocker-Advanced-Pro'),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* Single-instance lock: a second launch focuses the existing window. */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // Deny permission prompts (camera/mic/geolocation) unless we add features
    // that genuinely need them.
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));

    registerIpc();
    buildMenu();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
