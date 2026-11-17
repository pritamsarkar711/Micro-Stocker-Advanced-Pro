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
  hasForeignObject: boolean;
  scriptUrls: number;
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
const SCRIPT_URL_RE = /(xlink:href|href|src)\s*=\s*["']\s*(javascript|vbscript|data:text\/html|data:image\/svg)/gi;
const SCRIPT_URL_TEST = /(xlink:href|href|src)\s*=\s*["']\s*(javascript|vbscript|data:text\/html|data:image\/svg)/i;
const DANGEROUS_ELEMENTS = ['script', 'foreignObject', 'iframe', 'embed', 'object', 'handler', 'listener'];
const CSS_URL_RE = /url\(\s*["']?\s*(?!#)(?:https?:)?\/\//gi;
const CSS_URL_TEST = /url\(\s*["']?\s*(?!#)(?:https?:)?\/\//i;
const EVENT_TEST = /\son[a-z]+\s*=/i;
const FOREIGN_OBJECT_TEST = /<foreignObject[\s/>]/i;
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
  const hasScript = /<script[\s>]/i.test(text);
  const eventHandlers = (text.match(SVG_EVENT_RE) ?? []).length;
  const hasImportCss = /@import/i.test(text);
  return {
    /* Submission-clean: no scripting, no external references, no editor junk. */
    ok:
      !hasScript &&
      eventHandlers === 0 &&
      externalRefs.length === 0 &&
      !hasImportCss &&
      editorJunk.length === 0 &&
      !FOREIGN_OBJECT_TEST.test(text) &&
      !SCRIPT_URL_TEST.test(text) &&
      !CSS_URL_TEST.test(text),
    hasScript,
    eventHandlers,
    hasForeignObject: FOREIGN_OBJECT_TEST.test(text),
    scriptUrls: (text.match(SCRIPT_URL_RE) ?? []).length,
    externalRefs,
    embeddedRasters: (text.match(/<image[\s>]/gi) ?? []).length,
    fonts,
    hasImportCss,
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

/**
 * Removes everything that can execute, phone home or leak the user's machine:
 * scripts, event handlers, embedded HTML, script and data URLs, remote CSS
 * references, editor namespaces and PHP blocks.
 */
export function sanitizeSvg(text: string): SvgSanitizeResult {
  const removed: string[] = [];
  let out = text;

  if (/<script[\s>]/i.test(out)) {
    out = out.replace(/<script[\s\S]*?<\/script\s*>/gi, '').replace(/<script[^>]*\/?>/gi, '');
    removed.push('<script> blocks');
  }

  for (const tag of DANGEROUS_ELEMENTS.filter((name) => name !== 'script')) {
    const paired = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}\\s*>`, 'gi');
    if (paired.test(out)) {
      out = out.replace(paired, '');
      removed.push(`<${tag}> elements`);
    }
    const selfClosing = new RegExp(`<${tag}\\b[^>]*\\/>`, 'gi');
    if (selfClosing.test(out)) {
      out = out.replace(selfClosing, '');
      removed.push(`<${tag}> elements`);
    }
  }

  if (EVENT_TEST.test(out)) {
    out = out.replace(SVG_EVENT_RE, ' data-removed=');
    removed.push('inline event handlers (onclick…)');
  }

  if (SCRIPT_URL_TEST.test(out)) {
    out = out.replace(SCRIPT_URL_RE, ' data-blocked="url"');
    removed.push('script or inline SVG URLs');
  }

  if (/@import/i.test(out)) {
    out = out.replace(/@import[^;]+;/gi, '');
    removed.push('CSS @import rules');
  }

  if (CSS_URL_TEST.test(out)) {
    out = out.replace(CSS_URL_RE, 'url(#');
    out = out.replace(/url\(#\s*\)/g, 'none');
    removed.push('remote CSS references');
  }

  for (const ns of EDITOR_NS) {
    const attr = new RegExp(`\\s${ns}:[a-zA-Z-]+\\s*=\\s*"[^"]*"`, 'g');
    if (attr.test(out)) {
      out = out.replace(attr, '');
      removed.push(`${ns}:* editor attributes`);
    }
    const decl = new RegExp(`\\sxmlns:${ns}\\s*=\\s*"[^"]*"`, 'gi');
    if (decl.test(out)) {
      out = out.replace(decl, '');
      removed.push(`xmlns:${ns} declaration`);
    }
    const element = new RegExp(`<${ns}:[a-zA-Z-]+[^>]*?/>`, 'gi');
    if (element.test(out)) {
      out = out.replace(element, '');
      removed.push(`<${ns}:*> editor elements`);
    }
    const paired = new RegExp(`<${ns}:[a-zA-Z-]+[^>]*?>[\\s\\S]*?</${ns}:[a-zA-Z-]+\\s*>`, 'gi');
    if (paired.test(out)) {
      out = out.replace(paired, '');
      removed.push(`<${ns}:*> editor elements`);
    }
  }
  out = out.replace(/<\?php[\s\S]*?\?>/gi, '');
  return { text: out, removed: Array.from(new Set(removed)) };
}

export function analyzeEps(text: string): EpsReport {
  const creator = text.match(/%%Creator:\s*(.+)/)?.[1]?.trim() ?? null;
  const versionMatch = creator?.match(/Illustrator(?:\(R\))?\s*(?:CC|CS)?\s*(\d+)/i);
  const ccMatch = /Adobe Illustrator CC/i.test(creator ?? '');
  /* Real files write "%!PS-Adobe-3.0 EPSF-3.0" (no %% prefix on EPSF). */
  const epsVersion = text.match(/(?:%%)?EPSF-\d+(?:\.\d+)?/)?.[0] ?? null;

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
  if (usesCmyk) notes.push('CMYK color operators found; Magnific and Adobe Stock expect RGB vectors.');
  if (hasEmbeddedRaster) notes.push('Embedded raster image data found; agencies require clean vector paths.');
  if (ccMatch) notes.push('Saved from Illustrator CC; resave as Illustrator 10 or CS6 when required.');
  if (fonts.length) notes.push(`Fonts referenced (${fonts.slice(0, 4).join(', ')}); outline text or verify commercial licensing.`);
  if (!text.includes('%%BoundingBox')) notes.push('Missing BoundingBox comment required by portal validators.');

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
