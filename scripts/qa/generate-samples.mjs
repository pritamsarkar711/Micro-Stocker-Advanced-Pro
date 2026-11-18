// Bundles the TypeScript generator harness and runs it.
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const outdir = mkdtempSync(path.join(tmpdir(), 'gen-samples-'));
const outfile = path.join(outdir, 'samples.mjs');
await build({
  entryPoints: ['scripts/qa/generate-samples.src.mjs'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile,
  logLevel: 'error',
});
await import(pathToFileURL(outfile).href);
