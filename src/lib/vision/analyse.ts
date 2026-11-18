/**
 * Local image understanding.
 *
 * Everything here runs on the pixels themselves, in the renderer, with no model
 * download and no network. It is deliberately deterministic: the same file
 * always produces the same reading, so the recommendation that the user sees
 * can be explained, tested and trusted.
 *
 * The engine measures what actually matters for stock work:
 *   - how sharp the file is, and where (centre vs corners)
 *   - how much grain it carries
 *   - whether the exposure is clipped at either end
 *   - what the dominant colours are
 *   - what kind of picture it is (cutout, portrait, landscape, document…)
 *
 * The classification is a weighted vote across independent signals rather than
 * a chain of ifs, so a single unusual measurement cannot flip the result.
 */

export type SceneKind =
  | 'cutout'
  | 'portrait'
  | 'people'
  | 'landscape'
  | 'nature'
  | 'architecture'
  | 'food'
  | 'product'
  | 'screenshot'
  | 'document'
  | 'illustration'
  | 'pattern'
  | 'abstract'
  | 'photo';

export interface PaletteColour {
  hex: string;
  name: string;
  share: number;
}

export interface SceneSignal {
  /** Human readable label, e.g. "blue sky". */
  label: string;
  /** 0 to 1 strength. */
  strength: number;
}

export interface ImageQuality {
  /** Laplacian variance; below 45 is soft, above 120 is crisp. */
  sharpness: number;
  sharpnessLabel: 'soft' | 'acceptable' | 'crisp';
  /** Grain estimate in flat areas, 0 to 40. */
  noise: number;
  noiseLabel: 'clean' | 'light grain' | 'visible grain';
  meanLuma: number;
  contrast: number;
  shadowClip: number;
  highlightClip: number;
  saturation: number;
  colourfulness: number;
  /** 0 to 100 summary tuned for stock acceptance. */
  score: number;
}

export interface ImageInsight {
  width: number;
  height: number;
  megapixels: number;
  aspectRatio: number;
  orientation: 'landscape' | 'portrait' | 'square';
  kind: SceneKind;
  confidence: number;
  /** Short human labels such as "cutout", "blue sky", "warm tones". */
  labels: string[];
  signals: SceneSignal[];
  palette: PaletteColour[];
  quality: ImageQuality;
  hasTransparency: boolean;
  flatArt: boolean;
  uniformBackground: boolean;
  backgroundHex: string | null;
  /** Plain language findings, most important first. */
  findings: string[];
  /** True when the picture is a screenshot or a page of text. */
  hasFineText: boolean;
  /** Centre sharpness divided by edge sharpness. Above 2 suggests bokeh. */
  subjectIsolation: number;
  analysedAt: number;
}

const MAX_SIDE = 480;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const COLOUR_NAMES: Array<[string, number, number, number]> = [
  ['black', 18, 18, 18],
  ['charcoal', 52, 54, 58],
  ['grey', 128, 130, 134],
  ['silver', 190, 192, 196],
  ['white', 246, 246, 244],
  ['cream', 240, 228, 200],
  ['beige', 214, 196, 166],
  ['brown', 128, 86, 52],
  ['rust', 178, 94, 56],
  ['red', 208, 46, 42],
  ['crimson', 158, 30, 52],
  ['pink', 234, 140, 172],
  ['magenta', 186, 52, 148],
  ['purple', 118, 62, 158],
  ['violet', 140, 108, 196],
  ['navy', 32, 42, 82],
  ['blue', 54, 110, 196],
  ['sky blue', 128, 182, 228],
  ['cyan', 74, 186, 200],
  ['teal', 36, 134, 132],
  ['green', 62, 148, 78],
  ['olive', 118, 128, 58],
  ['lime', 160, 200, 74],
  ['mint', 172, 222, 190],
  ['yellow', 230, 200, 62],
  ['gold', 208, 164, 62],
  ['orange', 226, 134, 46],
  ['peach', 244, 192, 156],
  ['sand', 224, 206, 172],
];

/** Nearest named colour in the palette table, in plain RGB distance. */
export function nameColour(r: number, g: number, b: number): string {
  let best = 'grey';
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [name, nr, ng, nb] of COLOUR_NAMES) {
    const distance = (r - nr) ** 2 + (g - ng) ** 2 + (b - nb) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = name;
    }
  }
  return best;
}

function toHex(r: number, g: number, b: number): string {
  const part = (value: number) => Math.round(value).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

interface Grid {
  width: number;
  height: number;
  r: Uint8ClampedArray;
  g: Uint8ClampedArray;
  b: Uint8ClampedArray;
  a: Uint8ClampedArray;
  lum: Float32Array;
  sat: Float32Array;
  hue: Float32Array;
}

function toGrid(data: Uint8ClampedArray, width: number, height: number): Grid {
  const step = Math.max(1, Math.ceil(Math.max(width, height) / MAX_SIDE));
  const w = Math.max(4, Math.floor(width / step));
  const h = Math.max(4, Math.floor(height / step));
  const r = new Uint8ClampedArray(w * h);
  const g = new Uint8ClampedArray(w * h);
  const b = new Uint8ClampedArray(w * h);
  const a = new Uint8ClampedArray(w * h);
  const lum = new Float32Array(w * h);
  const sat = new Float32Array(w * h);
  const hue = new Float32Array(w * h);

  for (let y = 0; y < h; y += 1) {
    const sy = Math.min(height - 1, Math.round(y * step));
    for (let x = 0; x < w; x += 1) {
      const sx = Math.min(width - 1, Math.round(x * step));
      const source = (sy * width + sx) * 4;
      const target = y * w + x;
      const rr = data[source];
      const gg = data[source + 1];
      const bb = data[source + 2];
      r[target] = rr;
      g[target] = gg;
      b[target] = bb;
      a[target] = data[source + 3];
      lum[target] = 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;
      const max = Math.max(rr, gg, bb);
      const min = Math.min(rr, gg, bb);
      sat[target] = max === 0 ? 0 : (max - min) / max;
      if (max === min) {
        hue[target] = 0;
      } else if (max === rr) {
        hue[target] = ((60 * (gg - bb)) / (max - min) + 360) % 360;
      } else if (max === gg) {
        hue[target] = (60 * (bb - rr)) / (max - min) + 120;
      } else {
        hue[target] = (60 * (rr - gg)) / (max - min) + 240;
      }
    }
  }
  return { width: w, height: h, r, g, b, a, lum, sat, hue };
}

function paletteFrom(grid: Grid): PaletteColour[] {
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();
  let opaque = 0;
  for (let i = 0; i < grid.lum.length; i += 1) {
    if (grid.a[i] < 96) continue;
    opaque += 1;
    const key = ((grid.r[i] >> 5) << 6) | ((grid.g[i] >> 5) << 3) | (grid.b[i] >> 5);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count += 1;
      bucket.r += grid.r[i];
      bucket.g += grid.g[i];
      bucket.b += grid.b[i];
    } else {
      buckets.set(key, { count: 1, r: grid.r[i], g: grid.g[i], b: grid.b[i] });
    }
  }
  if (!opaque) return [];
  return [...buckets.values()]
    .sort((left, right) => right.count - left.count)
    .slice(0, 6)
    .map((bucket) => {
      const r = bucket.r / bucket.count;
      const g = bucket.g / bucket.count;
      const b = bucket.b / bucket.count;
      return { hex: toHex(r, g, b), name: nameColour(r, g, b), share: bucket.count / opaque };
    })
    .filter((colour) => colour.share >= 0.02);
}

interface Measurements {
  sharpness: number;
  acutance: number;
  edgeDensity: number;
  flatArea: number;
  noise: number;
  meanLum: number;
  contrast: number;
  shadowClip: number;
  highlightClip: number;
  saturation: number;
  colourfulness: number;
  transparentShare: number;
  sky: number;
  vegetation: number;
  skin: number;
  centreSkin: number;
  borderSkin: number;
  greyish: number;
  warm: number;
  cool: number;
  uniformBorder: boolean;
  borderMean: [number, number, number];
  symmetry: number;
  horizon: number;
  verticalStructure: number;
  horizontalStructure: number;
  bimodal: number;
  centreSharpness: number;
  borderSharpness: number;
  darkShare: number;
  brightShare: number;
}

function measure(grid: Grid): Measurements {
  const { width: w, height: h, r, g, b, a, lum, sat, hue } = grid;
  const step = Math.max(1, Math.round(Math.min(w, h) / 240));
  let opaque = 0;
  let transparent = 0;
  let sampledCount = 0;
  let lumSum = 0;
  let lumSq = 0;
  let satSum = 0;
  let shadow = 0;
  let highlight = 0;
  let darkCount = 0;
  let brightCount = 0;
  let skin = 0;
  let centreSkin = 0;
  let borderSkin = 0;
  let vegetation = 0;
  let greyish = 0;
  let warm = 0;
  let cool = 0;
  let rgMean = 0;
  let ybMean = 0;

  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = y * w + x;
      sampledCount += 1;
      if (a[i] < 96) {
        transparent += 1;
        continue;
      }
      opaque += 1;
      const value = lum[i];
      lumSum += value;
      lumSq += value * value;
      satSum += sat[i];
      if (value < 6) shadow += 1;
      if (value > 249) highlight += 1;
      if (value < 58) darkCount += 1;
      if (value > 198) brightCount += 1;
      const rr = r[i];
      const gg = g[i];
      const bb = b[i];
      rgMean += rr - gg;
      ybMean += 0.5 * (rr + gg) - bb;
      if (sat[i] < 0.09 && value > 18 && value < 242) greyish += 1;
      if (sat[i] > 0.2) {
        const hh = hue[i];
        if (hh < 65 || hh > 330) warm += 1;
        if (hh > 175 && hh < 275) cool += 1;
      }
      // Foliage: green channel clearly dominant with real saturation.
      if (gg > rr * 1.05 && gg > bb * 1.08 && sat[i] > 0.16 && value > 28) vegetation += 1;
      // Skin: three overlapping bands cover light, medium and deep tones.
      const maxC = Math.max(rr, gg, bb);
      const minC = Math.min(rr, gg, bb);
      const skinLike =
        rr > 62 &&
        gg > 26 &&
        bb > 12 &&
        rr >= gg &&
        gg >= bb - 12 &&
        rr - gg > 8 &&
        maxC - minC > 12 &&
        (rr - bb) > 18 &&
        hue[i] < 48;
      if (skinLike) {
        skin += 1;
        const dx = x / w - 0.5;
        const dy = y / h - 0.5;
        if (Math.abs(dx) < 0.28 && Math.abs(dy) < 0.3) centreSkin += 1;
        else borderSkin += 1;
      }
    }
  }

  const sampled = Math.max(1, opaque);
  const meanLum = lumSum / sampled;
  const contrast = Math.sqrt(Math.max(0, lumSq / sampled - meanLum * meanLum));

  // Grain is high frequency, and a raw Laplacian mistake it for detail. A 3x3
  // box pass first keeps sharpness honest on noisy files.
  const smooth = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          sum += lum[yy * w + xx];
          count += 1;
        }
      }
      smooth[y * w + x] = sum / count;
    }
  }

  // Laplacian variance and structure, measured on the same lattice.
  let lapSum = 0;
  let lapSq = 0;
  let lapCount = 0;
  let edgeCount = 0;
  let flat = 0;
  let flatCount = 0;
  let noiseSum = 0;
  let noiseCount = 0;
  let vertical = 0;
  let horizontal = 0;
  let horizonScore = 0;
  let horizonRow = 0;
  const gradients: number[] = [];
  const centreSharpSum: number[] = [0, 0];

  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      const i = y * w + x;
      if (a[i] < 96) continue;
      const left = smooth[i - 1];
      const right = smooth[i + 1];
      const up = smooth[i - w];
      const down = smooth[i + w];
      const lap = 4 * smooth[i] - left - right - up - down;
      const abs = Math.abs(lap);
      lapSum += lap;
      lapSq += lap * lap;
      lapCount += 1;
      const gradient = Math.abs(right - left) + Math.abs(down - up);
      gradients.push(gradient);
      if (gradient > 42) {
        edgeCount += 1;
        if (Math.abs(right - left) > Math.abs(down - up) * 1.6) vertical += 1;
        else if (Math.abs(down - up) > Math.abs(right - left) * 1.6) horizontal += 1;
      }
      const neighbourhoodSpread =
        Math.max(left, right, up, down, lum[i]) - Math.min(left, right, up, down, lum[i]);
      if (neighbourhoodSpread < 7) flat += 1;
      flatCount += 1;
      if (abs < 30) {
        noiseSum += abs * 2;
        noiseCount += 1;
      }
      if (y > h * 0.4 && y < h * 0.75) {
        const rowPressure = Math.abs(lum[i] - up) + Math.abs(lum[i] - down);
        if (rowPressure > horizonScore) {
          horizonScore = rowPressure;
          horizonRow = y;
        }
      }
      if (x > w * 0.3 && x < w * 0.7 && y > h * 0.3 && y < h * 0.7) {
        centreSharpSum[0] += abs;
        centreSharpSum[1] += 1;
      }
    }
  }

  const lapMean = lapCount ? lapSum / lapCount : 0;
  const sharpness = Math.max(0, lapCount ? lapSq / lapCount - lapMean * lapMean : 0);
  // Acutance: how strong the real edges are, independent of how many there are.
  gradients.sort((a, b) => a - b);
  const acutance = gradients.length ? gradients[Math.floor(gradients.length * 0.95)] : 0;

  // Border ring: a uniform ring means the subject was cut out or shot on a sweep.
  const ring = Math.max(2, Math.round(Math.min(w, h) * 0.06));
  let borderLumSum = 0;
  let borderLumSq = 0;
  let borderR = 0;
  let borderG = 0;
  let borderB = 0;
  let borderSat = 0;
  let borderN = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const inRing = x < ring || y < ring || x >= w - ring || y >= h - ring;
      if (!inRing) continue;
      const i = y * w + x;
      if (a[i] < 96) continue;
      borderLumSum += lum[i];
      borderLumSq += lum[i] * lum[i];
      borderR += r[i];
      borderG += g[i];
      borderB += b[i];
      borderSat += sat[i];
      borderN += 1;
    }
  }
  const borderMeanLum = borderN ? borderLumSum / borderN : 0;
  const borderStd = Math.sqrt(Math.max(0, borderLumSq / Math.max(1, borderN) - borderMeanLum ** 2));
  const uniformBorder = borderN > 0 && borderStd < 11 && borderSat / Math.max(1, borderN) < 0.14;

  // Sky: the top fifth, low texture, and either blue or clearly separated from
  // the ground. A white studio sweep is not a sky, so those are excluded.
  const transparentShareRaw = transparent / Math.max(1, sampledCount);
  let skyHits = 0;
  let blueHits = 0;
  let skySamples = 0;
  let topLum = 0;
  let topCount = 0;
  let bottomLum = 0;
  let bottomCount = 0;
  const topRows = Math.max(2, Math.round(h * 0.2));
  for (let y = 0; y < topRows && transparentShareRaw < 0.05; y += 1) {
    for (let x = 0; x < w; x += 2) {
      const i = y * w + x;
      if (a[i] < 96) continue;
      skySamples += 1;
      const localGradient =
        x > 0 && x < w - 1
          ? Math.abs(lum[i + 1] - lum[i - 1]) + (y < h - 1 ? Math.abs(lum[i + w] - lum[i]) : 0)
          : 0;
      const blueish = b[i] > r[i] + 12 && lum[i] > 84;
      const brightHaze = lum[i] > 196 && sat[i] < 0.14;
      if (blueish) blueHits += 1;
      if ((blueish || brightHaze) && localGradient < 42) skyHits += 1;
    }
  }
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 4) {
      const i = y * w + x;
      if (a[i] < 96) continue;
      if (y < h * 0.25) {
        topLum += lum[i];
        topCount += 1;
      } else if (y > h * 0.7) {
        bottomLum += lum[i];
        bottomCount += 1;
      }
    }
  }
  const topMean = topCount ? topLum / topCount : 0;
  const bottomMean = bottomCount ? bottomLum / bottomCount : 0;
  const blueShare = skySamples ? blueHits / skySamples : 0;
  const verticalSplit = Math.abs(topMean - bottomMean) > 16;
  const skyScoreRaw = skySamples ? skyHits / skySamples : 0;
  // Without blue anywhere and without a horizon, bright top rows are a sweep.
  const sky = transparentShareRaw > 0.05 ? 0 : blueShare > 0.22 || verticalSplit ? skyScoreRaw * (blueShare > 0.22 ? 1 : 0.8) : 0;

  // Symmetry: mirrored luminance difference, useful for logos and patterns.
  let mirrorDiff = 0;
  let mirrorCount = 0;
  for (let y = 0; y < h; y += 3) {
    for (let x = 0; x < Math.floor(w / 2); x += 3) {
      const left = y * w + x;
      const right = y * w + (w - 1 - x);
      mirrorDiff += Math.abs(lum[left] - lum[right]);
      mirrorCount += 1;
    }
  }

  let borderSharpSum = 0;
  let borderSharpCount = 0;
  for (let y = 1; y < h - 1; y += 3) {
    for (let x = 1; x < w - 1; x += 3) {
      const nearEdge = x < w * 0.18 || x > w * 0.82 || y < h * 0.18 || y > h * 0.82;
      if (!nearEdge) continue;
      const i = y * w + x;
      const lap = Math.abs(4 * lum[i] - lum[i - 1] - lum[i + 1] - lum[i - w] - lum[i + w]);
      borderSharpSum += lap;
      borderSharpCount += 1;
    }
  }

  const sampledOpq = Math.max(1, opaque);
  return {
    sharpness,
    acutance,
    edgeDensity: lapCount ? edgeCount / lapCount : 0,
    flatArea: flatCount ? flat / flatCount : 0,
    noise: noiseCount ? noiseSum / noiseCount : 0,
    meanLum,
    contrast,
    shadowClip: shadow / sampledOpq,
    highlightClip: highlight / sampledOpq,
    saturation: satSum / sampledOpq,
    colourfulness:
      Math.sqrt(Math.max(0, (rgMean / sampledOpq) ** 2 + (ybMean / sampledOpq) ** 2)) * 0.3 +
      contrast * 0.5,
    transparentShare: transparentShareRaw,
    sky,
    vegetation: vegetation / sampledOpq,
    skin: skin / sampledOpq,
    centreSkin: centreSkin / sampledOpq,
    borderSkin: borderSkin / sampledOpq,
    greyish: greyish / sampledOpq,
    warm: warm / sampledOpq,
    cool: cool / sampledOpq,
    uniformBorder,
    borderMean: [
      borderN ? borderR / borderN : 0,
      borderN ? borderG / borderN : 0,
      borderN ? borderB / borderN : 0,
    ],
    symmetry: mirrorCount ? clamp01(1 - mirrorDiff / mirrorCount / 60) : 0,
    horizon: horizonRow / h,
    verticalStructure: lapCount ? vertical / lapCount : 0,
    horizontalStructure: lapCount ? horizontal / lapCount : 0,
    bimodal:
      (darkCount / sampledOpq) * (brightCount / sampledOpq) * 4 +
      clamp01(lapCount ? edgeCount / lapCount : 0) * 0.4,
    centreSharpness: centreSharpSum[1] ? centreSharpSum[0] / centreSharpSum[1] : 0,
    borderSharpness: borderSharpCount ? borderSharpSum / borderSharpCount : 0,
    darkShare: darkCount / sampledOpq,
    brightShare: brightCount / sampledOpq,
  };
}

interface Vote {
  kind: SceneKind;
  score: number;
}

/** A page of text or a UI screenshot, measured by tone separation and edges. */
function isTextLayout(m: Measurements): boolean {
  return m.bimodal > 0.7 && m.darkShare > 0.04 && m.brightShare > 0.25 && m.edgeDensity > 0.05;
}

function classify(m: Measurements, quality: ImageQuality): { kind: SceneKind; confidence: number } {
  const votes: Vote[] = [
    { kind: 'cutout', score: 0 },
    { kind: 'portrait', score: 0 },
    { kind: 'people', score: 0 },
    { kind: 'landscape', score: 0 },
    { kind: 'nature', score: 0 },
    { kind: 'architecture', score: 0 },
    { kind: 'food', score: 0 },
    { kind: 'product', score: 0 },
    { kind: 'screenshot', score: 0 },
    { kind: 'document', score: 0 },
    { kind: 'illustration', score: 0 },
    { kind: 'pattern', score: 0 },
    { kind: 'abstract', score: 0 },
    { kind: 'photo', score: 0 },
  ];
  const add = (kind: SceneKind, score: number) => {
    const vote = votes.find((item) => item.kind === kind);
    if (vote) vote.score += score;
  };

  const flatArt = m.flatArea > 0.52 && m.edgeDensity < 0.16 && quality.noise < 6;
  const nearlyWhiteBorder =
    m.uniformBorder && m.borderMean.every((channel) => channel > 236) && m.borderMean[0] - m.borderMean[2] < 12;
  const transparent = m.transparentShare > 0.06;

  if (transparent) {
    add('cutout', 0.75);
    add('product', 0.2);
  }
  if (nearlyWhiteBorder) {
    add('product', 0.55);
    add('cutout', 0.25);
    add('document', 0.15);
  }
  if (m.uniformBorder && !nearlyWhiteBorder && m.edgeDensity < 0.12) {
    add('product', 0.3);
    add('screenshot', 0.15);
  }
  if (m.sky > 0.34) {
    add('landscape', 0.45 + m.sky * 0.5);
    add('nature', 0.15);
  }
  if (m.vegetation > 0.22) {
    add('nature', 0.35 + m.vegetation * 0.8);
    add('landscape', m.sky > 0.15 ? 0.3 : 0.12);
  }
  if (m.vegetation > 0.5 && quality.contrast < 60) add('pattern', 0.15);
  if (m.centreSkin > 0.055) {
    add('portrait', 0.4 + Math.min(0.55, m.centreSkin * 4));
    if (m.centreSkin > 0.18) add('people', 0.4);
  } else if (m.skin > 0.06) {
    add('people', 0.35);
  }
  if (quality.sharpness > 120 && m.centreSharpness > m.borderSharpness * 2.1 && m.centreSkin > 0.03) {
    add('portrait', 0.2);
  }
  if (m.verticalStructure > 0.16 && m.horizontalStructure > 0.12 && m.greyish > 0.3 && m.sky < 0.2) {
    add('architecture', 0.35);
  }
  if (m.warm > 0.4 && m.saturation > 0.3 && m.sky < 0.2 && m.vegetation < 0.2) {
    add('food', 0.25);
  }
  if (m.warm > 0.35 && m.brightShare > 0.4 && m.flatArea > 0.3) {
    add('product', 0.12);
  }
  const textLike = isTextLayout(m);
  if (textLike) {
    add('document', 0.85);
    add('screenshot', 0.3);
  }
  if (m.bimodal > 0.5 && m.uniformBorder && m.edgeDensity > 0.05) {
    add('screenshot', 0.25);
  }
  if (flatArt && !nearlyWhiteBorder && m.transparentShare < 0.05) {
    add('illustration', 0.5 + Math.min(0.4, (m.flatArea - 0.5) * 2));
    if (m.symmetry > 0.72) add('pattern', 0.35);
    // Smooth skin reads as flat colour, but the subject is still a person.
    if (m.centreSkin > 0.08) add('illustration', -0.45);
  }
  // Text pages are flat too, but they are not illustrations.
  if (textLike) add('illustration', -0.6);
  if (textLike) add('pattern', -0.4);
  if (m.symmetry > 0.8 && m.edgeDensity > 0.05 && m.flatArea > 0.4) add('pattern', 0.3);
  if (quality.colourfulness > 90 && m.edgeDensity < 0.09) add('abstract', 0.3);
  if (quality.colourfulness > 60 && m.flatArea > 0.4 && m.symmetry > 0.6) add('abstract', 0.15);
  add('photo', 0.28 + Math.min(0.3, m.edgeDensity * 1.2));

  const ranked = votes.sort((left, right) => right.score - left.score);
  const best = ranked[0];
  const second = ranked[1];
  const lead = best.score - second.score;
  const confidence = clamp01(0.42 + lead * 0.9);
  // Palette-only photographs should not be dressed up as a specific scene.
  const kind: SceneKind = best.score < 0.45 ? 'photo' : best.kind;
  return { kind, confidence: kind === 'photo' ? Math.max(0.4, 1 - lead) : confidence };
}

function labelsFor(
  kind: SceneKind,
  m: Measurements,
  palette: PaletteColour[],
  quality: ImageQuality,
  whiteBackdrop: boolean,
): string[] {
  const labels: string[] = [];
  const push = (label: string) => {
    if (!labels.includes(label)) labels.push(label);
  };
  if (kind === 'cutout') push('transparent cutout');
  if (m.uniformBorder && (kind === 'product' || kind === 'document' || kind === 'screenshot')) push('uniform background');
  if (m.sky > 0.34) push('open sky');
  if (m.vegetation > 0.22) push('foliage');
  if (m.centreSkin > 0.08) push('person in frame');
  if (m.warm > 0.4) push('warm tones');
  if (m.cool > 0.4) push('cool tones');
  if (m.greyish > 0.6) push('low saturation');
  if (m.flatArea > 0.52) push('flat colour areas');
  if (quality.sharpness < 45) push('soft focus');
  else if (quality.sharpness > 220) push('sharp detail');
  if (quality.noise > 13) push('visible grain');
  if (!whiteBackdrop && m.highlightClip > 0.02) push('clipped highlights');
  if (!whiteBackdrop && m.shadowClip > 0.03) push('crushed shadows');
  const paletteNames = [...new Set(palette.slice(0, 3).map((colour) => colour.name))];
  if (paletteNames.length) push(`${paletteNames.join(' and ')} palette`);
  return labels.slice(0, 5);
}

function findingsFor(
  kind: SceneKind,
  m: Measurements,
  quality: ImageQuality,
  megapixels: number,
  whiteBackdrop: boolean,
): string[] {
  const findings: string[] = [];
  if (quality.sharpness < 45) {
    findings.push('Soft focus. A restoration model recovers more than a plain resize.');
  } else if (quality.sharpness < 120) {
    findings.push('Acceptable sharpness. A gentle detail pass helps before enlarging.');
  }
  if (quality.noise > 13) {
    findings.push('Visible grain. Denoise lightly before enlarging to avoid amplifying it.');
  }
  if (!whiteBackdrop && m.highlightClip > 0.02) {
    findings.push('Highlights are clipped. Pull the exposure down before export.');
  }
  if (!whiteBackdrop && m.shadowClip > 0.03) {
    findings.push('Shadows are crushed. Lift them slightly to keep detail.');
  }
  if (kind === 'document' || kind === 'screenshot') {
    findings.push('Text and thin lines reproduce best with an edge aware model, never a generative one.');
  }
  if (kind === 'illustration' || kind === 'pattern') {
    findings.push('Flat artwork. Enlarge with an edge preserving model to keep outlines clean.');
  }
  if (kind === 'cutout') {
    findings.push('Transparent edges stay clean only in PNG or WebP.');
  }
  if (megapixels < 4 && (kind === 'landscape' || kind === 'nature' || kind === 'photo')) {
    findings.push('Below most portal minimums. Enlarge to at least 4 MP before submitting.');
  }
  if (!findings.length) {
    findings.push('Solid source. A faithful resize is enough for stock size.');
  }
  return findings.slice(0, 3);
}

/** Confidence and signal strengths for an already measured frame. */
function confidenceFor(m: Measurements, quality: ImageQuality): number {
  return Number(classify(m, quality).confidence.toFixed(2));
}

/** Analyse a decoded RGBA buffer. Pure: no DOM, no canvas, easy to test. */
export function analysePixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): ImageInsight {
  const grid = toGrid(data, width, height);
  const m = measure(grid);
  const palette = paletteFrom(grid);

  const sharpnessLabel: ImageQuality['sharpnessLabel'] =
    m.acutance < 16 ? 'soft' : m.acutance < 34 ? 'acceptable' : 'crisp';
  const noiseLabel: ImageQuality['noiseLabel'] =
    m.noise > 13 ? 'visible grain' : m.noise > 7 ? 'light grain' : 'clean';

  // A white studio sweep or a page of text is not an overexposed photograph.
  const whiteBackdrop =
    (m.uniformBorder && m.borderMean.every((channel) => channel > 232)) ||
    isTextLayout(m) ||
    (m.meanLum > 212 && m.highlightClip > 0.35);
  const exposurePenalty = whiteBackdrop ? 0 : (m.shadowClip + m.highlightClip) * 60;
  const sharpnessScore =
    m.sharpness >= 120 ? 30 : m.sharpness >= 45 ? 22 : Math.max(6, (m.sharpness / 45) * 20);
  const noisePenalty = Math.min(25, m.noise * 1.6);
  const contrastScore = m.contrast > 28 && m.contrast < 90 ? 18 : 12;
  const colourScore = m.saturation > 0.12 && m.saturation < 0.72 ? 14 : 9;
  const score = Math.round(
    Math.max(0, Math.min(100, sharpnessScore + contrastScore + colourScore + 22 - noisePenalty - exposurePenalty)),
  );

  const quality: ImageQuality = {
    sharpness: Number(m.sharpness.toFixed(1)),
    sharpnessLabel,
    noise: Number(m.noise.toFixed(2)),
    noiseLabel,
    meanLuma: Number(m.meanLum.toFixed(1)),
    contrast: Number(m.contrast.toFixed(1)),
    shadowClip: Number(m.shadowClip.toFixed(4)),
    highlightClip: Number(m.highlightClip.toFixed(4)),
    saturation: Number(m.saturation.toFixed(3)),
    colourfulness: Number(m.colourfulness.toFixed(1)),
    score,
  };

  const { kind } = classify(m, quality);
  const megapixels = (width * height) / 1_000_000;

  return {
    width,
    height,
    megapixels: Number(megapixels.toFixed(2)),
    aspectRatio: Number((width / Math.max(1, height)).toFixed(3)),
    orientation: width / height > 1.06 ? 'landscape' : width / height < 0.94 ? 'portrait' : 'square',
    kind,
    confidence: confidenceFor(m, quality),
    labels: labelsFor(kind, m, palette, quality, whiteBackdrop),
    signals: [
      { label: 'sharpness', strength: clamp01(m.sharpness / 240) },
      { label: 'edge density', strength: clamp01(m.edgeDensity / 0.25) },
      { label: 'flat areas', strength: m.flatArea },
      { label: 'sky', strength: m.sky },
      { label: 'foliage', strength: clamp01(m.vegetation / 0.5) },
      { label: 'skin tones', strength: clamp01(m.skin / 0.3) },
      { label: 'symmetry', strength: m.symmetry },
    ],
    palette,
    quality,
    hasTransparency: m.transparentShare > 0.02,
    flatArt: m.flatArea > 0.52 && m.edgeDensity < 0.16 && m.transparentShare < 0.05 && !isTextLayout(m),
    uniformBackground: m.uniformBorder,
    backgroundHex: m.uniformBorder
      ? toHex(m.borderMean[0], m.borderMean[1], m.borderMean[2])
      : null,
    findings: findingsFor(kind, m, quality, megapixels, whiteBackdrop),
    hasFineText: isTextLayout(m),
    subjectIsolation: Number((m.centreSharpness / Math.max(0.5, m.borderSharpness)).toFixed(2)),
    analysedAt: Date.now(),
  };
}
