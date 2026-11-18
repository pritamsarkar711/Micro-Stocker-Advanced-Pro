/**
 * Pre-submission quality analysis.
 *
 * Everything here is pure and deterministic so it can be unit-tested: the pages
 * feed it decoded pixels or raw SVG/EPS text and get back a report with a score,
 * a verdict and the concrete reasons a stock portal would reject the file.
 */
import { analyzeSvg, analyzeEps, type EpsReport } from './vectorcheck';
import { PLATFORM_LIST, platformName } from './platforms';
import type { PlatformId, StockFormat } from './types';

export type Severity = 'error' | 'warn' | 'info';
export type Verdict = 'ready' | 'review' | 'reject';

export interface Issue {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  fix?: string;
}

export interface PlatformVerdict {
  id: PlatformId;
  name: string;
  ok: boolean;
  reason?: string;
}

export interface QualityReport {
  score: number;
  verdict: Verdict;
  issues: Issue[];
  metrics: Array<{ label: string; value: string }>;
  platforms: PlatformVerdict[];
}

/* -------------------------------------------------------------------------- */
/*  SVG — editability is the question, not "does it open"                     */
/* -------------------------------------------------------------------------- */

export interface SvgMetrics {
  bytes: number;
  paths: number;
  shapes: number;
  textNodes: number;
  images: number;
  groups: number;
  foreignObjects: number;
  filters: number;
  masks: number;
  clipPaths: number;
  patterns: number;
  gradients: number;
  /** A single raster that covers most of the canvas — a flattened export. */
  flattenedRaster: boolean;
  /** Full-canvas opaque rectangle behind everything. */
  opaqueBackground: boolean;
  viewBox: string | null;
  width: number | null;
  height: number | null;
  fontFamilies: string[];
  embeddedFonts: number;
  hasEditorData: boolean;
  scripts: boolean;
  externalRefs: string[];
  /** Distinct editable drawing nodes (paths, shapes, live text). */
  editableNodes: number;
}

const num = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number.parseFloat(value.replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};

export function measureSvg(text: string, bytes = text.length): SvgMetrics {
  const count = (re: RegExp) => (text.match(re) ?? []).length;
  const security = analyzeSvg(text);
  const viewBoxMatch = text.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  const widthMatch = text.match(/<svg[^>]*\swidth\s*=\s*["']([^"']+)["']/i);
  const heightMatch = text.match(/<svg[^>]*\sheight\s*=\s*["']([^"']+)["']/i);
  const viewBox = viewBoxMatch?.[1]?.trim() ?? null;
  const vb = viewBox?.split(/[\s,]+/).map(Number) ?? [];
  const canvasW = num(widthMatch?.[1] ?? null) ?? (Number.isFinite(vb[2]) ? vb[2] : null);
  const canvasH = num(heightMatch?.[1] ?? null) ?? (Number.isFinite(vb[3]) ? vb[3] : null);

  const paths = count(/<path[\s>]/gi);
  const shapes = count(/<(rect|circle|ellipse|polygon|polyline|line)[\s>]/gi);
  const textNodes = count(/<text[\s>]/gi);
  const images = security.embeddedRasters;
  const groups = count(/<g[\s>]/gi);
  const foreignObjects = count(/<foreignObject[\s>]/gi);
  const filters = count(/<filter[\s>]/gi) + count(/\sfilter\s*=/gi);
  const masks = count(/<mask[\s>]/gi) + count(/\smask\s*=/gi);
  const clipPaths = count(/<clipPath[\s>]/gi) + count(/\sclip-path\s*=/gi);
  const patterns = count(/<pattern[\s>]/gi);
  const gradients = count(/<(linearGradient|radialGradient)[\s>]/gi);
  const embeddedFonts = count(/@font-face|data:font/gi);

  // A flattened export: one raster element and almost no vector geometry.
  const flattenedRaster = images > 0 && paths + shapes <= 2;

  // Full-canvas white/opaque plate is not a transparent vector asset.
  const opaqueBackground = /<rect[^>]*(width\s*=\s*["'](100%|[\d.]+)["'])[^>]*>/i.test(text) &&
    /<rect[^>]*fill\s*=\s*["'](#fff|#ffffff|white|rgb\(255,\s*255,\s*255\))["']/i.test(text) &&
    paths + shapes + textNodes < 4;

  const hasEditorData = /sodipodi:|inkscape:|illustrator:|sketch:|<metadata/i.test(text);
  const editableNodes = paths + shapes + textNodes;

  return {
    bytes,
    paths,
    shapes,
    textNodes,
    images,
    groups,
    foreignObjects,
    filters,
    masks,
    clipPaths,
    patterns,
    gradients,
    flattenedRaster,
    opaqueBackground,
    viewBox,
    width: canvasW,
    height: canvasH,
    fontFamilies: security.fonts,
    embeddedFonts,
    hasEditorData,
    scripts: security.hasScript || security.eventHandlers > 0,
    externalRefs: security.externalRefs,
    editableNodes,
  };
}

/**
 * A vector file is "editable" when its artwork is real geometry the buyer can
 * select, recolour and reshape. A Canva/SVG export that wraps one flat raster
 * (or an HTML foreignObject) opens fine but cannot be edited — exactly what
 * Adobe Stock rejects.
 */
export function analyseSvgFile(text: string, name: string, bytes: number): QualityReport {
  const m = measureSvg(text, bytes);
  const issues: Issue[] = [];
  let score = 100;

  if (m.flattenedRaster) {
    score -= 55;
    issues.push({
      id: 'svg-flat-raster',
      severity: 'error',
      title: 'Artwork is a flattened image, not editable vector',
      detail: `${m.images} embedded raster element(s) with only ${m.paths + m.shapes} vector shape(s). Buyers cannot select or recolour anything.`,
      fix: 'Re-export from the design app with “include editable objects”, or rebuild the shapes in a vector editor.',
    });
  }

  if (m.foreignObjects > 0) {
    score -= 30;
    issues.push({
      id: 'svg-foreign-object',
      severity: 'error',
      title: 'HTML content inside the SVG (foreignObject)',
      detail: 'Illustrator, Inkscape and the agency validators cannot render embedded HTML.',
      fix: 'Convert the HTML block to paths or live text before export.',
    });
  }

  if (m.scripts || m.externalRefs.length > 0) {
    score -= 35;
    issues.push({
      id: 'svg-unsafe',
      severity: 'error',
      title: 'Scripts or external references found',
      detail: m.externalRefs.length
        ? `${m.externalRefs.length} reference(s) point outside the file.`
        : 'Inline scripting is treated as malware by agencies.',
      fix: 'Run the Prepare step to sanitise the file, then rebuild the missing assets locally.',
    });
  }

  if (m.editableNodes === 0) {
    score -= 40;
    issues.push({
      id: 'svg-empty',
      severity: 'error',
      title: 'No editable geometry',
      detail: 'The file contains no paths, shapes or text.',
      fix: 'Check the export settings. The artwork may be on a hidden layer.',
    });
  }

  if (m.textNodes > 0 && m.embeddedFonts === 0) {
    score -= 15;
    issues.push({
      id: 'svg-live-text',
      severity: 'warn',
      title: 'Live text without an embedded font',
      detail: `${m.textNodes} text element(s) reference ${m.fontFamilies.slice(0, 3).join(', ') || 'a system font'} but no font data is embedded.`,
      fix: 'Embed the font, or convert the text to outlines so it renders everywhere.',
    });
  }

  if (!m.viewBox) {
    score -= 10;
    issues.push({
      id: 'svg-viewbox',
      severity: 'warn',
      title: 'Missing viewBox',
      detail: 'Without a viewBox the artwork scales unpredictably in review tools.',
      fix: 'Add viewBox="0 0 width height" to the root <svg>.',
    });
  }

  if (m.opaqueBackground) {
    score -= 10;
    issues.push({
      id: 'svg-background',
      severity: 'warn',
      title: 'Flat white background plate',
      detail: 'Vector stock is expected to be transparent.',
      fix: 'Remove the background rectangle.',
    });
  }

  if (m.editableNodes > 4000) {
    score -= 12;
    issues.push({
      id: 'svg-complex',
      severity: 'warn',
      title: 'Very high object count (possible auto-trace)',
      detail: `${m.editableNodes.toLocaleString()} objects. Auto-traced artwork usually fails the quality review.`,
      fix: 'Simplify the trace (fewer nodes, cleaner curves).',
    });
  }

  const strokeWidths = Array.from(text.matchAll(/stroke-width\s*=\s*["']([\d.]+)["']/gi))
    .map((match) => Number.parseFloat(match[1]!))
    .filter((value) => Number.isFinite(value) && value > 0);
  const hairlines = strokeWidths.filter((value) => value < 0.75).length;
  if (hairlines > 0) {
    score -= 6;
    issues.push({
      id: 'svg-hairline',
      severity: 'warn',
      title: 'Hairline strokes will break when scaled',
      detail: `${hairlines} stroke(s) are thinner than 0.75 px. Agencies print vector art at large sizes.`,
      fix: 'Thicken the strokes or convert them to filled shapes.',
    });
  }

  if (m.filters > 0) {
    score -= 8;
    issues.push({
      id: 'svg-filters',
      severity: 'warn',
      title: 'Filters are not portable',
      detail: `${m.filters} filter reference(s). EPS conversion and older Illustrator versions drop them.`,
      fix: 'Rasterise the effect or replace it with a gradient/shape.',
    });
  }

  if (m.images > 0 && !m.flattenedRaster) {
    score -= 12;
    issues.push({
      id: 'svg-mixed-raster',
      severity: 'warn',
      title: 'Raster images mixed into the vector file',
      detail: `${m.images} bitmap element(s) inside an otherwise editable file.`,
      fix: 'Replace them with vector artwork if the listing is sold as a vector.',
    });
  }

  /* Positive signals */
  if (m.hasEditorData && m.editableNodes > 3) {
    score += 4;
    issues.push({
      id: 'svg-editor-data',
      severity: 'info',
      title: 'Real editor document detected',
      detail: 'Layer and editor metadata show the file was saved from a vector editor with editable objects.',
    });
  }

  score = Math.max(0, Math.min(100, score));

  const metrics = [
    { label: 'Editable objects', value: m.editableNodes.toLocaleString() },
    { label: 'Raster embeds', value: String(m.images) },
    { label: 'Groups', value: String(m.groups) },
    { label: 'Text layers', value: String(m.textNodes) },
    { label: 'Gradients', value: String(m.gradients) },
    {
      label: 'Canvas',
      value: m.width && m.height ? `${Math.round(m.width)} × ${Math.round(m.height)}` : m.viewBox ?? 'unknown',
    },
  ];

  return {
    score,
    verdict: score >= 80 ? 'ready' : score >= 55 ? 'review' : 'reject',
    issues,
    metrics,
    platforms: platformVerdicts({
      kind: 'vector',
      bytes,
      width: m.width,
      height: m.height,
      editable: m.flattenedRaster || m.editableNodes === 0 ? false : true,
      extension: name.split('.').pop()?.toLowerCase() ?? 'svg',
      score,
    }),
  };
}

/* -------------------------------------------------------------------------- */
/*  EPS                                                                       */
/* -------------------------------------------------------------------------- */

export function analyseEpsFile(text: string, name: string, bytes: number): QualityReport & { eps: EpsReport } {
  const eps = analyzeEps(text);
  const issues: Issue[] = [];
  let score = 100;

  if (!eps.epsVersion) {
    score -= 25;
    issues.push({
      id: 'eps-header',
      severity: 'error',
      title: 'Missing EPS header',
      detail: 'The file does not start with a valid %!PS-Adobe EPSF header.',
      fix: 'Re-save as EPS from Illustrator, Affinity or Inkscape.',
    });
  }

  if (eps.hasEmbeddedRaster) {
    score -= 35;
    issues.push({
      id: 'eps-raster',
      severity: 'error',
      title: 'Embedded bitmap inside the EPS',
      detail: 'Agencies classify the file as an image, not a vector, and reject the vector review.',
      fix: 'Trade the bitmap for vector shapes or submit it as a JPG.',
    });
  }

  if (eps.usesCmyk) {
    score -= 12;
    issues.push({
      id: 'eps-cmyk',
      severity: 'warn',
      title: 'CMYK colour operators',
      detail: 'Magnific and Adobe Stock expect RGB vectors.',
      fix: 'Convert the document colour mode to RGB before saving.',
    });
  }

  if (eps.documentFonts.length > 0) {
    score -= 20;
    issues.push({
      id: 'eps-fonts',
      severity: 'error',
      title: 'Fonts are referenced but not embedded',
      detail: `Referenced: ${eps.documentFonts.slice(0, 4).join(', ')}.`,
      fix: 'Convert text to outlines or embed the fonts.',
    });
  }

  if (eps.illustratorMajor !== null && eps.illustratorMajor > 16) {
    score -= 12;
    issues.push({
      id: 'eps-version',
      severity: 'warn',
      title: `Saved with Illustrator ${eps.illustratorMajor}`,
      detail: 'Some portals require a compatibility save (CS6 or Illustrator 8).',
      fix: 'Save a copy with “Create PDF compatible file” and the legacy version.',
    });
  }

  if (!eps.hasXmp) {
    score -= 3;
    issues.push({
      id: 'eps-xmp',
      severity: 'info',
      title: 'No XMP metadata',
      detail: 'Agencies read the title and keywords from XMP when present.',
      fix: 'Embed metadata from the Export step.',
    });
  }

  score = Math.max(0, Math.min(100, score));
  const metrics = [
    { label: 'EPS version', value: eps.epsVersion ?? 'unknown' },
    { label: 'Creator', value: eps.creator ?? 'unknown' },
    { label: 'Fonts', value: eps.documentFonts.length ? String(eps.documentFonts.length) : 'outlined' },
    { label: 'Colour', value: eps.usesCmyk ? 'CMYK' : 'RGB' },
    { label: 'Raster', value: eps.hasEmbeddedRaster ? 'yes' : 'no' },
    { label: 'Metadata', value: eps.hasXmp ? 'XMP' : 'none' },
  ];

  return {
    score,
    verdict: score >= 80 ? 'ready' : score >= 55 ? 'review' : 'reject',
    issues,
    metrics,
    eps,
    platforms: platformVerdicts({
      kind: 'vector',
      bytes,
      width: null,
      height: null,
      editable: !eps.hasEmbeddedRaster,
      extension: name.split('.').pop()?.toLowerCase() ?? 'eps',
      score,
    }),
  };
}

/* -------------------------------------------------------------------------- */
/*  Raster images                                                             */
/* -------------------------------------------------------------------------- */

export interface PixelStats {
  width: number;
  height: number;
  /**
   * Focus index from edge acutance after grain is removed. Below 45 reads as
   * soft, above 120 as crisp.
   */
  sharpness: number;
  /** Fraction of pixels pinned at pure black or pure white. */
  clipped: number;
  /** Fraction of fully transparent pixels. */
  transparent: number;
  meanLuma: number;
  /** Fraction of near-white pixels (highlight clipping). */
  clippedHigh: number;
  /** Fraction of near-black pixels (shadow clipping). */
  clippedLow: number;
  /** Colour balance: mean deviation between channels, 0 = neutral. */
  colourCast: number;
  /** Fraction of pixels pushed to near-maximum saturation. */
  overSaturated: number;
  /** High-frequency grain estimate, roughly 0 to 40. */
  noise: number;
  /** Fraction of pixels sitting on a strong edge. */
  edgeDensity: number;
}

const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Grayscale downsample + 3×3 Laplacian variance. Works on any RGBA buffer. */
export function measurePixels(data: Uint8ClampedArray, width: number, height: number, maxSide = 480): PixelStats {
  const step = Math.max(1, Math.ceil(Math.max(width, height) / maxSide));
  const w = Math.max(2, Math.floor(width / step));
  const h = Math.max(2, Math.floor(height / step));
  const gray = new Float32Array(w * h);
  let clipped = 0;
  let transparent = 0;
  let lumaSum = 0;
  let clippedHigh = 0;
  let clippedLow = 0;
  let castSum = 0;
  let castCount = 0;
  let overSaturated = 0;

  for (let y = 0; y < h; y += 1) {
    const sy = Math.min(height - 1, y * step);
    for (let x = 0; x < w; x += 1) {
      const sx = Math.min(width - 1, x * step);
      const i = (sy * width + sx) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      const value = luma(r, g, b);
      gray[y * w + x] = value;
      lumaSum += value;
      if (a < 8) transparent += 1;
      if (value <= 2) clippedLow += 1;
      if (value >= 253) clippedHigh += 1;
      if (value <= 2 || value >= 253) clipped += 1;
      if (a >= 8) {
        const hi = Math.max(r, g, b);
        const lo = Math.min(r, g, b);
        castSum += hi - lo;
        castCount += 1;
        if (hi > 90 && hi - lo > hi * 0.92) overSaturated += 1;
      }
    }
  }

  // A raw Laplacian variance measures grain as much as focus, so a noisy phone
  // photo could look sharper than a clean studio shot. Smooth the luminance
  // first (grain is high frequency) and read the 95th percentile gradient, the
  // same measure the vision engine uses everywhere else in the app.
  const smooth = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let total = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          total += gray[yy * w + xx];
          count += 1;
        }
      }
      smooth[y * w + x] = total / count;
    }
  }

  const gradients: number[] = [];
  let edges = 0;
  let noiseSum = 0;
  let noiseCount = 0;
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      const gradient =
        Math.abs(smooth[i + 1] - smooth[i - 1]) + Math.abs(smooth[i + w] - smooth[i - w]);
      gradients.push(gradient);
      if (gradient > 42) edges += 1;
      if (gradient < 12) {
        const lap = 4 * smooth[i] - smooth[i - 1] - smooth[i + 1] - smooth[i - w] - smooth[i + w];
        noiseSum += Math.abs(lap) * 2;
        noiseCount += 1;
      }
    }
  }
  gradients.sort((a, b) => a - b);
  const acutance = gradients.length
    ? gradients[Math.min(gradients.length - 1, Math.floor(gradients.length * 0.95))]
    : 0;

  // Keep the historical scale so every threshold and message stays meaningful:
  // acutance 16 is the soft boundary (45) and 34 the crisp boundary (120).
  const focusIndex =
    acutance >= 34
      ? 120 + (acutance - 34) * 4
      : acutance >= 16
        ? 45 + (acutance - 16) * (75 / 18)
        : acutance * (45 / 16);

  const opaque = Math.max(1, w * h - transparent);

  return {
    width,
    height,
    sharpness: Math.max(0, focusIndex),
    clipped: clipped / (w * h),
    transparent: transparent / (w * h),
    meanLuma: lumaSum / (w * h),
    clippedHigh: clippedHigh / (w * h),
    clippedLow: clippedLow / (w * h),
    colourCast: castCount ? castSum / castCount / 255 : 0,
    overSaturated: overSaturated / opaque,
    noise: noiseCount ? noiseSum / noiseCount : 0,
    edgeDensity: gradients.length ? edges / gradients.length : 0,
  };
}

/** 64-bit difference hash (dHash) used for near-duplicate detection. */
export function differenceHash(data: Uint8ClampedArray, width: number, height: number): string {
  const w = 9;
  const h = 8;
  const cells: number[] = [];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const sx = Math.min(width - 1, Math.floor(((x + 0.5) / w) * width));
      const sy = Math.min(height - 1, Math.floor(((y + 0.5) / h) * height));
      const i = (sy * width + sx) * 4;
      cells.push(luma(data[i], data[i + 1], data[i + 2]));
    }
  }
  let bits = '';
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w - 1; x += 1) {
      bits += cells[y * w + x] < cells[y * w + x + 1] ? '1' : '0';
    }
  }
  return bits;
}

export function hamming(a: string, b: string): number {
  if (a.length !== b.length) return Math.max(a.length, b.length);
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) diff += 1;
  return diff;
}

export interface ImageQualityInput {
  name: string;
  bytes: number;
  width: number;
  height: number;
  type: string;
  stats: PixelStats;
  hash: string;
}

export function analyseImage(input: ImageQualityInput, libraryHashes: Array<{ name: string; hash: string }> = []): QualityReport {
  const { width, height, bytes, stats } = input;
  const issues: Issue[] = [];
  let score = 100;
  const megapixels = (width * height) / 1_000_000;

  if (megapixels < 4) {
    score -= 30;
    issues.push({
      id: 'img-resolution',
      severity: 'error',
      title: 'Below the usual 4 MP minimum',
      detail: `${width} × ${height} = ${megapixels.toFixed(1)} MP. Most agencies require at least 4 MP.`,
      fix: 'Upscale with the Image Upscaler before submitting.',
    });
  } else if (megapixels < 6) {
    score -= 8;
    issues.push({
      id: 'img-resolution-small',
      severity: 'warn',
      title: 'Small for premium tiers',
      detail: `${megapixels.toFixed(1)} MP passes most portals but not the larger size tiers.`,
    });
  }

  if (stats.sharpness < 45) {
    score -= 28;
    issues.push({
      id: 'img-soft',
      severity: 'error',
      title: 'Image looks soft or out of focus',
      detail: `Sharpness index ${stats.sharpness.toFixed(1)} (below 45). Rejections for "quality issues" usually start here.`,
      fix: 'Re-shoot with a smaller aperture or sharpen in the studio tools.',
    });
  } else if (stats.sharpness < 120) {
    score -= 10;
    issues.push({
      id: 'img-slightly-soft',
      severity: 'warn',
      title: 'Mild softness',
      detail: `Sharpness index ${stats.sharpness.toFixed(0)}. Fine for many subjects but risky for detail-led shots.`,
    });
  }

  if (stats.clippedHigh > 0.08) {
    score -= 12;
    issues.push({
      id: 'img-clipping-high',
      severity: 'warn',
      title: 'Blown highlights',
      detail: `${(stats.clippedHigh * 100).toFixed(1)}% of pixels are pure white and carry no detail.`,
      fix: 'Pull the highlights back before export.',
    });
  } else if (stats.clippedLow > 0.12) {
    score -= 11;
    issues.push({
      id: 'img-clipping-low',
      severity: 'warn',
      title: 'Crushed shadows',
      detail: `${(stats.clippedLow * 100).toFixed(1)}% of pixels are pure black.`,
      fix: 'Lift the shadows so the image keeps detail at thumbnail size.',
    });
  } else if (stats.clipped > 0.06) {
    score -= 8;
    issues.push({
      id: 'img-clipping',
      severity: 'warn',
      title: 'High contrast clipping',
      detail: `${(stats.clipped * 100).toFixed(1)}% of pixels sit at pure black or pure white.`,
      fix: 'Recover the highlights and whites before export.',
    });
  }

  const isJpeg = /jpe?g/i.test(input.type) || /\.jpe?g$/i.test(input.name);
  if (isJpeg && stats.transparent > 0.02) {
    score -= 20;
    issues.push({
      id: 'img-jpeg-alpha',
      severity: 'error',
      title: 'Transparency in a JPEG',
      detail: `${(stats.transparent * 100).toFixed(1)}% of the frame is transparent. JPEG cannot store alpha, so those pixels turn black.`,
      fix: 'Export a PNG, or flatten the image on a solid background.',
    });
  }

  if (stats.colourCast > 0.2) {
    score -= 10;
    issues.push({
      id: 'img-cast',
      severity: 'warn',
      title: 'Visible colour cast',
      detail: `Channels differ by ${Math.round(stats.colourCast * 255)} levels on average, so neutrals are tinted.`,
      fix: 'Set a neutral white balance and re-check grey areas.',
    });
  }

  if (stats.overSaturated > 0.12) {
    score -= 8;
    issues.push({
      id: 'img-saturation',
      severity: 'warn',
      title: 'Colour is pushed past the gamut',
      detail: `${(stats.overSaturated * 100).toFixed(0)}% of pixels are near-maximum saturation and lose separation.`,
      fix: 'Reduce saturation or vibrance slightly before export.',
    });
  }

  if (stats.noise > 11) {
    score -= 9;
    issues.push({
      id: 'img-noise',
      severity: 'warn',
      title: 'Visible grain or noise',
      detail: `Noise index ${stats.noise.toFixed(1)} in flat areas.`,
      fix: 'Apply light noise reduction or shoot at a lower ISO.',
    });
  }

  const bytesPerPixel = bytes / Math.max(1, width * height);
  if (bytesPerPixel < 0.06) {
    score -= 9;
    issues.push({
      id: 'img-compression',
      severity: 'warn',
      title: 'Heavily compressed',
      detail: `${bytesPerPixel.toFixed(3)} bytes per pixel. Expect blocking and colour banding in smooth areas.`,
      fix: 'Re-export at a higher quality setting.',
    });
  }

  if (stats.meanLuma < 28) {
    score -= 12;
    issues.push({
      id: 'img-dark',
      severity: 'warn',
      title: 'Very dark exposure',
      detail: 'Reviewers reject frames that look under-exposed at thumbnail size.',
    });
  } else if (stats.meanLuma > 236) {
    score -= 10;
    issues.push({
      id: 'img-bright',
      severity: 'warn',
      title: 'Very bright exposure',
      detail: 'The frame is close to white; details disappear at thumbnail size.',
    });
  }

  if (bytes > 45 * 1024 * 1024) {
    score -= 15;
    issues.push({
      id: 'img-weight',
      severity: 'warn',
      title: 'Heavy file',
      detail: `${(bytes / 1024 / 1024).toFixed(1)} MB. Several portals cap JPG uploads well below this.`,
      fix: 'Optimise the file in the Image Optimizer.',
    });
  }

  const dupes = libraryHashes
    .map((item) => ({ ...item, distance: hamming(input.hash, item.hash) }))
    .filter((item) => item.distance <= 8)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3);

  if (dupes.length > 0) {
    score -= 12;
    issues.push({
      id: 'img-duplicate',
      severity: 'warn',
      title: 'Similar asset already in the library',
      detail: `Closest match: ${dupes[0].name} (${dupes[0].distance}/64 bits different).`,
      fix: 'Submit one of the two, or clearly differentiate the concept.',
    });
  }

  if (issues.length === 0) {
    issues.push({
      id: 'img-clean',
      severity: 'info',
      title: 'No technical defects detected',
      detail: 'Resolution, sharpness, exposure and file weight are within every supported portal’s limits.',
    });
  }

  score = Math.max(0, Math.min(100, score));

  const metrics = [
    { label: 'Dimensions', value: `${width} × ${height}` },
    { label: 'Megapixels', value: megapixels.toFixed(1) },
    { label: 'Sharpness', value: stats.sharpness.toFixed(0) },
    { label: 'Detail', value: `${(stats.edgeDensity * 100).toFixed(1)}%` },
    { label: 'Clipping', value: `${(stats.clipped * 100).toFixed(1)}%` },
    { label: 'Colour cast', value: `${Math.round(stats.colourCast * 255)}` },
    { label: 'Noise', value: stats.noise.toFixed(1) },
    { label: 'Transparency', value: `${(stats.transparent * 100).toFixed(0)}%` },
    { label: 'Weight', value: `${(bytes / 1024 / 1024).toFixed(2)} MB` },
  ];

  return {
    score,
    verdict: score >= 80 ? 'ready' : score >= 55 ? 'review' : 'reject',
    issues,
    metrics,
    platforms: platformVerdicts({
      kind: 'photo',
      bytes,
      width,
      height,
      editable: true,
      extension: (input.name.split('.').pop() ?? 'jpg').toLowerCase(),
      score,
    }),
  };
}

/* -------------------------------------------------------------------------- */
/*  Per-portal verdicts                                                       */
/* -------------------------------------------------------------------------- */

export interface VerdictInput {
  kind: 'photo' | 'vector' | 'video';
  bytes: number;
  width: number | null;
  height: number | null;
  editable: boolean;
  extension: string;
  score: number;
}

export function platformVerdicts(input: VerdictInput): PlatformVerdict[] {
  const mb = input.bytes / 1024 / 1024;
  const mp = input.width && input.height ? (input.width * input.height) / 1_000_000 : null;

  return PLATFORM_LIST.filter((platform) => Boolean(platform)).map((platform) => {
    const fail = (reason: string): PlatformVerdict => ({ id: platform.id, name: platformName(platform.id), ok: false, reason });

    if (input.kind === 'vector') {
      const formats = platform.formats.vector;
      if (!formats || formats.length === 0 || !formats.includes(input.extension as StockFormat)) {
        return fail(`${input.extension.toUpperCase()} is not accepted for vectors`);
      }
      if (!input.editable) return fail('Artwork is not editable');
      if (mb > platform.maxFileMB) return fail(`${mb.toFixed(1)} MB exceeds ${platform.maxFileMB} MB`);
      const minMB = platform.minFileMB ?? 0;
      if (mb < minMB) return fail(`${mb.toFixed(1)} MB is under the ${minMB} MB minimum`);
      return { id: platform.id, name: platform.name, ok: true };
    }

    if (!platform.formats.photo.includes(input.extension as StockFormat)) return fail(`${input.extension.toUpperCase()} not accepted`);
    if (mb > platform.maxFileMB) return fail(`${mb.toFixed(1)} MB exceeds ${platform.maxFileMB} MB`);
    if (mp !== null && platform.minMP > 0 && mp < platform.minMP) return fail(`Needs ${platform.minMP} MP (file is ${mp.toFixed(1)})`);
    const minSide = platform.minDimensionPx ?? 0;
    if (mp !== null && input.width !== null && minSide > 0 && Math.min(input.width, input.height ?? input.width) < minSide) {
      return fail(`Shortest side must be ${minSide}px`);
    }
    if (input.score < 55) return fail('Quality issues detected');
    return { id: platform.id, name: platform.name, ok: true };
  });
}
