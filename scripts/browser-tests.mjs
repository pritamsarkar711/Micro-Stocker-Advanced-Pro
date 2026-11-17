// Linux browser smoke tests with a fake API. Never uses real account credentials.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

if (process.platform !== 'linux' && !process.env.CHROMIUM_PATH) {
  console.error('Set CHROMIUM_PATH to a compatible browser to run browser tests on this platform.');
  process.exit(1);
}
const scratch = mkdtempSync(path.join(tmpdir(), 'msap-browser-test-'));
if (process.platform === 'linux' && !process.env.CHROMIUM_PATH) {
  // @sparticuz/chromium provides the shared libraries needed by minimal Linux images.
  writeFileSync(path.join(scratch, 'libs.tar'), brotliDecompressSync(readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
  const extracted = spawnSync('tar', ['xf', path.join(scratch, 'libs.tar'), '-C', scratch]);
  if (extracted.status !== 0) throw new Error('Could not extract Chromium test libraries');
  process.env.LD_LIBRARY_PATH = `${path.join(scratch, 'lib')}${path.delimiter}${process.env.LD_LIBRARY_PATH || ''}`;
}
const env = { ...process.env, VITE_LICENSE_SUPABASE_URL: 'https://test.supabase.co', VITE_LICENSE_SUPABASE_ANON_KEY: 'public-test-only', TEST_BASE_URL: 'http://127.0.0.1:5174' };
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5174', '--strictPort'], { env, stdio: 'pipe' });
try {
  let output = '';
  server.stdout.on('data', (chunk) => { output += chunk; });
  server.stderr.on('data', (chunk) => { output += chunk; });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Vite startup timed out: ${output}`)), 15000);
    server.on('exit', (code) => { clearTimeout(timeout); reject(new Error(`Vite exited (${code}): ${output}`)); });
    server.stdout.on('data', () => { if (output.includes('ready in')) { clearTimeout(timeout); resolve(); } });
  });
  for (const file of ['tests/browser/auth-flow.mjs', 'tests/browser/mask-editor.mjs', 'tests/browser/video.mjs']) {
    const result = spawnSync(process.execPath, [file], { env, stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`${file} failed`);
  }
} finally {
  server.kill('SIGTERM');
  rmSync(scratch, { recursive: true, force: true });
}
