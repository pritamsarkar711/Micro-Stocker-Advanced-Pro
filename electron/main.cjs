/**
 * Micro Stocker Advanced Pro Electron main process.
 *
 * Security model:
 *  contextIsolation: true
 *  nodeIntegration:  false
 *  sandbox:          true
 *  explicit ipcMain.handle channels only
 */
'use strict';

const { app, BrowserWindow, Menu, dialog, ipcMain, shell, nativeTheme, session } =
  require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const os = require('node:os');
const { spawn } = require('node:child_process');

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const isDev = Boolean(DEV_SERVER_URL);

/** @type {BrowserWindow | null} */
let mainWindow = null;

/** Active in app model downloads keyed by id so the user can cancel cleanly. */
const activeDownloads = new Map();

/* -------------------------------------------------------------------------- */
/* Local key/value persistence                                                */
/* -------------------------------------------------------------------------- */

const dataDir = () => path.join(app.getPath('userData'), 'app-data');
const modelsRoot = () => path.join(app.getPath('userData'), 'models');
const upscalerDir = () => path.join(app.getPath('userData'), 'upscaler');
const manifestPath = () => path.join(modelsRoot(), 'manifest.json');

const safeKey = (key) => {
  const clean = String(key || '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  if (!clean) throw new Error('Invalid storage key');
  return `${clean}.json`;
};

const safeSegment = (value) => {
  const clean = String(value || '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  if (!clean || clean === '.' || clean === '..') throw new Error('Invalid path segment');
  return clean;
};

const filePathFor = (key) => path.join(dataDir(), safeKey(key));

/* -------------------------------------------------------------------------- */
/* Path approval                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The renderer may only read or write files the user actually chose: picked
 * through a native dialog, dropped into a watched folder, or saved through the
 * save dialog. A compromised renderer cannot turn that into arbitrary disk IO.
 */
const approvedFiles = new Set();
const approvedDirs = new Set();
const approvalsPath = () => path.join(app.getPath('userData'), 'approved-paths.json');
let approvalsTimer = null;

function persistApprovals() {
  if (approvalsTimer) clearTimeout(approvalsTimer);
  approvalsTimer = setTimeout(() => {
    const payload = {
      files: Array.from(approvedFiles).slice(-5000),
      dirs: Array.from(approvedDirs).slice(-500),
    };
    fs.mkdir(app.getPath('userData'), { recursive: true })
      .then(() => fs.writeFile(approvalsPath(), JSON.stringify(payload), 'utf8'))
      .catch(() => {});
  }, 400);
}

/** Paths the user picked in an earlier session stay readable for the library. */
async function loadApprovals() {
  try {
    const raw = await fs.readFile(approvalsPath(), 'utf8');
    const parsed = JSON.parse(raw);
    for (const file of parsed.files || []) approvedFiles.add(String(file));
    for (const dir of parsed.dirs || []) approvedDirs.add(String(dir));
  } catch {
    /* first run */
  }
}

function approveFile(target) {
  if (!target) return;
  const resolved = path.resolve(String(target));
  approvedFiles.add(resolved);
  approvedDirs.add(path.dirname(resolved));
  persistApprovals();
}

function approveDir(target) {
  if (!target) return;
  approvedDirs.add(path.resolve(String(target)));
  persistApprovals();
}

function isInside(parent, child) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function assertApproved(target, { write = false } = {}) {
  const raw = String(target || '');
  if (!raw || raw.includes('\0')) throw new Error('Invalid path');
  const resolved = path.resolve(raw);
  const ok = approvedFiles.has(resolved) || Array.from(approvedDirs).some((dir) => isInside(dir, resolved));
  if (!ok) throw new Error('Path was not chosen in this session');
  if (write && approvedFiles.has(resolved)) return resolved;
  if (write && !Array.from(approvedDirs).some((dir) => isInside(dir, resolved))) {
    throw new Error('Path is outside the folders this session may write');
  }
  return resolved;
}

/* -------------------------------------------------------------------------- */
/* Network policy                                                             */
/* -------------------------------------------------------------------------- */

const { assertNetTarget, assertModelUrl } = require('./net-policy.cjs');


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
    const payload = JSON.stringify(value, null, 2);
    if (payload.length > 64 * 1024 * 1024) throw new Error('Stored value is larger than 64 MB');
    await fs.mkdir(dataDir(), { recursive: true });
    await fs.writeFile(filePathFor(key), payload, 'utf8');
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
    return {
      ok: true,
      keys: entries.filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')),
    };
  } catch (error) {
    if (error && error.code === 'ENOENT') return { ok: true, keys: [] };
    return { ok: false, error: String(error && error.message ? error.message : error) };
  }
}

/* -------------------------------------------------------------------------- */
/* In app model download & install manager                                    */
/* -------------------------------------------------------------------------- */

async function readManifest() {
  try {
    const raw = await fs.readFile(manifestPath(), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeManifest(manifest) {
  await fs.mkdir(modelsRoot(), { recursive: true });
  await fs.writeFile(manifestPath(), JSON.stringify(manifest, null, 2), 'utf8');
}

async function downloadToFile(url, destPath, signal, onChunk) {
  const response = await fetch(url, { redirect: 'follow', signal });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while downloading ${path.basename(destPath)}`);
  }
  const total = Number(response.headers.get('content-length') || 0);
  await fs.mkdir(path.dirname(destPath), { recursive: true });

  if (!response.body) {
    const buf = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(destPath, buf);
    onChunk(buf.length, buf.length);
    return buf.length;
  }

  const handle = await fs.open(destPath, 'w');
  let received = 0;
  try {
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.byteLength) {
        await handle.write(value);
        received += value.byteLength;
        onChunk(received, total);
      }
    }
  } finally {
    await handle.close().catch(() => {});
  }
  return received;
}

async function extractZipFlattened(zipFile, destDir) {
  const staging = await fs.mkdtemp(path.join(os.tmpdir(), 'msap-model-'));
  try {
    const yauzl = require('yauzl');
    const { pipeline } = require('node:stream/promises');
    const archive = await new Promise((resolve, reject) => {
      yauzl.open(zipFile, { lazyEntries: true, autoClose: false }, (error, file) =>
        error ? reject(error) : resolve(file));
    });
    try {
      let totalSize = 0;
      for (;;) {
        const entry = await new Promise((resolve, reject) => {
          const cleanup = () => {
            archive.removeListener('error', onError);
            archive.removeListener('end', onEnd);
            archive.removeListener('entry', onEntry);
          };
          const onError = (error) => { cleanup(); reject(error); };
          const onEnd = () => { cleanup(); resolve(null); };
          const onEntry = (value) => { cleanup(); resolve(value); };
          archive.once('error', onError);
          archive.once('end', onEnd);
          archive.once('entry', onEntry);
          archive.readEntry();
        });
        if (!entry) break;
        const mode = (entry.externalFileAttributes >>> 16) & 0xf000;
        if (mode === 0xa000) throw new Error('Model archive contains a symbolic link.');
        const name = entry.fileName.replace(/\\/g, '/');
        if (name.startsWith('/') || /^[a-z]:/i.test(name) || name.split('/').some((part) => part === '..')) {
          throw new Error('Model archive contains an unsafe path.');
        }
        totalSize += entry.uncompressedSize;
        if (totalSize > 8 * 1024 * 1024 * 1024) throw new Error('Model archive is too large.');
        const target = path.resolve(staging, name);
        if (!target.startsWith(staging + path.sep)) throw new Error('Model archive contains an unsafe path.');
        if (name.endsWith('/')) {
          await fs.mkdir(target, { recursive: true });
        } else {
          await fs.mkdir(path.dirname(target), { recursive: true });
          const stream = await new Promise((resolve, reject) => archive.openReadStream(entry, (error, data) => error ? reject(error) : resolve(data)));
          await pipeline(stream, fsSync.createWriteStream(target, { flags: 'wx' }));
        }
      }
    } finally {
      archive.close();
    }
    const entries = await fs.readdir(staging, { withFileTypes: true });
    const root =
      entries.length === 1 && entries[0].isDirectory()
        ? path.join(staging, entries[0].name)
        : staging;
    await fs.mkdir(destDir, { recursive: true });
    await fs.cp(root, destDir, { recursive: true, force: true });
  } finally {
    await fs.rm(staging, { recursive: true, force: true }).catch(() => {});
  }
}

function emitModelProgress(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('model:progress', payload);
  }
}

function spawnBinary(binaryPath, args, cwd, onLog) {
  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath, args, { cwd });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      if (onLog && text.trim()) onLog(text.trim());
    });
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      if (onLog && text.trim()) onLog(text.trim());
    });
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0
        ? resolve(stderr)
        : reject(new Error(`${path.basename(binaryPath)} exited ${code}: ${stderr.slice(-400)}`)),
    );
  });
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
    return shell
      .openExternal(value)
      .then(() => ({ ok: true }))
      .catch((error) => ({ ok: false, error: String(error) }));
  });

  /* ---------------- CORS free network proxy for AI providers -------------- */

  ipcMain.handle('net:request', async (_event, payload) => {
    try {
      const { url, method = 'GET', headers = {}, body, timeoutMs = 60000 } = payload || {};
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(Math.max(Number(timeoutMs) || 60000, 1000), 180000));
      try {
        let target = assertNetTarget(url);
        let response = null;
        // Follow redirects manually so every hop is validated again.
        for (let hop = 0; hop < 5; hop += 1) {
          response = await fetch(target, {
            method: String(method || 'GET'),
            headers,
            body: body !== undefined && body !== null ? String(body) : undefined,
            signal: controller.signal,
            redirect: 'manual',
          });
          if (response.status < 300 || response.status >= 400) break;
          const location = response.headers.get('location');
          if (!location) break;
          target = assertNetTarget(new URL(location, target).toString());
          if (String(method || 'GET').toUpperCase() !== 'GET' && String(method || 'GET').toUpperCase() !== 'HEAD') {
            throw new Error('Redirects are not allowed for requests with a body');
          }
        }
        const declared = Number(response.headers.get('content-length') || 0);
        if (declared > 32 * 1024 * 1024) throw new Error('Response is larger than 32 MB');
        const text = await response.text();
        if (text.length > 32 * 1024 * 1024) throw new Error('Response is larger than 32 MB');
        return { ok: response.ok, status: response.status, text };
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      return {
        ok: false,
        status: 0,
        error: String(error && error.message ? error.message : error),
      };
    }
  });

  /* ---------------- File export & raw stock asset IO ---------------------- */

  ipcMain.handle('fs:export-text', async (_event, payload) => {
    try {
      const { defaultName = 'export.txt', text = '', filters } = payload || {};
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Export file',
        defaultPath: path.join(app.getPath('documents'), defaultName),
        filters:
          Array.isArray(filters) && filters.length
            ? filters
            : [{ name: 'All files', extensions: ['*'] }],
      });
      if (canceled || !filePath) return { ok: false, canceled: true };
      approveFile(filePath);
      await fs.writeFile(filePath, String(text), 'utf8');
      return { ok: true, filePath };
    } catch (error) {
      return { ok: false, error: String(error && error.message ? error.message : error) };
    }
  });

  ipcMain.handle('fs:read-base64', async (_event, targetPath) => {
    try {
      const buffer = await fs.readFile(assertApproved(targetPath));
      return { ok: true, base64: buffer.toString('base64'), size: buffer.length };
    } catch (error) {
      return { ok: false, error: String(error && error.message ? error.message : error) };
    }
  });

  ipcMain.handle('fs:write-base64', async (_event, targetPath, base64) => {
    try {
      await fs.writeFile(assertApproved(targetPath, { write: true }), Buffer.from(String(base64), 'base64'));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error && error.message ? error.message : error) };
    }
  });

  ipcMain.handle('fs:pick-files', async (_event, title) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: title || 'Import stock files',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Stock assets',
          extensions: [
            'jpg', 'jpeg', 'png', 'webp', 'avif', 'bmp', 'gif', 'tif', 'tiff', 'ico',
            'eps', 'ai', 'svg', 'mp4', 'mov', 'webm', 'mkv', 'm4v',
          ],
        },
        { name: 'All files', extensions: ['*'] },
      ],
    });
    if (canceled) return { canceled: true, files: [] };
    const files = [];
    for (const filePath of filePaths) {
      try {
        approveFile(filePath);
        const stat = await fs.stat(filePath);
        files.push({ path: filePath, name: path.basename(filePath), size: stat.size });
      } catch {
        /* skip unreadable entry */
      }
    }
    return { canceled: false, files };
  });

  ipcMain.handle('fs:rename', async (_event, from, to) => {
    try {
      await fs.rename(assertApproved(from), assertApproved(to, { write: true }));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error && error.message ? error.message : error) };
    }
  });

  /* ---------------- Watch folder ------------------------------------------ */

  let folderWatcher = null;

  ipcMain.handle('watch:start', async () => {
    if (folderWatcher) return { ok: true, dir: folderWatcher.dir };
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose a folder to watch for new stock files',
      properties: ['openDirectory'],
    });
    if (canceled || !filePaths || !filePaths[0]) return { ok: false, error: 'canceled' };
    const dir = filePaths[0];
    approveDir(dir);
    const EXT = new Set(['.jpg', '.jpeg', '.png', '.eps', '.ai', '.svg', '.webp', '.avif', '.tif', '.tiff']);
    const pending = new Map();
    try {
      const watcher = fsSync.watch(dir, (_event, filename) => {
        if (!filename) return;
        const ext = path.extname(String(filename)).toLowerCase();
        if (!EXT.has(ext)) return;
        const fullPath = path.join(dir, String(filename));
        clearTimeout(pending.get(filename));
        pending.set(
          filename,
          setTimeout(async () => {
            try {
              const stat = await fs.stat(fullPath);
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('watch:file', {
                  path: fullPath,
                  name: String(filename),
                  size: stat.size,
                });
              }
            } catch {
              /* gone */
            }
          }, 1200),
        );
      });
      folderWatcher = { watcher, dir };
      return { ok: true, dir };
    } catch (error) {
      return { ok: false, error: String(error && error.message ? error.message : error) };
    }
  });

  ipcMain.handle('watch:stop', async () => {
    if (folderWatcher) {
      folderWatcher.watcher.close();
      folderWatcher = null;
    }
    return { ok: true };
  });

  /* ---------------- Unified in app model store ---------------------------- */

  ipcMain.handle('model:list', async () => {
    const manifest = await readManifest();
    const verified = {};
    for (const [id, entry] of Object.entries(manifest)) {
      if (!entry || !entry.dir) continue;
      const exists = await fs
        .access(entry.dir)
        .then(() => true)
        .catch(() => false);
      if (exists) verified[id] = entry;
    }
    if (Object.keys(verified).length !== Object.keys(manifest).length) {
      await writeManifest(verified);
    }
    return { ok: true, items: Object.values(verified), root: modelsRoot() };
  });

  ipcMain.handle('model:install', async (_event, spec) => {
    const id = safeSegment(spec && spec.id);
    if (activeDownloads.has(id)) return { ok: false, error: 'Already downloading' };
    const controller = new AbortController();
    activeDownloads.set(id, controller);
    const targetDir = spec.sharedGroup
      ? path.join(modelsRoot(), safeSegment(spec.sharedGroup))
      : path.join(modelsRoot(), id);
    const files = Array.isArray(spec.files) ? spec.files : [];

    try {
      await fs.mkdir(targetDir, { recursive: true });
      let totalBytes = 0;

      for (let idx = 0; idx < files.length; idx++) {
        const file = files[idx];
        const url = String(file.url || '');
        assertModelUrl(url);
        const subDir = file.subDir ? path.join(targetDir, safeSegment(file.subDir)) : targetDir;
        await fs.mkdir(subDir, { recursive: true });
        const name = safeSegment(file.name || path.basename(new URL(url).pathname));
        const dest = path.join(subDir, name);

        if (file.skipIfExists && file.checkName) {
          const present = await fs
            .access(path.join(subDir, safeSegment(file.checkName)))
            .then(() => true)
            .catch(() => false);
          if (present) continue;
        }

        const startedAt = Date.now();
        const bytes = await downloadToFile(url, dest, controller.signal, (loaded, total) => {
          const elapsed = Math.max(0.2, (Date.now() - startedAt) / 1000);
          emitModelProgress({
            id,
            phase: 'downloading',
            fileIndex: idx,
            fileCount: files.length,
            loadedBytes: loaded,
            totalBytes: total,
            speedBps: Math.round(loaded / elapsed),
            label: file.label || name,
          });
        });
        totalBytes += bytes;

        if (file.extractZip) {
          emitModelProgress({
            id,
            phase: 'extracting',
            fileIndex: idx,
            fileCount: files.length,
            loadedBytes: bytes,
            totalBytes: bytes,
            speedBps: 0,
            label: `Extracting ${name}`,
          });
          await extractZipFlattened(dest, subDir);
          await fs.unlink(dest).catch(() => {});
          if (file.executable && process.platform !== 'win32') {
            await fs.chmod(path.join(subDir, safeSegment(file.executable)), 0o755).catch(() => {});
          }
        } else if (file.executable && process.platform !== 'win32') {
          await fs.chmod(dest, 0o755).catch(() => {});
        }
      }

      const manifest = await readManifest();
      const record = {
        id,
        kind: String(spec.kind || 'model'),
        dir: targetDir,
        binary: spec.binary ? String(spec.binary) : undefined,
        primaryFile: spec.primaryFile ? String(spec.primaryFile) : undefined,
        sizeBytes: totalBytes || Number(spec.approxBytes || 0),
        installedAt: new Date().toISOString(),
      };
      manifest[id] = record;
      await writeManifest(manifest);
      emitModelProgress({
        id,
        phase: 'ready',
        fileIndex: files.length,
        fileCount: files.length,
        loadedBytes: record.sizeBytes,
        totalBytes: record.sizeBytes,
        speedBps: 0,
        label: 'Installed',
      });
      return { ok: true, record };
    } catch (error) {
      const aborted = controller.signal.aborted || (error && error.name === 'AbortError');
      if (!spec.sharedGroup) {
        await fs.rm(targetDir, { recursive: true, force: true }).catch(() => {});
      }
      return {
        ok: false,
        canceled: aborted,
        error: aborted ? 'Download canceled' : String(error && error.message ? error.message : error),
      };
    } finally {
      activeDownloads.delete(id);
    }
  });

  ipcMain.handle('model:cancel', async (_event, id) => {
    const key = safeSegment(id);
    const controller = activeDownloads.get(key);
    if (controller) controller.abort();
    return { ok: true };
  });

  ipcMain.handle('model:remove', async (_event, id) => {
    const key = safeSegment(id);
    const manifest = await readManifest();
    const record = manifest[key];
    delete manifest[key];
    await writeManifest(manifest);
    if (record && record.dir) {
      const stillShared = Object.values(manifest).some((other) => other && other.dir === record.dir);
      if (!stillShared) {
        await fs.rm(record.dir, { recursive: true, force: true }).catch(() => {});
      } else if (record.primaryFile) {
        const stem = record.primaryFile.replace(/\.(bin|param|onnx)$/i, '');
        for (const ext of ['.bin', '.param', '.onnx']) {
          await fs.unlink(path.join(record.dir, 'models', `${stem}${ext}`)).catch(() => {});
          await fs.unlink(path.join(record.dir, `${stem}${ext}`)).catch(() => {});
        }
      }
    }
    return { ok: true };
  });

  ipcMain.handle('model:read', async (_event, { id, fileName }) => {
    try {
      const key = safeSegment(id);
      const manifest = await readManifest();
      const record = manifest[key];
      if (!record || !record.dir) return { ok: false, error: 'Model is not installed' };
      const target = path.join(record.dir, safeSegment(fileName || record.primaryFile));
      const buf = await fs.readFile(target);
      return { ok: true, base64: buf.toString('base64'), size: buf.length };
    } catch (error) {
      return { ok: false, error: String(error && error.message ? error.message : error) };
    }
  });

  /* ---------------- NCNN Vulkan image & frame upscaling ------------------- */

  ipcMain.handle('upscaler:ensure', async (_event, { url, binary, models, engineGroup }) => {
    try {
      assertModelUrl(url);
      const dir = engineGroup
        ? path.join(modelsRoot(), safeSegment(engineGroup))
        : upscalerDir();
      await fs.mkdir(dir, { recursive: true });
      const binaryPath = path.join(dir, safeSegment(binary));
      const modelsDir = path.join(dir, 'models');

      const exists = await fs
        .access(binaryPath)
        .then(() => true)
        .catch(() => false);

      if (!exists) {
        const zipPath = path.join(dir, 'engine.zip');
        const startedAt = Date.now();
        await downloadToFile(url, zipPath, undefined, (loaded, total) => {
          const elapsed = Math.max(0.2, (Date.now() - startedAt) / 1000);
          emitModelProgress({
            id: engineGroup || 'realesrgan',
            phase: 'downloading',
            fileIndex: 0,
            fileCount: 1,
            loadedBytes: loaded,
            totalBytes: total,
            speedBps: Math.round(loaded / elapsed),
            label: binary,
          });
        });
        await extractZipFlattened(zipPath, dir);
        await fs.unlink(zipPath).catch(() => {});
        await fs.access(binaryPath);
        if (process.platform !== 'win32') {
          await fs.chmod(binaryPath, 0o755).catch(() => {});
        }
      }

      const found = [];
      for (const model of models || []) {
        const stem = safeSegment(model);
        const candidates = [`${stem}.bin`, `${stem}-x4.bin`, `${stem}.param`];
        for (const c of candidates) {
          const ok = await fs
            .access(path.join(modelsDir, c))
            .then(() => true)
            .catch(() => false);
          if (ok) {
            found.push(stem);
            break;
          }
        }
      }
      return { ok: true, path: binaryPath, models: found };
    } catch (error) {
      return { ok: false, error: String(error && error.message ? error.message : error) };
    }
  });

  ipcMain.handle('upscaler:run', async (_event, args) => {
    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'msap-up-'));
    try {
      const dir = args.engineGroup
        ? path.join(modelsRoot(), safeSegment(args.engineGroup))
        : upscalerDir();
      const binaryPath = path.join(dir, safeSegment(args.binary));
      const modelsSub = args.modelsSubDir ? safeSegment(args.modelsSubDir) : 'models';
      const modelsDir = path.join(dir, modelsSub);
      const family = String(args.engineFamily || 'realesrgan');
      const outFmt = String(args.outFormat || 'png');

      let inputPath = args.inPath ? assertApproved(args.inPath) : null;
      if (!inputPath) {
        inputPath = path.join(workDir, `input.${outFmt === 'jpg' ? 'jpg' : outFmt}`);
        await fs.writeFile(inputPath, Buffer.from(String(args.inBase64), 'base64'));
      }

      const buildCliArgs = (scale, inFile, outFile) => {
        if (family === 'waifu2x' || family === 'srmd' || family === 'realcugan') {
          const list = [
            '-i', inFile,
            '-o', outFile,
            '-s', String(scale),
            '-n', String(args.noiseLevel ?? 1),
            '-m', modelsDir,
            '-f', outFmt,
          ];
          if (args.tileSize) list.push('-t', String(args.tileSize));
          return list;
        }
        if (family === 'realsr') {
          const list = ['-i', inFile, '-o', outFile, '-s', String(scale), '-m', modelsDir, '-f', outFmt];
          if (args.tileSize) list.push('-t', String(args.tileSize));
          return list;
        }
        return [
          '-i', inFile,
          '-o', outFile,
          '-s', String(scale),
          '-n', String(args.modelId),
          '-m', modelsDir,
          '-f', outFmt,
          '-t', String(args.tileSize || 0),
        ];
      };

      let current = inputPath;
      const passes = Array.isArray(args.passes) && args.passes.length ? args.passes : [4];
      for (let i = 0; i < passes.length; i++) {
        const out = path.join(workDir, `pass${i}.${outFmt}`);
        await spawnBinary(binaryPath, buildCliArgs(passes[i], current, out), dir, (line) => {
          mainWindow?.webContents.send('upscaler:log', line);
        });
        current = out;
      }

      const outBuffer = await fs.readFile(current);
      return { ok: true, base64: outBuffer.toString('base64') };
    } catch (error) {
      return { ok: false, error: String(error && error.message ? error.message : error) };
    } finally {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  /* ---------------- Native FFmpeg probe for Video Upscaler ---------------- */

  ipcMain.handle('video:probe-ffmpeg', async () => {
    try {
      await spawnBinary(process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg', ['-version'], os.tmpdir());
      return { ok: true, available: true };
    } catch {
      return { ok: true, available: false };
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
      approveFile(filePaths[0]);
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
    width: 1440,
    height: 900,
    minWidth: 360,
    minHeight: 560,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#101114' : '#f5f6f8',
    autoHideMenuBar: !isDev,
    title: 'Micro Stocker Advanced Pro',
    // The product draws its own window chrome so the name never appears twice
    // and the title bar matches the application exactly.
    titleBarStyle: 'hidden',
    ...(process.platform === 'darwin' ? { trafficLightPosition: { x: 16, y: 18 } } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      navigateOnDragDrop: false,
      enableBlinkFeatures: '',
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

  // Renderer navigation must never replace the privileged application document.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      const next = new URL(url);
      const allowed = isDev
        ? next.origin === new URL(DEV_SERVER_URL).origin
        : next.protocol === 'file:' && path.resolve(require('node:url').fileURLToPath(next)) === path.resolve(__dirname, '..', 'dist', 'index.html');
      if (!allowed) event.preventDefault();
    } catch { event.preventDefault(); }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // The renderer never needs camera, microphone, geolocation, notifications or
  // clipboard read. Deny every permission request instead of prompting.
  mainWindow.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  mainWindow.webContents.session.setPermissionCheckHandler(() => false);

  // A dropped file must never navigate the privileged document.
  mainWindow.webContents.on('will-attach-webview', (event) => event.preventDefault());

  mainWindow.webContents.on('before-input-event', (event, input) => {
    const mod = process.platform === 'darwin' ? input.meta : input.control;
    // Block devtools shortcuts in production builds.
    if (!isDev && mod && input.shift && input.key.toLowerCase() === 'i') event.preventDefault();
    // Block remote debugging of the packaged app.
    if (!isDev && mod && input.alt && input.key.toLowerCase() === 'i') event.preventDefault();
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
          label: 'Contact on Telegram',
          click: () => shell.openExternal('https://t.me/joegoldberg2025'),
        },
        {
          label: 'Report an issue',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('app:navigate', '/report');
          },
        },
        {
          label: 'About Micro Stocker Advanced Pro',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('app:navigate', '/about');
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

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

  app.whenReady().then(async () => {
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    await loadApprovals();
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
