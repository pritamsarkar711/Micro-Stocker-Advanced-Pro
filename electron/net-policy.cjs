/**
 * Network policy for the Electron main process.
 *
 * The renderer can ask for an HTTP request (local AI servers need it), so every
 * target is validated here: no file/script protocols, no credentials in URLs,
 * no loopback trickery and no private or link-local ranges except the loopback
 * address people actually run Ollama on.
 */
'use strict';

const MODEL_HOSTS = new Set([
  'github.com',
  'objects.githubusercontent.com',
  'raw.githubusercontent.com',
  'release-assets.githubusercontent.com',
]);

/** True for hosts we refuse outright (private, link local, metadata). */
function isBlockedHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (host === 'localhost' || host === '::1' || host === '127.0.0.1' || host.startsWith('127.')) return false;
  if (host === '0.0.0.0' || host.endsWith('.local') || host.endsWith('.internal')) return true;

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 127 || a === 0) return a === 0;
    if (a === 10) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }

  if (host.includes(':')) {
    const v6 = host.replace(/%25.*$/, '');
    if (v6 === '::1' || v6.startsWith('::ffff:127.')) return false;
    if (v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80')) return true;
  }
  return false;
}

function assertNetTarget(raw) {
  let url;
  try {
    url = new URL(String(raw));
  } catch {
    throw new Error('Invalid URL');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Only HTTP(S) requests are allowed');
  if (url.username || url.password) throw new Error('Credentials in URLs are not allowed');
  if (isBlockedHost(url.hostname)) throw new Error('Private and link local addresses are blocked');
  return url.toString();
}

function assertModelUrl(raw) {
  const value = String(raw || '');
  if (!/^https:\/\//i.test(value)) throw new Error('Model URLs must use HTTPS');
  const host = new URL(value).hostname.toLowerCase();
  if (!MODEL_HOSTS.has(host)) throw new Error(`Untrusted model host: ${host}`);
  return value;
}

module.exports = { MODEL_HOSTS, isBlockedHost, assertNetTarget, assertModelUrl };
