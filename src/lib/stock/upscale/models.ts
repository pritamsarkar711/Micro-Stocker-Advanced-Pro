/**
 * Open-source upscaling model catalogue.
 *
 * Only models whose licence permits commercial use are listed. The official
 * Real-ESRGAN NCNN-Vulkan portable builds (BSD-3-Clause, code AND weights)
 * ship five model files inside the zip, so one download unlocks them all.
 *
 * Source: github.com/xinntao/Real-ESRGAN releases (v0.2.5.0, 2022-04-24).
 *
 * INVARIANT — the NCNN binary resolves weights by convention, not by argument:
 *     <models>/<modelId>-x<scale>.param / .bin
 * so `scale` below must be the scale baked into the file name. There is no
 * `realesrgan-x2plus` in the NCNN build (that is a Python .pth model), and
 * `-s 2 -n realesrgan-x4plus` looks for `realesrgan-x4plus-x2.param`, which
 * does not exist and makes the binary exit. Every listed model is 4× only;
 * smaller steps are produced by passing a different `-s` *after* the weights
 * are resolved — see engine.ts, which never does that.
 */

export interface UpscaleModel {
  id: string;
  label: string;
  /** Scale baked into the shipped .param/.bin file. */
  nativeScale: 4;
  bestFor: string;
  license: string;
  commercialUse: true;
  sizeMB: number;
  bundled: true;
  notes?: string;
}

export const UPSCALE_MODELS: UpscaleModel[] = [
  {
    id: 'realesrgan-x4plus',
    label: 'Real-ESRGAN x4plus',
    nativeScale: 4,
    bestFor: 'General photos, mixed content (default)',
    license: 'BSD-3-Clause',
    commercialUse: true,
    sizeMB: 64,
    bundled: true,
  },
  {
    id: 'realesrnet-x4plus',
    label: 'RealESRNet x4plus',
    nativeScale: 4,
    bestFor: 'Conservative — no invented detail',
    license: 'BSD-3-Clause',
    commercialUse: true,
    sizeMB: 64,
    bundled: true,
  },
  {
    id: 'realesrgan-x4plus-anime',
    label: 'Real-ESRGAN anime',
    nativeScale: 4,
    bestFor: 'Flat colour, line art, vector rasterised',
    license: 'BSD-3-Clause',
    commercialUse: true,
    sizeMB: 17,
    bundled: true,
  },
  {
    id: 'realesr-animevideov3',
    label: 'Real-ESRGAN anime video v3',
    nativeScale: 4,
    bestFor: 'Fastest — light edits, big batches',
    license: 'BSD-3-Clause',
    commercialUse: true,
    sizeMB: 2.5,
    bundled: true,
  },
];

/**
 * Models people ask for that we deliberately do NOT ship. Shown in the UI so
 * nobody wonders why 4x-UltraSharp is missing.
 */
export const REJECTED_MODEL_NOTE =
  '4x-UltraSharp, SUPIR and NMKD Siax are non-commercial or custom-licence models — not bundled, because upscaled output is sold.';

/** Where extra NCNN models can be dropped in. */
export const CUSTOM_MODEL_HINT =
  'Extra NCNN models: drop <name>-x4.param and <name>-x4.bin into the models folder. Only add models you may sell output from.';

/**
 * Portable engine builds. The zips are packaged as
 * `realesrgan-ncnn-vulkan-<date>/` containing the binary, `models/` and the
 * Vulkan runtime, so the main process extracts and then flattens that folder.
 */
export const ENGINE_RELEASES: Record<
  'win32' | 'darwin' | 'linux',
  { url: string; binary: string; sizeMB: number }
> = {
  win32: {
    url: 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip',
    binary: 'realesrgan-ncnn-vulkan.exe',
    sizeMB: 43.4,
  },
  darwin: {
    url: 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-macos.zip',
    binary: 'realesrgan-ncnn-vulkan',
    sizeMB: 49.4,
  },
  linux: {
    url: 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-ubuntu.zip',
    binary: 'realesrgan-ncnn-vulkan',
    sizeMB: 44.8,
  },
};

export const ENGINE_LICENSE_NOTE =
  'Real-ESRGAN weights: BSD-3-Clause (Tencent ARC Lab) — commercial output allowed. The NCNN wrapper is MIT. Check each marketplace’s AI-disclosure rule separately.';

/** True only for a model id we actually ship a matching .param/.bin for. */
export function isBundledModel(id: string): boolean {
  return UPSCALE_MODELS.some((model) => model.id === id);
}
