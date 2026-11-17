/**
 * Unit checks for the Electron network policy. No browser needed.
 *
 *   node scripts/qa/security-rules.mjs
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { assertNetTarget, assertModelUrl, isBlockedHost } = require('../../electron/net-policy.cjs');

const checks = [];
const ok = (name, pass, detail = '') => checks.push({ name, pass: Boolean(pass), detail });

function allows(url, expected, name) {
  let passed = false;
  let detail = '';
  try {
    assertNetTarget(url);
    passed = expected;
    detail = 'allowed';
  } catch (error) {
    passed = !expected;
    detail = String(error.message);
  }
  ok(name, passed, detail);
}

allows('https://api.openai.com/v1/chat/completions', true, 'public https allowed');
allows('http://localhost:11434/api/tags', true, 'local Ollama allowed');
allows('http://127.0.0.1:1234/v1/models', true, 'loopback IP allowed');
allows('http://169.254.169.254/latest/meta-data/', false, 'cloud metadata blocked');
allows('http://10.0.0.5/admin', false, 'private 10/8 blocked');
allows('http://192.168.1.1/router', false, 'private 192.168/16 blocked');
allows('http://172.20.1.5/x', false, 'private 172.16/12 blocked');
allows('http://printer.local/status', false, 'mdns name blocked');
allows('file:///etc/passwd', false, 'file protocol blocked');
allows('javascript:alert(1)', false, 'javascript protocol blocked');
allows('https://user:pass@example.com/', false, 'embedded credentials blocked');

ok('ipv6 loopback allowed', isBlockedHost('::1') === false);
ok('ipv6 unique local blocked', isBlockedHost('fd00::1') === true);

function model(url, expected, name) {
  let passed = false;
  let detail = '';
  try {
    assertModelUrl(url);
    passed = expected;
    detail = 'allowed';
  } catch (error) {
    passed = !expected;
    detail = String(error.message);
  }
  ok(name, passed, detail);
}

model('https://github.com/xinntao/Real-ESRGAN/releases/download/v1/model.zip', true, 'github model download');
model('https://raw.githubusercontent.com/upscayl/upscayl/main/models/x.param', true, 'raw github weights');
model('https://evil.example.com/payload.zip', false, 'unknown model host refused');
model('http://github.com/file.zip', false, 'plain http model refused');

const failed = checks.filter((check) => !check.pass);
for (const check of checks) console.log(`${check.pass ? 'ok  ' : 'FAIL'} ${check.name}${check.pass ? '' : ` (${check.detail})`}`);
console.log(`\n${checks.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
