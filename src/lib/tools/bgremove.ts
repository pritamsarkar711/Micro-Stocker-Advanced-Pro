import type { GoogleIconName } from '@/components/ui/GoogleIcon';
import type { ModelInstallSpec } from '@/lib/desktop';
import { installedModelUrl, installModelInApp, readInstalledModelBytes } from '@/lib/modelStore';
import { loadOrt } from './onnx';

/**
 * Local background removal engine. Model weights have separate terms.
 *
 * Includes two instant zero download algorithms (Smart Border Flood Matting and
 * Chroma Spill Cutout) plus 14 free open source ONNX neural segmentation models
 * (U2Net, U2Netp, Silueta, ISNet General, ISNet Anime, U2Net Human/Portrait/Cloth
 * and BiRefNet Tiny/General/Portrait/DIS/HR/Matting) downloaded, cached and
 * executed directly inside the app via ONNX Runtime WebAssembly.
 */

export type BgPurpose = 'all' | 'general' | 'portrait' | 'product' | 'anime' | 'precision' | 'fast';

export const BG_PURPOSES: Array<{ id: BgPurpose; label: string; icon: GoogleIconName }> = [
  { id: 'all', label: 'All', icon: 'apps' },
  { id: 'general', label: 'General', icon: 'layers' },
  { id: 'product', label: 'Product', icon: 'inventory_2' },
  { id: 'portrait', label: 'Portrait & Hair', icon: 'face' },
  { id: 'anime', label: 'Anime & Art', icon: 'brush' },
  { id: 'precision', label: 'High Precision', icon: 'center_focus_strong' },
  { id: 'fast', label: 'Fast', icon: 'speed' },
];

export interface BgModel {
  id: string;
  name: string;
  kind: 'builtin' | 'onnx';
  purpose: Exclude<BgPurpose, 'all'>;
  purposes: Array<Exclude<BgPurpose, 'all'>>;
  icon: GoogleIconName;
  license: string;
  /** The heavy models are a plan feature: no credits, subscription required. */
  premium?: boolean;
  inputSize: number;
  sizeMB: number;
  fileName?: string;
  url?: string;
  norm?: 'imagenet' | 'isnet';
}

const REMBG_BASE = 'https://github.com/danielgatis/rembg/releases/download/v0.0.0';

export const BG_MODELS: BgModel[] = [
  {
    id: 'studio-cutout',
    name: 'Studio Smart Cutout',
    kind: 'builtin',
    purpose: 'product',
    purposes: ['product', 'general', 'fast'],
    icon: 'content_cut',
    license: 'Built in',
    inputSize: 1024,
    sizeMB: 0,
  },
  {
    id: 'chroma-pro',
    name: 'Chroma & Solid Key',
    kind: 'builtin',
    purpose: 'fast',
    purposes: ['fast', 'portrait', 'product'],
    icon: 'colorize',
    license: 'Built in',
    inputSize: 1024,
    sizeMB: 0,
  },
  {
    id: 'u2netp',
    name: 'U2Netp Compact',
    kind: 'onnx',
    purpose: 'fast',
    purposes: ['fast', 'general', 'product'],
    icon: 'speed',
    license: 'Check model terms',
    inputSize: 320,
    sizeMB: 4.4,
    fileName: 'u2netp.onnx',
    url: `${REMBG_BASE}/u2netp.onnx`,
    norm: 'imagenet',
  },
  {
    id: 'silueta',
    name: 'Silueta Object',
    kind: 'onnx',
    purpose: 'general',
    purposes: ['general', 'fast', 'portrait'],
    icon: 'person',
    license: 'Check model terms',
    inputSize: 320,
    sizeMB: 42,
    fileName: 'silueta.onnx',
    url: `${REMBG_BASE}/silueta.onnx`,
    norm: 'imagenet',
  },
  {
    id: 'u2net',
    name: 'U2Net Standard',
    kind: 'onnx',
    purpose: 'general',
    purposes: ['general', 'product'],
    icon: 'layers',
    license: 'Check model terms',
    inputSize: 320,
    sizeMB: 168,
    fileName: 'u2net.onnx',
    url: `${REMBG_BASE}/u2net.onnx`,
    norm: 'imagenet',
  },
  {
    id: 'isnet-general-use',
    premium: true,
    name: 'ISNet General DIS',
    kind: 'onnx',
    purpose: 'product',
    purposes: ['product', 'general', 'precision'],
    icon: 'inventory_2',
    license: 'Check model terms',
    inputSize: 1024,
    sizeMB: 170,
    fileName: 'isnet-general-use.onnx',
    url: `${REMBG_BASE}/isnet-general-use.onnx`,
    norm: 'isnet',
  },
  {
    id: 'isnet-anime',
    premium: true,
    name: 'ISNet Anime & Character',
    kind: 'onnx',
    purpose: 'anime',
    purposes: ['anime', 'precision'],
    icon: 'brush',
    license: 'Check model terms',
    inputSize: 1024,
    sizeMB: 168,
    fileName: 'isnet-anime.onnx',
    url: `${REMBG_BASE}/isnet-anime.onnx`,
    norm: 'isnet',
  },
  {
    id: 'u2net-human-seg',
    name: 'U2Net Human Portrait',
    kind: 'onnx',
    purpose: 'portrait',
    purposes: ['portrait'],
    icon: 'face',
    license: 'Check model terms',
    inputSize: 320,
    sizeMB: 168,
    fileName: 'u2net_human_seg.onnx',
    url: `${REMBG_BASE}/u2net_human_seg.onnx`,
    norm: 'imagenet',
  },
  {
    id: 'u2net-portrait-matting',
    premium: true,
    name: 'U2Net Hair Matting',
    kind: 'onnx',
    purpose: 'portrait',
    purposes: ['portrait', 'precision'],
    icon: 'brush',
    license: 'Check model terms',
    inputSize: 512,
    sizeMB: 168,
    fileName: 'u2net-portrait-matting.onnx',
    url: `${REMBG_BASE}/u2net-portrait-matting.onnx`,
    norm: 'imagenet',
  },
  {
    id: 'u2net-cloth-seg',
    premium: true,
    name: 'U2Net Apparel & Cloth',
    kind: 'onnx',
    purpose: 'product',
    purposes: ['product'],
    icon: 'sell',
    license: 'Check model terms',
    inputSize: 768,
    sizeMB: 168,
    fileName: 'u2net_cloth_seg.onnx',
    url: `${REMBG_BASE}/u2net_cloth_seg.onnx`,
    norm: 'imagenet',
  },
  {
    id: 'birefnet-tiny',
    premium: true,
    name: 'BiRefNet Swin Tiny',
    kind: 'onnx',
    purpose: 'precision',
    purposes: ['precision', 'general', 'product', 'fast'],
    icon: 'workspace_premium',
    license: 'Check model terms',
    inputSize: 1024,
    sizeMB: 214,
    fileName: 'BiRefNet-general-bb_swin_v1_tiny-epoch_232.onnx',
    url: `${REMBG_BASE}/BiRefNet-general-bb_swin_v1_tiny-epoch_232.onnx`,
    norm: 'imagenet',
  },
  {
    id: 'birefnet-general',
    premium: true,
    name: 'BiRefNet General',
    kind: 'onnx',
    purpose: 'precision',
    purposes: ['precision', 'general', 'product'],
    icon: 'high_quality',
    license: 'Check model terms',
    inputSize: 1024,
    sizeMB: 928,
    fileName: 'BiRefNet-general-epoch_244.onnx',
    url: `${REMBG_BASE}/BiRefNet-general-epoch_244.onnx`,
    norm: 'imagenet',
  },
  {
    id: 'birefnet-portrait',
    premium: true,
    name: 'BiRefNet Portrait',
    kind: 'onnx',
    purpose: 'portrait',
    purposes: ['portrait', 'precision'],
    icon: 'account_circle',
    license: 'Check model terms',
    inputSize: 1024,
    sizeMB: 928,
    fileName: 'BiRefNet-portrait-epoch_150.onnx',
    url: `${REMBG_BASE}/BiRefNet-portrait-epoch_150.onnx`,
    norm: 'imagenet',
  },
  {
    id: 'birefnet-dis',
    premium: true,
    name: 'BiRefNet Fine Detail DIS',
    kind: 'onnx',
    purpose: 'precision',
    purposes: ['precision', 'product'],
    icon: 'center_focus_strong',
    license: 'Check model terms',
    inputSize: 1024,
    sizeMB: 928,
    fileName: 'BiRefNet-DIS-epoch_590.onnx',
    url: `${REMBG_BASE}/BiRefNet-DIS-epoch_590.onnx`,
    norm: 'imagenet',
  },
  {
    id: 'birefnet-hr',
    premium: true,
    name: 'BiRefNet HR 2K',
    kind: 'onnx',
    purpose: 'precision',
    purposes: ['precision', 'general'],
    icon: '4k',
    license: 'Check model terms',
    inputSize: 2048,
    sizeMB: 1048,
    fileName: 'BiRefNet_HR-general-epoch_130.onnx',
    url: `${REMBG_BASE}/BiRefNet_HR-general-epoch_130.onnx`,
    norm: 'imagenet',
  },
  {
    id: 'birefnet-hr-matting',
    premium: true,
    name: 'BiRefNet HR Alpha Matting',
    kind: 'onnx',
    purpose: 'precision',
    purposes: ['precision', 'portrait', 'product'],
    icon: 'filter_center_focus',
    license: 'Check model terms',
    inputSize: 2048,
    sizeMB: 1048,
    fileName: 'BiRefNet_HR-matting-epoch_135.onnx',
    url: `${REMBG_BASE}/BiRefNet_HR-matting-epoch_135.onnx`,
    norm: 'imagenet',
  },
];

export function buildBgInstallSpec(model: BgModel): ModelInstallSpec | null {
  if (model.kind === 'builtin' || !model.url || !model.fileName) return null;
  return {
    id: model.id,
    kind: 'bg-remove',
    primaryFile: model.fileName,
    approxBytes: Math.round(model.sizeMB * 1_048_576),
    files: [
      {
        url: model.url,
        name: model.fileName,
        label: model.name,
      },
    ],
  };
}

export interface BgRemoveOptions {
  modelId: string;
  outFormat: 'png' | 'webp' | 'jpg';
  backdrop: 'transparent' | 'white' | 'black' | 'custom';
  customColor?: string;
  tolerance: number; // 10..90 for builtin sensitivity / edge softness
  feather: number; // 0..6 px
  quality: number; // 0.6..1
  onProgress?: (ratio: number, label: string) => void;
}

export interface BgRemoveResult {
  blob: Blob;
  filename: string;
  width: number;
  height: number;
  sizeBytes: number;
  usedNeural: boolean;
  /** Uncomposited PNG retained for non-destructive mask editing. */
  transparentBlob: Blob;
}

/* -------------------------------------------------------------------------- */
/* Built in background segmentation (border connected color model + matting)  */
/* -------------------------------------------------------------------------- */

function computeBuiltinAlpha(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  mode: 'studio-cutout' | 'chroma-pro',
  tolerance: number,
): Uint8ClampedArray {
  const total = width * height;
  const alpha = new Uint8ClampedArray(total);
  alpha.fill(255);

  // Sample up to 16 perimeter clusters to model uneven lighting and studio gradients.
  const samples: Array<[number, number, number]> = [];
  const stepX = Math.max(1, Math.floor(width / 12));
  const stepY = Math.max(1, Math.floor(height / 12));
  const pushPx = (x: number, y: number) => {
    const idx = (y * width + x) * 4;
    if (rgba[idx + 3] < 20) return;
    samples.push([rgba[idx], rgba[idx + 1], rgba[idx + 2]]);
  };
  for (let x = 0; x < width; x += stepX) {
    pushPx(x, 0);
    pushPx(x, height - 1);
  }
  for (let y = 0; y < height; y += stepY) {
    pushPx(0, y);
    pushPx(width - 1, y);
  }
  if (!samples.length) {
    for (let p = 0; p < total; p++) alpha[p] = rgba[p * 4 + 3];
    return alpha;
  }

  // Subsample to 12 representative border colors
  const palette: Array<[number, number, number]> = [];
  const stride = Math.max(1, Math.floor(samples.length / 12));
  for (let i = 0; i < samples.length && palette.length < 12; i += stride) {
    palette.push(samples[i]);
  }

  const colorDist = (r: number, g: number, b: number): number => {
    let best = 1e9;
    for (let i = 0; i < palette.length; i++) {
      const [pr, pg, pb] = palette[i];
      const rMean = (r + pr) * 0.5;
      const dr = r - pr;
      const dg = g - pg;
      const db = b - pb;
      // Redmean perceptual color distance
      const d = Math.sqrt(
        (2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db,
      );
      if (d < best) best = d;
    }
    return best;
  };

  const hardThresh = tolerance * 2.1;
  const softThresh = hardThresh * 1.48;

  if (mode === 'chroma-pro') {
    // Global chroma key across whole frame (handles holes inside hair, handles, chairs)
    for (let p = 0; p < total; p++) {
      const i = p * 4;
      if (rgba[i + 3] === 0) {
        alpha[p] = 0;
        continue;
      }
      const d = colorDist(rgba[i], rgba[i + 1], rgba[i + 2]);
      if (d <= hardThresh) alpha[p] = 0;
      else if (d < softThresh) {
        alpha[p] = Math.round(((d - hardThresh) / (softThresh - hardThresh)) * 255);
      } else {
        alpha[p] = rgba[i + 3];
      }
    }
    return alpha;
  }

  // Border connected flood fill so matching colors inside the subject stay preserved.
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  const seed = (p: number) => {
    if (visited[p]) return;
    const i = p * 4;
    const d = colorDist(rgba[i], rgba[i + 1], rgba[i + 2]);
    if (rgba[i + 3] < 20 || d <= hardThresh) {
      visited[p] = 1;
      alpha[p] = 0;
      queue[tail++] = p;
    }
  };

  for (let x = 0; x < width; x++) {
    seed(x);
    seed((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    seed(y * width);
    seed(y * width + width - 1);
  }

  const stepLimit = tolerance * 0.52;
  while (head < tail) {
    const p = queue[head++];
    const x = p % width;
    const y = (p - x) / width;
    const pi = p * 4;
    const pr = rgba[pi];
    const pg = rgba[pi + 1];
    const pb = rgba[pi + 2];

    const tryNext = (np: number) => {
      if (visited[np]) return;
      const ni = np * 4;
      if (rgba[ni + 3] < 20) {
        visited[np] = 1;
        alpha[np] = 0;
        queue[tail++] = np;
        return;
      }
      const localStep =
        Math.abs(rgba[ni] - pr) + Math.abs(rgba[ni + 1] - pg) + Math.abs(rgba[ni + 2] - pb);
      const globalD = colorDist(rgba[ni], rgba[ni + 1], rgba[ni + 2]);
      if (globalD <= hardThresh && localStep <= stepLimit * 3) {
        visited[np] = 1;
        alpha[np] = 0;
        queue[tail++] = np;
      } else if (globalD < softThresh) {
        // Soft anti aliased boundary pixel
        const ramp = Math.round(((globalD - hardThresh) / (softThresh - hardThresh)) * 255);
        if (ramp < alpha[np]) alpha[np] = Math.max(0, Math.min(255, ramp));
      }
    };

    if (x > 0) tryNext(p - 1);
    if (x + 1 < width) tryNext(p + 1);
    if (y > 0) tryNext(p - width);
    if (y + 1 < height) tryNext(p + width);
  }

  return alpha;
}

function boxBlurAlpha(alpha: Uint8ClampedArray, w: number, h: number, radius: number): Uint8ClampedArray {
  const r = Math.round(radius);
  if (r <= 0) return alpha;
  const tmp = new Uint8ClampedArray(alpha.length);
  const out = new Uint8ClampedArray(alpha.length);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      const lo = Math.max(0, x - r);
      const hi = Math.min(w - 1, x + r);
      for (let xx = lo; xx <= hi; xx++) {
        sum += alpha[row + xx];
        count++;
      }
      tmp[row + x] = (sum / count) | 0;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let sum = 0;
      let count = 0;
      const lo = Math.max(0, y - r);
      const hi = Math.min(h - 1, y + r);
      for (let yy = lo; yy <= hi; yy++) {
        sum += tmp[yy * w + x];
        count++;
      }
      out[y * w + x] = (sum / count) | 0;
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* ONNX Runtime WebAssembly inference                                         */
/* -------------------------------------------------------------------------- */

const sessionCache = new Map<string, unknown>();

async function runOnnxMask(
  model: BgModel,
  bitmap: ImageBitmap,
  onProgress?: (ratio: number, label: string) => void,
): Promise<{ mask: Uint8ClampedArray; size: number }> {
  const fileName = model.fileName!;
  // On the phone the file is already in app storage; hand ONNX Runtime a local
  // URL so a 100 MB checkpoint never has to be decoded into the JS heap.
  let source: Uint8Array | string | null = await installedModelUrl(model.id, fileName);
  let bytes: Uint8Array | null = null;
  if (!source) {
    try {
      bytes = await readInstalledModelBytes(model.id, fileName);
    } catch {
      const spec = buildBgInstallSpec(model);
      if (!spec) throw new Error('Model specification missing');
      onProgress?.(0.08, `Downloading ${model.name}`);
      const installed = await installModelInApp(spec);
      if (!installed.ok) throw new Error(installed.error || 'Model download failed');
      const url = await installedModelUrl(model.id, fileName);
      if (url) source = url;
      else bytes = await readInstalledModelBytes(model.id, fileName);
    }
  }

  onProgress?.(0.32, `Loading ${model.name}`);
  const ort = await loadOrt();

  type OrtSession = {
    inputNames: readonly string[];
    outputNames: readonly string[];
    run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: Float32Array; dims: readonly number[] }>>;
  };

  let session = sessionCache.get(model.id) as OrtSession | undefined;
  if (!session) {
    const modelSource = source ?? bytes;
    if (!modelSource) throw new Error('Model file is missing. Reinstall it from the model list.');
    session = (await ort.InferenceSession.create(modelSource as Uint8Array, {
      executionProviders: ['wasm'],
    })) as unknown as OrtSession;
    sessionCache.set(model.id, session);
  }

  const size = model.inputSize;
  const prep = document.createElement('canvas');
  prep.width = size;
  prep.height = size;
  const pctx = prep.getContext('2d')!;
  pctx.imageSmoothingEnabled = true;
  pctx.imageSmoothingQuality = 'high';
  pctx.drawImage(bitmap, 0, 0, size, size);
  const { data } = pctx.getImageData(0, 0, size, size);

  const plane = size * size;
  const tensorData = new Float32Array(3 * plane);
  const mean = model.norm === 'isnet' ? [0.5, 0.5, 0.5] : [0.485, 0.456, 0.406];
  const std = model.norm === 'isnet' ? [1.0, 1.0, 1.0] : [0.229, 0.224, 0.225];
  for (let p = 0; p < plane; p++) {
    tensorData[p] = (data[p * 4] / 255 - mean[0]) / std[0];
    tensorData[plane + p] = (data[p * 4 + 1] / 255 - mean[1]) / std[1];
    tensorData[plane * 2 + p] = (data[p * 4 + 2] / 255 - mean[2]) / std[2];
  }

  onProgress?.(0.58, `Segmenting with ${model.name}`);
  const inputName = session.inputNames[0];
  const inputTensor = new ort.Tensor('float32', tensorData, [1, 3, size, size]);
  const outputs = await session.run({ [inputName]: inputTensor });
  const firstOut = outputs[session.outputNames[0]];
  const raw = firstOut.data;

  const mask = postprocessBgMask(model, raw, firstOut.dims);
  return { mask, size };
}

/** Convert model-specific ONNX outputs into a single alpha plane. */
export function postprocessBgMask(model: BgModel, raw: Float32Array, dims: readonly number[]): Uint8ClampedArray {
  const size = model.inputSize;
  const plane = size * size;
  if (dims.length !== 4 || dims[0] !== 1 || dims[2] !== size || dims[3] !== size || raw.length < plane * dims[1]) {
    throw new Error(`Unexpected output shape from ${model.name}: ${dims.join(' × ')}`);
  }
  if (model.id === 'u2net-cloth-seg') {
    if (dims[1] !== 4) throw new Error('Unexpected clothing segmentation output');
    // Channel zero is background, channels one to three are apparel classes.
    const mask = new Uint8ClampedArray(plane);
    for (let p = 0; p < plane; p++) {
      let label = 0;
      let best = raw[p];
      for (let channel = 1; channel < 4; channel++) {
        const value = raw[channel * plane + p];
        if (value > best) { best = value; label = channel; }
      }
      mask[p] = label === 0 ? 0 : 255;
    }
    return mask;
  }
  let minVal = Infinity, maxVal = -Infinity;
  for (let i = 0; i < plane; i++) {
    if (!Number.isFinite(raw[i])) throw new Error(`${model.name} returned invalid mask values`);
    minVal = Math.min(minVal, raw[i]); maxVal = Math.max(maxVal, raw[i]);
  }
  const needsSigmoid = minVal < -0.05 || maxVal > 1.05;
  const probs = new Float32Array(plane);
  minVal = Infinity; maxVal = -Infinity;
  for (let i = 0; i < plane; i++) {
    const v = needsSigmoid ? 1 / (1 + Math.exp(-raw[i])) : raw[i];
    probs[i] = v; minVal = Math.min(minVal, v); maxVal = Math.max(maxVal, v);
  }
  const mask = new Uint8ClampedArray(plane);
  if (maxVal - minVal < 1e-6) {
    mask.fill(Math.round(Math.max(0, Math.min(1, minVal)) * 255));
  } else {
    for (let i = 0; i < plane; i++) mask[i] = Math.round((probs[i] - minVal) / (maxVal - minVal) * 255);
  }
  return mask;
}

/* -------------------------------------------------------------------------- */
/* Public entry point                                                         */
/* -------------------------------------------------------------------------- */

export async function removeImageBackground(
  file: Blob,
  sourceName: string,
  options: BgRemoveOptions,
): Promise<BgRemoveResult> {
  const model = BG_MODELS.find((m) => m.id === options.modelId) ?? BG_MODELS[0];
  const bitmap = await createImageBitmap(file);

  try {
    const width = bitmap.width;
    const height = bitmap.height;
    let usedNeural = false;

    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = width;
    fullCanvas.height = height;
    const ctx = fullCanvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    const fullImg = ctx.getImageData(0, 0, width, height);

    if (model.kind === 'onnx') {
      const { mask, size } = await runOnnxMask(model, bitmap, options.onProgress);
      options.onProgress?.(0.84, 'Applying high resolution mask');
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = size;
      maskCanvas.height = size;
      const mctx = maskCanvas.getContext('2d')!;
      const mImg = mctx.createImageData(size, size);
      for (let p = 0; p < mask.length; p++) {
        const a = mask[p];
        mImg.data[p * 4] = 255;
        mImg.data[p * 4 + 1] = 255;
        mImg.data[p * 4 + 2] = 255;
        mImg.data[p * 4 + 3] = a;
      }
      mctx.putImageData(mImg, 0, 0);

      const upMask = document.createElement('canvas');
      upMask.width = width;
      upMask.height = height;
      const uctx = upMask.getContext('2d')!;
      uctx.imageSmoothingEnabled = model.id !== 'u2net-cloth-seg';
      uctx.imageSmoothingQuality = 'high';
      if (options.feather > 0) uctx.filter = `blur(${options.feather}px)`;
      uctx.drawImage(maskCanvas, 0, 0, width, height);
      const upData = uctx.getImageData(0, 0, width, height).data;
      for (let p = 0; p < width * height; p++) {
        fullImg.data[p * 4 + 3] = Math.min(fullImg.data[p * 4 + 3], upData[p * 4 + 3]);
      }
      usedNeural = true;
    } else {
      options.onProgress?.(0.3, 'Analyzing background colors');
      // Run mask on up to 1400 px working buffer for instant UI responsiveness, then upsample cleanly.
      const maxWork = 1400;
      const ratio = Math.min(1, maxWork / Math.max(width, height));
      const workW = Math.max(1, Math.round(width * ratio));
      const workH = Math.max(1, Math.round(height * ratio));
      let workData = fullImg.data;
      if (ratio < 1) {
        const workCanvas = document.createElement('canvas');
        workCanvas.width = workW;
        workCanvas.height = workH;
        const wctx = workCanvas.getContext('2d')!;
        wctx.drawImage(bitmap, 0, 0, workW, workH);
        workData = wctx.getImageData(0, 0, workW, workH).data;
      }

      let alpha = computeBuiltinAlpha(
        workData,
        workW,
        workH,
        model.id === 'chroma-pro' ? 'chroma-pro' : 'studio-cutout',
        options.tolerance,
      );
      if (options.feather > 0) {
        alpha = boxBlurAlpha(alpha, workW, workH, options.feather);
      }

      if (ratio === 1) {
        for (let p = 0; p < alpha.length; p++) {
          fullImg.data[p * 4 + 3] = Math.min(fullImg.data[p * 4 + 3], alpha[p]);
        }
      } else {
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = workW;
        maskCanvas.height = workH;
        const mctx = maskCanvas.getContext('2d')!;
        const mImg = mctx.createImageData(workW, workH);
        for (let p = 0; p < alpha.length; p++) {
          mImg.data[p * 4 + 3] = alpha[p];
        }
        mctx.putImageData(mImg, 0, 0);
        const up = document.createElement('canvas');
        up.width = width;
        up.height = height;
        const uctx = up.getContext('2d')!;
        uctx.imageSmoothingEnabled = true;
        uctx.imageSmoothingQuality = 'high';
        uctx.drawImage(maskCanvas, 0, 0, width, height);
        const upAlpha = uctx.getImageData(0, 0, width, height).data;
        for (let p = 0; p < width * height; p++) {
          fullImg.data[p * 4 + 3] = Math.min(fullImg.data[p * 4 + 3], upAlpha[p * 4 + 3]);
        }
      }
    }

    ctx.putImageData(fullImg, 0, 0);

    const transparentBlob = await new Promise<Blob>((resolve, reject) =>
      fullCanvas.toBlob((b) => b ? resolve(b) : reject(new Error('Failed to encode transparent cutout')), 'image/png'),
    );

    // Composite over chosen backdrop if requested or exporting JPG.
    const needsBackdrop = options.backdrop !== 'transparent' || options.outFormat === 'jpg';
    let exportCanvas = fullCanvas;
    if (needsBackdrop) {
      const bgColor =
        options.backdrop === 'black'
          ? '#000000'
          : options.backdrop === 'custom'
            ? options.customColor || '#ffffff'
            : '#ffffff';
      const comp = document.createElement('canvas');
      comp.width = width;
      comp.height = height;
      const cctx = comp.getContext('2d')!;
      cctx.fillStyle = bgColor;
      cctx.fillRect(0, 0, width, height);
      cctx.drawImage(fullCanvas, 0, 0);
      exportCanvas = comp;
    }

    options.onProgress?.(0.95, 'Encoding cutout');
    const mime =
      options.outFormat === 'jpg'
        ? 'image/jpeg'
        : options.outFormat === 'webp'
          ? 'image/webp'
          : 'image/png';
    const blob = await new Promise<Blob>((resolve, reject) =>
      exportCanvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Failed to encode cutout image'))),
        mime,
        options.outFormat === 'png' ? undefined : options.quality,
      ),
    );

    const dot = sourceName.lastIndexOf('.');
    const stem = (dot > 0 ? sourceName.slice(0, dot) : sourceName).replace(/[-–—\s]+/g, '_');
    options.onProgress?.(1, 'Complete');
    return {
      blob,
      filename: `${stem}_cutout.${options.outFormat}`,
      width,
      height,
      sizeBytes: blob.size,
      usedNeural,
      transparentBlob,
    };
  } finally {
    bitmap.close();
  }
}
