/**
 * Open-source upscaling model catalogue.
 *
 * Only models whose licence permits commercial use are listed. The official
 * Real-ESRGAN NCNN-Vulkan portable builds (BSD-3-Clause, code AND weights)
 * ship the first five models inside the zip, so one download unlocks them.
 *
 * Source: github.com/xinntao/Real-ESRGAN releases (v0.2.5.0, 2022-04-24).
 */

export interface UpscaleModel {
  id: string;
  label: string;
  nativeScale: 2 | 3 | 4;
  bestFor: string;
  license: string;
  commercialUse: true;
  sizeMB: number;
  bundled: boolean;
  notes?: string;
}

export const UPSCALE_MODELS: UpscaleModel[] = [
  {
    id: 'realesrgan-x4plus',
    label: 'Real-ESRGAN x4plus',
    nativeScale: 4,
    bestFor: 'General photos & raster illustrations (default)',
    license: 'BSD-3-Clause',
    commercialUse: true,
    sizeMB: 64,
    bundled: true,
  },
  {
    id: 'realesrgan-x2plus',
    label: 'Real-ESRGAN x2plus',
    nativeScale: 2,
    bestFor: 'Mild 2× enlargement, keeps natural grain',
    license: 'BSD-3-Clause',
    commercialUse: true,
    sizeMB: 64,
    bundled: true,
  },
  {
    id: 'realesrgan-x4plus-anime',
    label: 'Real-ESRGAN x4plus anime',
    nativeScale: 4,
    bestFor: 'Flat-colour artwork, line art, anime-style vectors rendered to raster',
    license: 'BSD-3-Clause',
    commercialUse: true,
    sizeMB: 64,
    bundled: true,
  },
  {
    id: 'realesrnet-x4plus',
    label: 'RealESRNet x4plus',
    nativeScale: 4,
    bestFor: 'Smoother, conservative upscale (less hallucinated detail)',
    license: 'BSD-3-Clause',
    commercialUse: true,
    sizeMB: 64,
    bundled: true,
  },
  {
    id: 'realesr-animevideov3',
    label: 'Real-ESRGAN anime video v3',
    nativeScale: 4,
    bestFor: 'Lightweight anime/illustration model, fastest of the set',
    license: 'BSD-3-Clause',
    commercialUse: true,
    sizeMB: 8,
    bundled: true,
  },
];

/** Community NCNN conversions the user can drop into a custom model folder. */
export const CUSTOM_MODEL_HINT =
  'Want more (4x-UltraSharp, NMKD Siax, …)? Place any NCNN .bin/.param pair into the custom models folder — they appear here automatically. Check each model’s licence before commercial use.';

export const ENGINE_RELEASES: Record<'win32' | 'darwin' | 'linux', { url: string; binary: string }> = {
  win32: {
    url: 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip',
    binary: 'realesrgan-ncnn-vulkan.exe',
  },
  darwin: {
    url: 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-macos.zip',
    binary: 'realesrgan-ncnn-vulkan',
  },
  linux: {
    url: 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-ubuntu.zip',
    binary: 'realesrgan-ncnn-vulkan',
  },
};

export const ENGINE_LICENSE_NOTE =
  'Real-ESRGAN and realesrgan-ncnn-vulkan are BSD-3-Clause (Tencent ARC Lab). The bundled weights carry the same licence, so commercial use of upscaled output is permitted. Always check each platform’s AI/upscaling disclosure policy separately.';
