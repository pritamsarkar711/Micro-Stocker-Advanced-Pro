/**
 * Vector hygiene: SVG sanitizer + EPS/AI technical checker.
 *
 * Stock portals reject vectors for: scripts/event handlers (security),
 * external references (the preview breaks), embedded rasters in "vector"
 * files, non-commercial fonts, and wrong Illustrator save versions
 * (Freepik FTP = CS6, 123RF = Illustrator 8).
 */

export interface SvgReport {
  ok: boolean;
  hasScript: boolean;
  eventHandlers: number;
  externalRefs: string[];
  embeddedRasters: number;
  fonts: string[];
  hasImportCss: boolean;
  hasViewBox: boolean;
  hasSize: boolean;
  hasMetadata: boolean;
  editorJunk: string[];
}

export interface EpsReport {
  ok: boolean;
  creator: string | null;
  illustratorMajor: number | null;
  epsVersion: string | null;
  documentFonts: string[];
  hasEmbeddedRaster: boolean;
  usesCmyk: boolean;
  hasTransparencyFlattened: boolean;
  hasXmp: boolean;
  notes: string[];
}

const SVG_EVENT_RE = /\son[a-z]+\s*=/gi;
const EXTERNAL_REF_RE = /(xlink:href|href)\s*=\s*["'](https?:)?\/\//gi;
const FONT_RE = /font-family\s*[:=]\s*["']?([^;"'>]+)/gi;
const EDITOR_NS = ['sodipodi', 'inkscape', 'illustrator', 'graph', 'sketch'];

export function analyzeSvg(text: string): SvgReport {
  const externalRefs: string[] = [];
  for (const m of text.matchAll(EXTERNAL_REF_RE)) externalRefs.push(m[0].slice(0, 60));
  const fonts: string[] = [];
  for (const m of text.matchAll(FONT_RE)) {
    const name = m[1].trim();
    if (name && !fonts.includes(name)) fonts.push(name);
  }
  const editorJunk = EDITOR_NS.filter((ns) => text.includes(`${ns}:`));
  return {
    ok: true,
    hasScript: /<script[\s>]/i.test(text),
    eventHandlers: (text.match(SVG_EVENT_RE) ?? []).length,
    externalRefs,
    embeddedRasters: (text.match(/<image[\s>]/gi) ?? []).length,
    fonts,
    hasImportCss: /@import/i.test(text),
    hasViewBox: /viewBox\s*=/i.test(text),
    hasSize: /width\s*=/i.test(text) && /height\s*=/i.test(text),
    hasMetadata: text.includes('<x:xmpmeta') || text.includes('<metadata'),
    editorJunk,
  };
}

export interface SvgSanitizeResult {
  text: string;
  removed: string[];
}

/** Removes scripts, inline event handlers, editor namespaces and CSS @import. */
export function sanitizeSvg(text: string): SvgSanitizeResult {
  const removed: string[] = [];
  let out = text;

  if (/<script[\s>]/i.test(out)) {
    out = out.replace(/<script[\s\S]*?<\/script\s*>/gi, '');
    removed.push('<script> blocks');
  }
  if (SVG_EVENT_RE.test(out)) {
    out = out.replace(SVG_EVENT_RE, ' data-removed=');
    removed.push('inline event handlers (onclick…)');
  }
  if (/@import/i.test(out)) {
    out = out.replace(/@import[^;]+;/gi, '');
    removed.push('CSS @import rules');
  }
  for (const ns of EDITOR_NS) {
    const re = new RegExp(`\\s${ns}:[a-zA-Z-]+\\s*=\\s*"[^"]*"`, 'g');
    if (re.test(out)) {
      out = out.replace(re, '');
      removed.push(`${ns}:* editor attributes`);
    }
  }
  out = out.replace(/<\?php[\s\S]*?\?>/gi, '');
  return { text: out, removed: Array.from(new Set(removed)) };
}

export function analyzeEps(text: string): EpsReport {
  const creator = text.match(/%%Creator:\s*(.+)/)?.[1]?.trim() ?? null;
  const versionMatch = creator?.match(/Illustrator(?:\(R\))?\s*(?:CC|CS)?\s*(\d+)/i);
  const ccMatch = /Adobe Illustrator CC/i.test(creator ?? '');
  const epsVersion = text.match(/%%EPSF-\d+(\.\d+)?/)?.[0] ?? null;

  const fonts: string[] = [];
  const docFonts = text.match(/%%DocumentFonts:\s*(.+)/)?.[1]?.trim();
  if (docFonts && docFonts !== '(atend)') {
    for (const f of docFonts.split(/\s+/)) if (f && f !== '(atend)') fonts.push(f);
  }
  for (const m of text.matchAll(/\/FontName\s+\/([A-Za-z0-9+-]+)/g)) {
    if (!fonts.includes(m[1])) fonts.push(m[1]);
  }

  const notes: string[] = [];
  const hasEmbeddedRaster = /%%BeginBinary|\/ImageType\s|BeginData:\s*\d+\s+bytes/i.test(text);
  const usesCmyk = /setcmykcolor/i.test(text);
  if (usesCmyk) notes.push('CMYK colour operators found — Freepik/Adobe expect RGB for vectors.');
  if (hasEmbeddedRaster) notes.push('Embedded raster data detected — portals want clean paths or a declared raster style.');
  if (ccMatch) notes.push('Saved from Illustrator CC — re-save as CS6 (Freepik FTP) or Illustrator 8 (123RF) when required.');
  if (fonts.length) notes.push(`Fonts referenced (${fonts.slice(0, 4).join(', ')}): outline them or confirm a commercial-free licence.`);
  if (!text.includes('%%BoundingBox')) notes.push('No %%BoundingBox — some ingest pipelines reject the file.');

  return {
    ok: true,
    creator,
    illustratorMajor: versionMatch ? Number(versionMatch[1]) : ccMatch ? 99 : null,
    epsVersion,
    documentFonts: fonts,
    hasEmbeddedRaster,
    usesCmyk,
    hasTransparencyFlattened: !/\/Alpha|setopacityalpha/i.test(text),
    hasXmp: text.includes('<?xpacket begin'),
    notes,
  };
}
