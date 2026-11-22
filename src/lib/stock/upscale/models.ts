import type { GoogleIconName } from '@/components/ui/GoogleIcon';
import type { ModelInstallSpec } from '@/lib/desktop';
import { desktopPlatformKey } from '@/lib/modelStore';
import type { PlatformId } from '../types';
import type { BuiltinFilterMode } from './classic';

/**
 * Comprehensive catalog of free, open weight and open source image upscaling
 * models organized by purpose. Every downloadable model installs directly
 * inside the app without external links.
 */

export type UpscalePurpose =
  | 'all'
  | 'commercial'
  | 'photo'
  | 'general'
  | 'anime'
  | 'faithful'
  | 'restore'
  | 'fast';

export const UPSCALE_PURPOSES: Array<{ id: UpscalePurpose; label: string; icon: GoogleIconName }> = [
  { id: 'all', label: 'All', icon: 'apps' },
  { id: 'commercial', label: 'Commercial', icon: 'workspace_premium' },
  { id: 'photo', label: 'Photo', icon: 'photo_camera' },
  { id: 'general', label: 'General', icon: 'layers' },
  { id: 'anime', label: 'Anime & Art', icon: 'brush' },
  { id: 'faithful', label: 'Faithful', icon: 'center_focus_strong' },
  { id: 'restore', label: 'Cleanup', icon: 'brush' },
  { id: 'fast', label: 'Fast', icon: 'speed' },
];

export type EngineFamily = 'builtin' | 'realesrgan' | 'realcugan' | 'waifu2x' | 'realsr' | 'srmd' | 'onnx';

/** Families that ship a native NCNN/Vulkan binary and therefore need a desktop. */
export type NcnnFamily = Exclude<EngineFamily, 'builtin' | 'onnx'>;

export interface UpscaleModel {
  id: string;
  name: string;
  family: EngineFamily;
  purpose: Exclude<UpscalePurpose, 'all'>;
  purposes: Array<Exclude<UpscalePurpose, 'all'>>;
  icon: GoogleIconName;
  license: string;
  nativeScale: 2 | 3 | 4;
  scales: Array<2 | 3 | 4>;
  sizeMB: number;
  /** Safe for agencies that disallow generative AI (classic resampling). */
  agencySafe?: boolean;
  builtinMode?: BuiltinFilterMode;
  /** Model stem passed to realesrgan ncnn vulkan. */
  ncnnModelName?: string;
  /** Weight download source when separate from base engine archive. */
  customWeightBase?: string;
  /** Subfolder in the NCNN engine dir (for waifu2x / realcugan / realsr / srmd). */
  modelsSubDir?: string;
  noiseLevel?: number;
  /** Single ONNX graph executed by ONNX Runtime Web (phones included). */
  onnxFile?: string;
  onnxUrl?: string;
  onnxBytes?: number;
}

const ENGINE_ZIPS: Record<
  NcnnFamily,
  {
    group: string;
    sizeMB: number;
    binary: Record<'windows' | 'macos' | 'linux', string>;
    url: Record<'windows' | 'macos' | 'linux', string>;
  }
> = {
  realesrgan: {
    group: 'engine_realesrgan',
    sizeMB: 46,
    binary: {
      windows: 'realesrgan-ncnn-vulkan.exe',
      macos: 'realesrgan-ncnn-vulkan',
      linux: 'realesrgan-ncnn-vulkan',
    },
    url: {
      windows: 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip',
      macos: 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-macos.zip',
      linux: 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-ubuntu.zip',
    },
  },
  realcugan: {
    group: 'engine_realcugan',
    sizeMB: 48,
    binary: {
      windows: 'realcugan-ncnn-vulkan.exe',
      macos: 'realcugan-ncnn-vulkan',
      linux: 'realcugan-ncnn-vulkan',
    },
    url: {
      windows: 'https://github.com/nihui/realcugan-ncnn-vulkan/releases/download/20220728/realcugan-ncnn-vulkan-20220728-windows.zip',
      macos: 'https://github.com/nihui/realcugan-ncnn-vulkan/releases/download/20220728/realcugan-ncnn-vulkan-20220728-macos.zip',
      linux: 'https://github.com/nihui/realcugan-ncnn-vulkan/releases/download/20220728/realcugan-ncnn-vulkan-20220728-ubuntu.zip',
    },
  },
  waifu2x: {
    group: 'engine_waifu2x',
    sizeMB: 38,
    binary: {
      windows: 'waifu2x-ncnn-vulkan.exe',
      macos: 'waifu2x-ncnn-vulkan',
      linux: 'waifu2x-ncnn-vulkan',
    },
    url: {
      windows: 'https://github.com/nihui/waifu2x-ncnn-vulkan/releases/download/20250915/waifu2x-ncnn-vulkan-20250915-windows.zip',
      macos: 'https://github.com/nihui/waifu2x-ncnn-vulkan/releases/download/20250915/waifu2x-ncnn-vulkan-20250915-macos.zip',
      linux: 'https://github.com/nihui/waifu2x-ncnn-vulkan/releases/download/20250915/waifu2x-ncnn-vulkan-20250915-linux.zip',
    },
  },
  realsr: {
    group: 'engine_realsr',
    sizeMB: 64,
    binary: {
      windows: 'realsr-ncnn-vulkan.exe',
      macos: 'realsr-ncnn-vulkan',
      linux: 'realsr-ncnn-vulkan',
    },
    url: {
      windows: 'https://github.com/nihui/realsr-ncnn-vulkan/releases/download/20220728/realsr-ncnn-vulkan-20220728-windows.zip',
      macos: 'https://github.com/nihui/realsr-ncnn-vulkan/releases/download/20220728/realsr-ncnn-vulkan-20220728-macos.zip',
      linux: 'https://github.com/nihui/realsr-ncnn-vulkan/releases/download/20220728/realsr-ncnn-vulkan-20220728-ubuntu.zip',
    },
  },
  srmd: {
    group: 'engine_srmd',
    sizeMB: 22,
    binary: {
      windows: 'srmd-ncnn-vulkan.exe',
      macos: 'srmd-ncnn-vulkan',
      linux: 'srmd-ncnn-vulkan',
    },
    url: {
      windows: 'https://github.com/nihui/srmd-ncnn-vulkan/releases/download/20220728/srmd-ncnn-vulkan-20220728-windows.zip',
      macos: 'https://github.com/nihui/srmd-ncnn-vulkan/releases/download/20220728/srmd-ncnn-vulkan-20220728-macos.zip',
      linux: 'https://github.com/nihui/srmd-ncnn-vulkan/releases/download/20220728/srmd-ncnn-vulkan-20220728-ubuntu.zip',
    },
  },
};

const UPSCAYL_CORE = 'https://raw.githubusercontent.com/upscayl/upscayl/main/resources/models';
const UPSCAYL_CUSTOM = 'https://raw.githubusercontent.com/upscayl/custom-models/main/models';

export const UPSCALE_MODELS: UpscaleModel[] = [
  /* Built in ready immediately (browser & desktop, commercial agency safe) */
  {
    id: 'lanczos-pro',
    name: 'Lanczos Pro',
    family: 'builtin',
    purpose: 'commercial',
    purposes: ['commercial', 'photo', 'faithful', 'fast'],
    icon: 'workspace_premium',
    license: 'Built in',
    nativeScale: 4,
    scales: [2, 3, 4],
    sizeMB: 0,
    agencySafe: true,
    builtinMode: 'lanczos-pro',
  },
  {
    id: 'edge-crisp',
    name: 'Edge Guided Sharp',
    family: 'builtin',
    purpose: 'faithful',
    purposes: ['faithful', 'commercial', 'general', 'fast'],
    icon: 'center_focus_strong',
    license: 'Built in',
    nativeScale: 4,
    scales: [2, 3, 4],
    sizeMB: 0,
    agencySafe: true,
    builtinMode: 'edge-crisp',
  },
  {
    id: 'photo-restore',
    name: 'Denoise & Clarify',
    family: 'builtin',
    purpose: 'restore',
    purposes: ['restore', 'photo', 'commercial'],
    icon: 'brush',
    license: 'Built in',
    nativeScale: 4,
    scales: [2, 3, 4],
    sizeMB: 0,
    agencySafe: true,
    builtinMode: 'photo-restore',
  },
  {
    id: 'anime4k-shader',
    name: 'Anime4K Clamp',
    family: 'builtin',
    purpose: 'anime',
    purposes: ['anime', 'commercial', 'fast'],
    icon: 'brush',
    license: 'MIT',
    nativeScale: 4,
    scales: [2, 3, 4],
    sizeMB: 0,
    agencySafe: true,
    builtinMode: 'anime4k-shader',
  },

  /*
   * The one neural model that really runs on a phone. It is a single 4.6 MB
   * ONNX graph executed by ONNX Runtime's WebAssembly backend, so there is no
   * engine archive, no Vulkan driver and nothing that can fail to install.
   * Weights: Real-ESRGAN general x4v3 (BSD 3 Clause, commercial use allowed).
   */
  {
    id: 'realesr-general-x4v3',
    name: 'Real-ESRGAN Mobile x4',
    family: 'onnx',
    purpose: 'photo',
    purposes: ['photo', 'general', 'commercial', 'restore'],
    icon: 'developer_board',
    license: 'BSD 3',
    nativeScale: 4,
    scales: [4],
    sizeMB: 4.6,
    onnxFile: 'realesr-general-x4v3.onnx',
    onnxUrl:
      'https://github.com/ivansantander-hub/kinora-toolchain/releases/download/models-realesrgan-1/realesr-general-x4v3.onnx',
    onnxBytes: 4866420,
  },

  /* RealESRGAN family (BSD 3 Clause commercial license) */
  {
    id: 'realesrgan-x4plus',
    name: 'RealESRGAN x4plus',
    family: 'realesrgan',
    purpose: 'photo',
    purposes: ['photo', 'commercial', 'general'],
    icon: 'photo_camera',
    license: 'BSD 3',
    nativeScale: 4,
    scales: [4],
    sizeMB: 46,
    ncnnModelName: 'realesrgan-x4plus',
  },
  {
    id: 'realesrnet-x4plus',
    name: 'RealESRNet x4plus',
    family: 'realesrgan',
    purpose: 'faithful',
    purposes: ['faithful', 'commercial', 'photo'],
    icon: 'filter_center_focus',
    license: 'BSD 3',
    nativeScale: 4,
    scales: [4],
    sizeMB: 46,
    ncnnModelName: 'realesrnet-x4plus',
  },
  {
    id: 'realesrgan-general-x4v3',
    name: 'RealESRGAN General v3',
    family: 'realesrgan',
    purpose: 'general',
    purposes: ['general', 'commercial', 'fast'],
    icon: 'layers',
    license: 'BSD 3',
    nativeScale: 4,
    scales: [4],
    sizeMB: 5,
    ncnnModelName: 'RealESRGAN_General_x4_v3',
    customWeightBase: UPSCAYL_CUSTOM,
  },
  {
    id: 'realesrgan-general-wdn',
    name: 'RealESRGAN General WDN',
    family: 'realesrgan',
    purpose: 'restore',
    purposes: ['restore', 'commercial', 'photo'],
    icon: 'blur_on',
    license: 'BSD 3',
    nativeScale: 4,
    scales: [4],
    sizeMB: 5,
    ncnnModelName: 'RealESRGAN_General_WDN_x4_v3',
    customWeightBase: UPSCAYL_CUSTOM,
  },
  {
    id: 'realesrgan-x4plus-anime',
    name: 'RealESRGAN Anime 6B',
    family: 'realesrgan',
    purpose: 'anime',
    purposes: ['anime', 'commercial'],
    icon: 'palette',
    license: 'BSD 3',
    nativeScale: 4,
    scales: [4],
    sizeMB: 18,
    ncnnModelName: 'realesrgan-x4plus-anime',
  },
  {
    id: 'realesr-animevideov3',
    name: 'RealESR Compact v3',
    family: 'realesrgan',
    purpose: 'fast',
    purposes: ['fast', 'anime', 'commercial'],
    icon: 'speed',
    license: 'BSD 3',
    nativeScale: 4,
    scales: [2, 3, 4],
    sizeMB: 5,
    ncnnModelName: 'realesr-animevideov3',
  },

  /* LSDIR, Nomos & Open Commercial SR Models (MIT / CC0) */
  {
    id: 'nomos8k-sc',
    name: 'Nomos 8K SC 4x',
    family: 'realesrgan',
    purpose: 'commercial',
    purposes: ['commercial', 'photo', 'general'],
    icon: 'hd',
    license: 'CC0',
    nativeScale: 4,
    scales: [4],
    sizeMB: 17,
    ncnnModelName: '4xNomos8kSC',
    customWeightBase: UPSCAYL_CUSTOM,
  },
  {
    id: 'lsdir-4x',
    name: 'LSDIR 4x',
    family: 'realesrgan',
    purpose: 'photo',
    purposes: ['photo', 'commercial'],
    icon: 'landscape',
    license: 'MIT',
    nativeScale: 4,
    scales: [4],
    sizeMB: 64,
    ncnnModelName: '4xLSDIR',
    customWeightBase: UPSCAYL_CUSTOM,
  },
  {
    id: 'lsdir-plus-clean',
    name: 'LSDIR Plus Clean 4x',
    family: 'realesrgan',
    purpose: 'restore',
    purposes: ['restore', 'photo', 'commercial'],
    icon: 'healing',
    license: 'MIT',
    nativeScale: 4,
    scales: [4],
    sizeMB: 64,
    ncnnModelName: '4xLSDIRplusC',
    customWeightBase: UPSCAYL_CUSTOM,
  },
  {
    id: 'lsdir-compact-c3',
    name: 'LSDIR Compact C3 4x',
    family: 'realesrgan',
    purpose: 'fast',
    purposes: ['fast', 'commercial', 'general'],
    icon: 'play_arrow',
    license: 'MIT',
    nativeScale: 4,
    scales: [4],
    sizeMB: 5,
    ncnnModelName: '4xLSDIRCompactC3',
    customWeightBase: UPSCAYL_CUSTOM,
  },
  {
    id: 'hfa2k-4x',
    name: 'HFA2k Illustration 4x',
    family: 'realesrgan',
    purpose: 'anime',
    purposes: ['anime', 'commercial', 'faithful'],
    icon: 'draw',
    license: 'CC0',
    nativeScale: 4,
    scales: [4],
    sizeMB: 64,
    ncnnModelName: '4xHFA2k',
    customWeightBase: UPSCAYL_CUSTOM,
  },

  /* Upscayl & Community Open Weights */
  {
    id: 'upscayl-standard-4x',
    name: 'Upscayl Standard 4x',
    family: 'realesrgan',
    purpose: 'general',
    purposes: ['general', 'photo'],
    icon: 'photo_size_select_large',
    license: 'Open',
    nativeScale: 4,
    scales: [4],
    sizeMB: 64,
    ncnnModelName: 'upscayl-standard-4x',
    customWeightBase: UPSCAYL_CORE,
  },
  {
    id: 'upscayl-lite-4x',
    name: 'Upscayl Lite 4x',
    family: 'realesrgan',
    purpose: 'fast',
    purposes: ['fast', 'general'],
    icon: 'speed',
    license: 'Open',
    nativeScale: 4,
    scales: [4],
    sizeMB: 17,
    ncnnModelName: 'upscayl-lite-4x',
    customWeightBase: UPSCAYL_CORE,
  },
  {
    id: 'high-fidelity-4x',
    name: 'High Fidelity 4x',
    family: 'realesrgan',
    purpose: 'faithful',
    purposes: ['faithful', 'photo'],
    icon: 'high_quality',
    license: 'Open',
    nativeScale: 4,
    scales: [4],
    sizeMB: 64,
    ncnnModelName: 'high-fidelity-4x',
    customWeightBase: UPSCAYL_CORE,
  },
  {
    id: 'ultramix-balanced-4x',
    name: 'UltraMix Balanced 4x',
    family: 'realesrgan',
    purpose: 'general',
    purposes: ['general', 'photo', 'anime'],
    icon: 'tune',
    license: 'Open',
    nativeScale: 4,
    scales: [4],
    sizeMB: 64,
    ncnnModelName: 'ultramix-balanced-4x',
    customWeightBase: UPSCAYL_CORE,
  },
  {
    id: 'ultrasharp-4x',
    name: 'UltraSharp 4x',
    family: 'realesrgan',
    purpose: 'photo',
    purposes: ['photo', 'general'],
    icon: 'deblur',
    license: 'Open',
    nativeScale: 4,
    scales: [4],
    sizeMB: 64,
    ncnnModelName: 'ultrasharp-4x',
    customWeightBase: UPSCAYL_CORE,
  },
  {
    id: 'remacri-4x',
    name: 'Remacri Natural 4x',
    family: 'realesrgan',
    purpose: 'photo',
    purposes: ['photo', 'faithful'],
    icon: 'nature',
    license: 'Open',
    nativeScale: 4,
    scales: [4],
    sizeMB: 64,
    ncnnModelName: 'remacri-4x',
    customWeightBase: UPSCAYL_CORE,
  },
  {
    id: 'digital-art-4x',
    name: 'Digital Art 4x',
    family: 'realesrgan',
    purpose: 'anime',
    purposes: ['anime', 'general'],
    icon: 'color_lens',
    license: 'Open',
    nativeScale: 4,
    scales: [4],
    sizeMB: 18,
    ncnnModelName: 'digital-art-4x',
    customWeightBase: UPSCAYL_CORE,
  },
  {
    id: 'nmkd-siax-4x',
    name: 'NMKD Siax CX 4x',
    family: 'realesrgan',
    purpose: 'general',
    purposes: ['general', 'photo', 'restore'],
    icon: 'grid_view',
    license: 'Open',
    nativeScale: 4,
    scales: [4],
    sizeMB: 64,
    ncnnModelName: '4x_NMKD-Siax_200k',
    customWeightBase: UPSCAYL_CUSTOM,
  },
  {
    id: 'nmkd-superscale-4x',
    name: 'NMKD Superscale SP 4x',
    family: 'realesrgan',
    purpose: 'faithful',
    purposes: ['faithful', 'photo'],
    icon: 'aspect_ratio',
    license: 'Open',
    nativeScale: 4,
    scales: [4],
    sizeMB: 64,
    ncnnModelName: '4x_NMKD-Superscale-SP_178000_G',
    customWeightBase: UPSCAYL_CUSTOM,
  },
  {
    id: 'uniscale-restore-4x',
    name: 'UniScale Restore 4x',
    family: 'realesrgan',
    purpose: 'restore',
    purposes: ['restore', 'photo'],
    icon: 'lens_blur',
    license: 'Open',
    nativeScale: 4,
    scales: [4],
    sizeMB: 64,
    ncnnModelName: 'uniscale_restore',
    customWeightBase: UPSCAYL_CUSTOM,
  },

  /* Dedicated MIT NCNN Vulkan engines: RealCUGAN, Waifu2x, RealSR, SRMD */
  {
    id: 'realcugan-pro',
    name: 'RealCUGAN Pro',
    family: 'realcugan',
    purpose: 'anime',
    purposes: ['anime', 'commercial', 'faithful'],
    icon: 'animation',
    license: 'MIT',
    nativeScale: 2,
    scales: [2, 3, 4],
    sizeMB: 48,
    modelsSubDir: 'models-pro',
    noiseLevel: 0,
  },
  {
    id: 'realcugan-se',
    name: 'RealCUGAN SE Denoise',
    family: 'realcugan',
    purpose: 'restore',
    purposes: ['restore', 'anime', 'commercial'],
    icon: 'grain',
    license: 'MIT',
    nativeScale: 2,
    scales: [2, 3, 4],
    sizeMB: 48,
    modelsSubDir: 'models-se',
    noiseLevel: 2,
  },
  {
    id: 'waifu2x-cunet',
    name: 'Waifu2x CUNet',
    family: 'waifu2x',
    purpose: 'commercial',
    purposes: ['commercial', 'anime', 'faithful'],
    icon: 'photo_camera',
    license: 'MIT',
    nativeScale: 2,
    scales: [2, 4],
    sizeMB: 38,
    modelsSubDir: 'models-cunet',
    noiseLevel: 1,
  },
  {
    id: 'waifu2x-upconv7-photo',
    name: 'Waifu2x UpConv7 Photo',
    family: 'waifu2x',
    purpose: 'photo',
    purposes: ['photo', 'commercial', 'fast'],
    icon: 'camera',
    license: 'MIT',
    nativeScale: 2,
    scales: [2, 4],
    sizeMB: 38,
    modelsSubDir: 'models-upconv_7_photo',
    noiseLevel: 1,
  },
  {
    id: 'realsr-df2k-jpeg',
    name: 'RealSR DF2K JPEG',
    family: 'realsr',
    purpose: 'restore',
    purposes: ['restore', 'photo', 'commercial'],
    icon: 'image',
    license: 'MIT',
    nativeScale: 4,
    scales: [4],
    sizeMB: 64,
    modelsSubDir: 'models-DF2K_JPEG',
  },
  {
    id: 'srmd-nf',
    name: 'SRMD Super Resolution',
    family: 'srmd',
    purpose: 'faithful',
    purposes: ['faithful', 'commercial', 'fast'],
    icon: 'straighten',
    license: 'MIT',
    nativeScale: 4,
    scales: [2, 3, 4],
    sizeMB: 22,
    modelsSubDir: 'models-srmdnf',
    noiseLevel: 0,
  },
];

/**
 * Neural packs are NCNN/Vulkan desktop binaries. They can never execute in a
 * phone WebView, so the app must not offer them as downloadable there.
 */
export function isDesktopOnlyModel(model: UpscaleModel): boolean {
  return model.family !== 'builtin' && model.family !== 'onnx';
}

/**
 * The models that can really render in this container.
 *
 * On a phone the list is filtered twice: desktop-only NCNN packs never
 * appear, and neural graphs that do not fit this device's RAM tier are
 * hidden too, so the user only ever sees models that will actually run.
 */
export function modelsForDevice(isDesktop: boolean, tier: 'low' | 'mid' | 'high' = 'high'): UpscaleModel[] {
  if (isDesktop) return UPSCALE_MODELS;
  return UPSCALE_MODELS.filter((model) => {
    if (isDesktopOnlyModel(model)) return false;
    if (model.family === 'builtin') return true;
    if (tier === 'high') return true;
    if (tier === 'mid') return model.sizeMB <= 64;
    return model.sizeMB <= 16;
  });
}

/** True when the model's weights are a single ONNX file rather than an engine. */
export function isOnnxModel(model: UpscaleModel): model is UpscaleModel & { onnxFile: string; onnxUrl: string } {
  return model.family === 'onnx' && Boolean(model.onnxFile && model.onnxUrl);
}

export function buildUpscaleInstallSpec(model: UpscaleModel): ModelInstallSpec | null {
  if (model.family === 'builtin') return null;
  if (isOnnxModel(model)) {
    return {
      id: model.id,
      kind: 'image-upscale',
      primaryFile: model.onnxFile,
      approxBytes: model.onnxBytes ?? Math.round(model.sizeMB * 1_048_576),
      files: [{ url: model.onnxUrl, name: model.onnxFile, label: `${model.name} weights` }],
    };
  }
  const osKey = desktopPlatformKey();
  const engine = ENGINE_ZIPS[model.family as NcnnFamily];
  const binary = engine.binary[osKey];
  const files: ModelInstallSpec['files'] = [
    {
      url: engine.url[osKey],
      name: `${model.family}.zip`,
      label: `${model.name} runtime`,
      extractZip: true,
      executable: binary,
      skipIfExists: true,
      checkName: binary,
    },
  ];

  if (model.customWeightBase && model.ncnnModelName) {
    files.push(
      {
        url: `${model.customWeightBase}/${model.ncnnModelName}.param`,
        name: `${model.ncnnModelName}.param`,
        subDir: 'models',
        label: `${model.name} graph`,
      },
      {
        url: `${model.customWeightBase}/${model.ncnnModelName}.bin`,
        name: `${model.ncnnModelName}.bin`,
        subDir: 'models',
        label: `${model.name} weights`,
      },
    );
  }

  return {
    id: model.id,
    kind: 'image-upscale',
    sharedGroup: engine.group,
    binary,
    primaryFile: model.ncnnModelName ? `${model.ncnnModelName}.bin` : binary,
    approxBytes: model.sizeMB * 1_048_576,
    files,
  };
}

export function engineBinaryFor(family: NcnnFamily): {
  group: string;
  binary: string;
  url: string;
} {
  const osKey = desktopPlatformKey();
  const info = ENGINE_ZIPS[family];
  return {
    group: info.group,
    binary: info.binary[osKey],
    url: info.url[osKey],
  };
}

/* -------------------------------------------------------------------------- */
/* Resolution & marketplace preset targets                                    */
/* -------------------------------------------------------------------------- */

export interface UpscaleTarget {
  id: string;
  label: string;
  badge: string;
  icon?: GoogleIconName;
  platformId?: PlatformId;
  group: 'resolution' | 'platform';
  longEdge?: number;
  megapixels?: number;
  factor?: 2 | 3 | 4 | 8;
  maxEdge?: number;
  maxMP?: number;
  recommendedFormat?: 'jpg' | 'png' | 'webp';
  requireAgencySafe?: boolean;
}

export const UPSCALE_TARGETS: UpscaleTarget[] = [
  /* Resolution presets */
  { id: '8k', label: '8K UHD', badge: '7680 px', icon: '8k', group: 'resolution', longEdge: 7680 },
  { id: '6k', label: '6K Print', badge: '6144 px', icon: 'print', group: 'resolution', longEdge: 6144 },
  { id: '5k', label: '5K Studio', badge: '5120 px', icon: 'desktop_windows', group: 'resolution', longEdge: 5120 },
  { id: '4k', label: '4K UHD', badge: '3840 px', icon: '4k', group: 'resolution', longEdge: 3840 },
  { id: '2k', label: '2K QHD', badge: '2560 px', icon: 'hd', group: 'resolution', longEdge: 2560 },
  { id: 'x2', label: '2x Scale', badge: '2x', icon: 'zoom_in', group: 'resolution', factor: 2 },
  { id: 'x4', label: '4x Scale', badge: '4x', icon: 'fullscreen', group: 'resolution', factor: 4 },
  { id: 'x8', label: '8x Scale', badge: '8x', icon: 'fullscreen', group: 'resolution', factor: 8 },

  /* Marketplace compliant presets (2026 rules) */
  {
    id: 'shutterstock',
    label: 'Shutterstock',
    badge: '25 MP JPG',
    platformId: 'shutterstock',
    group: 'platform',
    megapixels: 25,
    maxMP: 100,
    recommendedFormat: 'jpg',
    requireAgencySafe: true,
  },
  {
    id: 'adobe',
    label: 'Adobe Stock',
    badge: '25 MP JPG',
    platformId: 'adobe',
    group: 'platform',
    megapixels: 25,
    maxMP: 100,
    recommendedFormat: 'jpg',
  },
  {
    id: 'freepik',
    label: 'Magnific',
    badge: '25 MP',
    platformId: 'freepik',
    group: 'platform',
    megapixels: 25,
    maxEdge: 10000,
    maxMP: 100,
    recommendedFormat: 'jpg',
  },
  {
    id: 'getty',
    label: 'Getty & iStock',
    badge: '24 MP JPG',
    platformId: 'getty',
    group: 'platform',
    megapixels: 24,
    maxMP: 256,
    recommendedFormat: 'jpg',
    requireAgencySafe: true,
  },
  {
    id: 'alamy',
    label: 'Alamy',
    badge: '24 MP JPG',
    platformId: 'alamy',
    group: 'platform',
    megapixels: 24,
    maxMP: 256,
    recommendedFormat: 'jpg',
    requireAgencySafe: true,
  },
  {
    id: '123rf',
    label: '123RF',
    badge: '16 MP JPG',
    platformId: '123rf',
    group: 'platform',
    megapixels: 16,
    maxMP: 100,
    recommendedFormat: 'jpg',
  },
  {
    id: 'dreamstime',
    label: 'Dreamstime',
    badge: '25 MP JPG',
    platformId: 'dreamstime',
    group: 'platform',
    megapixels: 25,
    maxMP: 150,
    recommendedFormat: 'jpg',
  },
  {
    id: 'canva',
    label: 'Canva Cutout',
    badge: '3000 px PNG',
    platformId: 'canva',
    group: 'platform',
    longEdge: 3000,
    recommendedFormat: 'png',
  },
];

export const UPSCALE_FORMATS: Array<{ id: 'jpg' | 'png' | 'webp'; label: string }> = [
  { id: 'jpg', label: 'JPG' },
  { id: 'png', label: 'PNG' },
  { id: 'webp', label: 'WebP' },
];

export function resolveTargetSize(
  srcW: number,
  srcH: number,
  target: UpscaleTarget,
): { width: number; height: number; factor: number } {
  if (!srcW || !srcH) return { width: 0, height: 0, factor: 1 };
  let factor = 1;
  if (target.factor) factor = target.factor;
  else if (target.longEdge) factor = Math.max(1, target.longEdge / Math.max(srcW, srcH));
  else if (target.megapixels) {
    const srcMP = (srcW * srcH) / 1_000_000;
    factor = srcMP >= target.megapixels ? 1 : Math.sqrt(target.megapixels / srcMP);
  }
  if (target.maxEdge) {
    const edgeCap = target.maxEdge / Math.max(srcW, srcH);
    factor = Math.min(factor, edgeCap);
  }
  if (target.maxMP) {
    const mpCap = Math.sqrt((target.maxMP * 0.98 * 1_000_000) / (srcW * srcH));
    factor = Math.min(factor, mpCap);
  }
  factor = Math.min(factor, 16);
  return {
    width: Math.max(1, Math.round(srcW * factor)),
    height: Math.max(1, Math.round(srcH * factor)),
    factor,
  };
}

/** Legacy exports retained for test compatibility. */
export const MODELS = UPSCALE_MODELS;
export const TARGETS = UPSCALE_TARGETS;
