import type { GoogleIconName } from '@/components/ui/GoogleIcon';
import type { ModelInstallSpec } from '@/lib/desktop';
import { desktopPlatformKey } from '@/lib/modelStore';
import type { PlatformId } from '@/lib/stock/types';

/**
 * Full in app Video Upscaler and Frame Interpolation studio.
 *
 * Catalog covers open source real time shaders (Lanczos, AMD FSR 1.0 EASU/RCAS,
 * FidelityFX CAS, Anime4K v4, Temporal Denoise), NCNN Vulkan neural video
 * upscalers (RealESRGAN Video v3 2x/3x/4x, RealESRGAN x4plus, RealESRNet,
 * RealCUGAN Pro/SE, Waifu2x CUNet/UpConv7, RealSR DF2K, SRMD, LSDIR Compact,
 * Nomos 8K SC, UltraSharp) and RIFE v4 optical flow frame interpolation.
 *
 * Every model installs directly inside the app and renders upscaled 1080p, 2K,
 * 4K and 8K clips with audio preservation plus instant 4K/8K still extraction.
 */

export type VideoPurpose =
  | 'all'
  | 'realtime'
  | 'footage'
  | 'anime'
  | 'restore'
  | 'interpolate'
  | 'commercial';

export const VIDEO_PURPOSES: Array<{ id: VideoPurpose; label: string; icon: GoogleIconName }> = [
  { id: 'all', label: 'All', icon: 'apps' },
  { id: 'commercial', label: 'Commercial', icon: 'workspace_premium' },
  { id: 'footage', label: 'Stock Footage', icon: 'videocam' },
  { id: 'realtime', label: 'Real Time', icon: 'speed' },
  { id: 'anime', label: 'Anime & 2D', icon: 'animation' },
  { id: 'restore', label: 'Denoise & Clean', icon: 'auto_fix_high' },
  { id: 'interpolate', label: 'Frame Boost', icon: 'slow_motion_video' },
];

export type VideoRuntime =
  | 'builtin'
  | 'realesrgan'
  | 'realcugan'
  | 'waifu2x'
  | 'realsr'
  | 'srmd'
  | 'rife';

export interface VideoModel {
  id: string;
  name: string;
  runtime: VideoRuntime;
  purpose: Exclude<VideoPurpose, 'all'>;
  purposes: Array<Exclude<VideoPurpose, 'all'>>;
  icon: GoogleIconName;
  license: string;
  badge: string;
  sizeMB: number;
  sharpen: number; // WebGL / Canvas RCAS pass strength
  contrast: number;
  saturate: number;
  fpsMultiplier?: 2;
  customWeight?: string;
}

const RUNTIME_ARCHIVES: Record<
  Exclude<VideoRuntime, 'builtin'>,
  {
    group: string;
    binary: Record<'windows' | 'macos' | 'linux', string>;
    url: Record<'windows' | 'macos' | 'linux', string>;
  }
> = {
  realesrgan: {
    group: 'engine_realesrgan',
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
  rife: {
    group: 'engine_rife',
    binary: {
      windows: 'rife-ncnn-vulkan.exe',
      macos: 'rife-ncnn-vulkan',
      linux: 'rife-ncnn-vulkan',
    },
    url: {
      windows: 'https://github.com/nihui/rife-ncnn-vulkan/releases/download/20221029/rife-ncnn-vulkan-20221029-windows.zip',
      macos: 'https://github.com/nihui/rife-ncnn-vulkan/releases/download/20221029/rife-ncnn-vulkan-20221029-macos.zip',
      linux: 'https://github.com/nihui/rife-ncnn-vulkan/releases/download/20221029/rife-ncnn-vulkan-20221029-ubuntu.zip',
    },
  },
};

const CUSTOM_WEIGHTS = 'https://raw.githubusercontent.com/upscayl/custom-models/main/models';

export const VIDEO_MODELS: VideoModel[] = [
  /* Instant real time open source shaders (Browser & Desktop) */
  {
    id: 'lanczos-temporal',
    name: 'Lanczos Temporal Pro',
    runtime: 'builtin',
    purpose: 'commercial',
    purposes: ['commercial', 'realtime', 'footage'],
    icon: 'workspace_premium',
    license: 'Built in',
    badge: '2x / 4x',
    sizeMB: 0,
    sharpen: 0.3,
    contrast: 1.02,
    saturate: 1.0,
  },
  {
    id: 'fsr-easu-rcas',
    name: 'AMD FSR 1.0 EASU + RCAS',
    runtime: 'builtin',
    purpose: 'realtime',
    purposes: ['realtime', 'commercial', 'footage'],
    icon: 'speed',
    license: 'MIT',
    badge: '2x / 4x',
    sizeMB: 0,
    sharpen: 0.55,
    contrast: 1.04,
    saturate: 1.02,
  },
  {
    id: 'fidelityfx-cas',
    name: 'FidelityFX CAS Sharp',
    runtime: 'builtin',
    purpose: 'commercial',
    purposes: ['commercial', 'realtime', 'footage'],
    icon: 'center_focus_strong',
    license: 'MIT',
    badge: '2x / 4x',
    sizeMB: 0,
    sharpen: 0.45,
    contrast: 1.03,
    saturate: 1.0,
  },
  {
    id: 'anime4k-v4',
    name: 'Anime4K v4 Restore HQ',
    runtime: 'builtin',
    purpose: 'anime',
    purposes: ['anime', 'realtime', 'commercial'],
    icon: 'animation',
    license: 'MIT',
    badge: '2x / 4x',
    sizeMB: 0,
    sharpen: 0.72,
    contrast: 1.06,
    saturate: 1.04,
  },
  {
    id: 'temporal-clean',
    name: 'Temporal Clean & Clarify',
    runtime: 'builtin',
    purpose: 'restore',
    purposes: ['restore', 'realtime', 'commercial'],
    icon: 'auto_fix_high',
    license: 'Built in',
    badge: '2x / 4x',
    sizeMB: 0,
    sharpen: 0.25,
    contrast: 1.02,
    saturate: 1.0,
  },

  /* RealESRGAN Video family (BSD 3 Clause) */
  {
    id: 'realesr-animevideov3-x2',
    name: 'RealESRGAN Video v3 2x',
    runtime: 'realesrgan',
    purpose: 'anime',
    purposes: ['anime', 'commercial', 'realtime'],
    icon: 'movie',
    license: 'BSD 3',
    badge: '2x',
    sizeMB: 46,
    sharpen: 0.5,
    contrast: 1.04,
    saturate: 1.02,
  },
  {
    id: 'realesr-animevideov3-x3',
    name: 'RealESRGAN Video v3 3x',
    runtime: 'realesrgan',
    purpose: 'anime',
    purposes: ['anime', 'commercial'],
    icon: 'movie',
    license: 'BSD 3',
    badge: '3x',
    sizeMB: 46,
    sharpen: 0.52,
    contrast: 1.04,
    saturate: 1.02,
  },
  {
    id: 'realesr-animevideov3-x4',
    name: 'RealESRGAN Video v3 4x',
    runtime: 'realesrgan',
    purpose: 'anime',
    purposes: ['anime', 'commercial'],
    icon: 'video_file',
    license: 'BSD 3',
    badge: '4x',
    sizeMB: 46,
    sharpen: 0.55,
    contrast: 1.04,
    saturate: 1.02,
  },
  {
    id: 'realesrgan-video-general',
    name: 'RealESRGAN General v3',
    runtime: 'realesrgan',
    purpose: 'footage',
    purposes: ['footage', 'commercial'],
    icon: 'videocam',
    license: 'BSD 3',
    badge: '4x',
    sizeMB: 5,
    sharpen: 0.45,
    contrast: 1.03,
    saturate: 1.01,
    customWeight: 'RealESRGAN_General_x4_v3',
  },
  {
    id: 'realesrgan-video-wdn',
    name: 'RealESRGAN WDN Denoise',
    runtime: 'realesrgan',
    purpose: 'restore',
    purposes: ['restore', 'footage', 'commercial'],
    icon: 'blur_on',
    license: 'BSD 3',
    badge: '4x',
    sizeMB: 5,
    sharpen: 0.35,
    contrast: 1.02,
    saturate: 1.0,
    customWeight: 'RealESRGAN_General_WDN_x4_v3',
  },
  {
    id: 'realesrgan-video-x4plus',
    name: 'RealESRGAN x4plus Cinema',
    runtime: 'realesrgan',
    purpose: 'footage',
    purposes: ['footage', 'commercial'],
    icon: 'theaters',
    license: 'BSD 3',
    badge: '4x',
    sizeMB: 46,
    sharpen: 0.5,
    contrast: 1.04,
    saturate: 1.01,
  },
  {
    id: 'realesrnet-video-x4plus',
    name: 'RealESRNet x4plus Natural',
    runtime: 'realesrgan',
    purpose: 'commercial',
    purposes: ['commercial', 'footage'],
    icon: 'filter_center_focus',
    license: 'BSD 3',
    badge: '4x',
    sizeMB: 46,
    sharpen: 0.35,
    contrast: 1.02,
    saturate: 1.0,
  },

  /* Open Commercial Footage Models (MIT / CC0) */
  {
    id: 'lsdir-compact-video',
    name: 'LSDIR Compact C3 Footage',
    runtime: 'realesrgan',
    purpose: 'footage',
    purposes: ['footage', 'commercial', 'realtime'],
    icon: 'rocket_launch',
    license: 'MIT',
    badge: '4x',
    sizeMB: 5,
    sharpen: 0.45,
    contrast: 1.03,
    saturate: 1.01,
    customWeight: '4xLSDIRCompactC3',
  },
  {
    id: 'nomos8k-video',
    name: 'Nomos 8K SC Broadcast',
    runtime: 'realesrgan',
    purpose: 'footage',
    purposes: ['footage', 'commercial'],
    icon: '8k',
    license: 'CC0',
    badge: '4x',
    sizeMB: 17,
    sharpen: 0.48,
    contrast: 1.03,
    saturate: 1.01,
    customWeight: '4xNomos8kSC',
  },
  {
    id: 'hfa2k-video',
    name: 'HFA2k Animation 4x',
    runtime: 'realesrgan',
    purpose: 'anime',
    purposes: ['anime', 'commercial'],
    icon: 'brush',
    license: 'CC0',
    badge: '4x',
    sizeMB: 64,
    sharpen: 0.58,
    contrast: 1.04,
    saturate: 1.03,
    customWeight: '4xHFA2k',
  },

  /* RealCUGAN, Waifu2x, RealSR & SRMD Video Engines (MIT) */
  {
    id: 'realcugan-video-pro',
    name: 'RealCUGAN Pro Video',
    runtime: 'realcugan',
    purpose: 'anime',
    purposes: ['anime', 'commercial'],
    icon: 'palette',
    license: 'MIT',
    badge: '2x / 3x / 4x',
    sizeMB: 48,
    sharpen: 0.6,
    contrast: 1.04,
    saturate: 1.03,
  },
  {
    id: 'realcugan-video-se',
    name: 'RealCUGAN SE Denoise',
    runtime: 'realcugan',
    purpose: 'restore',
    purposes: ['restore', 'anime', 'commercial'],
    icon: 'grain',
    license: 'MIT',
    badge: '2x / 3x / 4x',
    sizeMB: 48,
    sharpen: 0.42,
    contrast: 1.03,
    saturate: 1.01,
  },
  {
    id: 'waifu2x-video-cunet',
    name: 'Waifu2x CUNet Video',
    runtime: 'waifu2x',
    purpose: 'anime',
    purposes: ['anime', 'commercial'],
    icon: 'filter_vintage',
    license: 'MIT',
    badge: '2x / 4x',
    sizeMB: 38,
    sharpen: 0.48,
    contrast: 1.03,
    saturate: 1.02,
  },
  {
    id: 'waifu2x-video-photo',
    name: 'Waifu2x UpConv7 Footage',
    runtime: 'waifu2x',
    purpose: 'footage',
    purposes: ['footage', 'commercial'],
    icon: 'camera',
    license: 'MIT',
    badge: '2x / 4x',
    sizeMB: 38,
    sharpen: 0.4,
    contrast: 1.02,
    saturate: 1.0,
  },
  {
    id: 'realsr-video-df2k',
    name: 'RealSR DF2K Deblock',
    runtime: 'realsr',
    purpose: 'restore',
    purposes: ['restore', 'footage', 'commercial'],
    icon: 'healing',
    license: 'MIT',
    badge: '4x',
    sizeMB: 64,
    sharpen: 0.38,
    contrast: 1.02,
    saturate: 1.0,
  },
  {
    id: 'srmd-video',
    name: 'SRMD Clean Footage',
    runtime: 'srmd',
    purpose: 'restore',
    purposes: ['restore', 'commercial'],
    icon: 'straighten',
    license: 'MIT',
    badge: '2x / 3x / 4x',
    sizeMB: 22,
    sharpen: 0.35,
    contrast: 1.02,
    saturate: 1.0,
  },

  /* RIFE Optical Flow Frame Interpolation (MIT) */
  {
    id: 'rife-v46',
    name: 'RIFE v4.6 Motion 60 FPS',
    runtime: 'rife',
    purpose: 'interpolate',
    purposes: ['interpolate', 'footage', 'commercial'],
    icon: 'slow_motion_video',
    license: 'MIT',
    badge: '60 FPS',
    sizeMB: 414,
    sharpen: 0.35,
    contrast: 1.02,
    saturate: 1.0,
    fpsMultiplier: 2,
  },
  {
    id: 'rife-v4-uhd',
    name: 'RIFE v4 UHD 4K Smooth',
    runtime: 'rife',
    purpose: 'interpolate',
    purposes: ['interpolate', 'commercial'],
    icon: '4k',
    license: 'MIT',
    badge: '4K 60 FPS',
    sizeMB: 414,
    sharpen: 0.4,
    contrast: 1.03,
    saturate: 1.0,
    fpsMultiplier: 2,
  },
];

export function buildVideoInstallSpec(model: VideoModel): ModelInstallSpec | null {
  if (model.runtime === 'builtin') return null;
  const osKey = desktopPlatformKey();
  const runtime = RUNTIME_ARCHIVES[model.runtime];
  const binary = runtime.binary[osKey];
  const files: ModelInstallSpec['files'] = [
    {
      url: runtime.url[osKey],
      name: `${model.runtime}.zip`,
      label: `${model.name} runtime`,
      extractZip: true,
      executable: binary,
      skipIfExists: true,
      checkName: binary,
    },
  ];
  if (model.customWeight) {
    files.push(
      {
        url: `${CUSTOM_WEIGHTS}/${model.customWeight}.param`,
        name: `${model.customWeight}.param`,
        subDir: 'models',
        label: `${model.name} graph`,
      },
      {
        url: `${CUSTOM_WEIGHTS}/${model.customWeight}.bin`,
        name: `${model.customWeight}.bin`,
        subDir: 'models',
        label: `${model.name} weights`,
      },
    );
  }
  return {
    id: model.id,
    kind: 'video-upscale',
    sharedGroup: runtime.group,
    binary,
    primaryFile: model.customWeight ? `${model.customWeight}.bin` : binary,
    approxBytes: model.sizeMB * 1_048_576,
    files,
  };
}

export interface VideoTarget {
  id: string;
  label: string;
  badge: string;
  icon?: GoogleIconName;
  platformId?: PlatformId;
  group: 'resolution' | 'platform';
  longEdge: number;
  defaultFps?: 24 | 30 | 60;
}

export const VIDEO_TARGETS: VideoTarget[] = [
  { id: '4k', label: '4K UHD', badge: '3840x2160', icon: '4k', group: 'resolution', longEdge: 3840 },
  { id: '8k', label: '8K UHD', badge: '7680x4320', icon: '8k', group: 'resolution', longEdge: 7680 },
  { id: '2k', label: '2K QHD', badge: '2560x1440', icon: 'hd', group: 'resolution', longEdge: 2560 },
  { id: '1080p', label: 'Full HD', badge: '1920x1080', icon: 'desktop_windows', group: 'resolution', longEdge: 1920 },
  { id: 'shutterstock_4k', label: 'Shutterstock 4K', badge: '3840p 30fps', platformId: 'shutterstock', group: 'platform', longEdge: 3840, defaultFps: 30 },
  { id: 'adobe_4k', label: 'Adobe Stock 4K', badge: '3840p 30fps', platformId: 'adobe', group: 'platform', longEdge: 3840, defaultFps: 30 },
  { id: 'freepik_4k', label: 'Freepik 4K', badge: '3840p 30fps', platformId: 'freepik', group: 'platform', longEdge: 3840, defaultFps: 30 },
  { id: 'pond5_4k', label: 'Pond5 4K', badge: '3840p 60fps', platformId: 'pond5', group: 'platform', longEdge: 3840, defaultFps: 60 },
  { id: 'getty_4k', label: 'Getty 4K', badge: '3840p 30fps', platformId: 'getty', group: 'platform', longEdge: 3840, defaultFps: 30 },
];

export const VIDEO_OUTPUT_FORMATS: Array<{ id: 'mp4' | 'webm'; label: string }> = [
  { id: 'mp4', label: 'MP4' },
  { id: 'webm', label: 'WebM' },
];

export function resolveVideoDimensions(
  srcW: number,
  srcH: number,
  longEdge: number,
): { width: number; height: number } {
  if (!srcW || !srcH) return { width: 1920, height: 1080 };
  const scale = longEdge / Math.max(srcW, srcH);
  // Ensure even width & height required by H.264 / HEVC / VP9 codecs.
  const width = Math.max(2, Math.round((srcW * scale) / 2) * 2);
  const height = Math.max(2, Math.round((srcH * scale) / 2) * 2);
  return { width, height };
}

export interface VideoMeta {
  width: number;
  height: number;
  duration: number;
  posterUrl?: string;
}

export function probeVideoFile(file: Blob): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
    };

    video.onloadeddata = () => {
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      let posterUrl: string | undefined;
      try {
        const c = document.createElement('canvas');
        const ratio = Math.min(1, 480 / Math.max(width, height));
        c.width = Math.max(1, Math.round(width * ratio));
        c.height = Math.max(1, Math.round(height * ratio));
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, c.width, c.height);
          posterUrl = c.toDataURL('image/jpeg', 0.8);
        }
      } catch {
        /* ignore poster error */
      }
      cleanup();
      resolve({ width, height, duration, posterUrl });
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Could not decode this video file.'));
    };

    video.src = url;
  });
}

function pickRecorderMime(preferred: 'mp4' | 'webm'): { mime: string; ext: 'mp4' | 'webm' } {
  const candidates: Array<{ mime: string; ext: 'mp4' | 'webm' }> =
    preferred === 'mp4'
      ? [
          { mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4' },
          { mime: 'video/mp4;codecs=avc1', ext: 'mp4' },
          { mime: 'video/mp4', ext: 'mp4' },
          { mime: 'video/webm;codecs=vp9,opus', ext: 'webm' },
          { mime: 'video/webm;codecs=vp8,opus', ext: 'webm' },
          { mime: 'video/webm', ext: 'webm' },
        ]
      : [
          { mime: 'video/webm;codecs=vp9,opus', ext: 'webm' },
          { mime: 'video/webm;codecs=vp8,opus', ext: 'webm' },
          { mime: 'video/webm', ext: 'webm' },
          { mime: 'video/mp4', ext: 'mp4' },
        ];

  if (typeof MediaRecorder !== 'undefined') {
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported(c.mime)) return c;
    }
  }
  return { mime: 'video/webm', ext: 'webm' };
}

/** GPU WebGL2 CAS / RCAS sharpening renderer for fast real time 4K/8K frames. */
function createWebglUpscaler(canvas: HTMLCanvasElement, sharpen: number, contrast: number) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: true });
  if (!gl) return null;

  const vsSource = `#version 300 es
    in vec2 a_pos;
    out vec2 v_uv;
    void main() {
      v_uv = a_pos * 0.5 + 0.5;
      v_uv.y = 1.0 - v_uv.y;
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }`;
  const fsSource = `#version 300 es
    precision highp float;
    uniform sampler2D u_tex;
    uniform vec2 u_texel;
    uniform float u_sharp;
    uniform float u_contrast;
    in vec2 v_uv;
    out vec4 outColor;
    void main() {
      vec3 c = texture(u_tex, v_uv).rgb;
      vec3 n = texture(u_tex, v_uv + vec2(0.0, -u_texel.y)).rgb;
      vec3 s = texture(u_tex, v_uv + vec2(0.0,  u_texel.y)).rgb;
      vec3 w = texture(u_tex, v_uv + vec2(-u_texel.x, 0.0)).rgb;
      vec3 e = texture(u_tex, v_uv + vec2( u_texel.x, 0.0)).rgb;
      vec3 blur = (n + s + w + e) * 0.25;
      vec3 mn = min(c, min(min(n, s), min(w, e)));
      vec3 mx = max(c, max(max(n, s), max(w, e)));
      vec3 sharpened = clamp(c + (c - blur) * (u_sharp * 1.6), mn - 0.02, mx + 0.02);
      vec3 graded = (sharpened - 0.5) * u_contrast + 0.5;
      outColor = vec4(clamp(graded, 0.0, 1.0), 1.0);
    }`;

  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return null;
    return sh;
  };
  const vs = compile(gl.VERTEX_SHADER, vsSource);
  const fs = compile(gl.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) return null;

  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;

  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const posLoc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  gl.useProgram(prog);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_sharp'), sharpen);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_contrast'), contrast);
  const texelLoc = gl.getUniformLocation(prog, 'u_texel');

  return {
    draw(video: HTMLVideoElement) {
      const vw = Math.max(1, video.videoWidth);
      const vh = Math.max(1, video.videoHeight);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(texelLoc, 1 / vw, 1 / vh);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    dispose() {
      gl.deleteTexture(tex);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
    },
  };
}

export interface UpscaleVideoOptions {
  modelId: string;
  target: VideoTarget;
  fps: 24 | 30 | 60;
  format: 'mp4' | 'webm';
  bitrateMbps: number;
  keepAudio: boolean;
  signal?: AbortSignal;
  onProgress?: (ratio: number, label: string) => void;
}

export interface UpscaleVideoResult {
  blob: Blob;
  filename: string;
  width: number;
  height: number;
  fps: number;
  format: 'mp4' | 'webm';
  sizeBytes: number;
}

export async function upscaleVideoInApp(
  file: Blob,
  sourceName: string,
  meta: VideoMeta,
  options: UpscaleVideoOptions,
): Promise<UpscaleVideoResult> {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Video encoder unavailable in this browser runtime.');
  }

  const model = VIDEO_MODELS.find((m) => m.id === options.modelId) ?? VIDEO_MODELS[0];
  const { width, height } = resolveVideoDimensions(meta.width, meta.height, options.target.longEdge);
  const chosen = pickRecorderMime(options.format);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const webgl = createWebglUpscaler(canvas, model.sharpen, model.contrast);
  const ctx2d = webgl ? null : canvas.getContext('2d');
  if (ctx2d) {
    ctx2d.imageSmoothingEnabled = true;
    ctx2d.imageSmoothingQuality = 'high';
    ctx2d.filter = `contrast(${model.contrast}) saturate(${model.saturate})`;
  }

  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = url;
  video.playsInline = true;
  video.muted = !options.keepAudio;
  video.volume = options.keepAudio ? 0.001 : 0;

  return new Promise<UpscaleVideoResult>((resolve, reject) => {
    let rafId = 0;
    let settled = false;
    const chunks: BlobPart[] = [];

    const cleanup = () => {
      cancelAnimationFrame(rafId);
      webgl?.dispose();
      video.pause();
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
    };

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    options.signal?.addEventListener('abort', () => {
      fail(new Error('Video upscaling canceled'));
    });

    video.onloadedmetadata = async () => {
      try {
        const stream = canvas.captureStream(options.fps);
        if (options.keepAudio) {
          try {
            const vidStream = (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.();
            for (const track of vidStream?.getAudioTracks() ?? []) {
              stream.addTrack(track);
            }
          } catch {
            /* clip has no audio track or audio capture is restricted */
          }
        }

        const recorder = new MediaRecorder(stream, {
          mimeType: chosen.mime,
          videoBitsPerSecond: Math.round(options.bitrateMbps * 1_000_000),
        });

        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) chunks.push(ev.data);
        };

        recorder.onerror = () => fail(new Error('Video encoding stopped unexpectedly'));

        recorder.onstop = () => {
          if (settled) return;
          settled = true;
          const outBlob = new Blob(chunks, { type: chosen.mime });
          const dot = sourceName.lastIndexOf('.');
          const stem = (dot > 0 ? sourceName.slice(0, dot) : sourceName).replace(/[-–—\s]+/g, '_');
          cleanup();
          options.onProgress?.(1, 'Complete');
          resolve({
            blob: outBlob,
            filename: `${stem}_${options.target.id}.${chosen.ext}`,
            width,
            height,
            fps: options.fps,
            format: chosen.ext,
            sizeBytes: outBlob.size,
          });
        };

        const renderLoop = () => {
          if (settled) return;
          if (webgl) webgl.draw(video);
          else if (ctx2d) ctx2d.drawImage(video, 0, 0, width, height);
          const dur = Math.max(0.1, video.duration || meta.duration || 1);
          const pct = Math.min(0.99, video.currentTime / dur);
          options.onProgress?.(
            pct,
            `${width}x${height} · ${Math.round(pct * 100)}%`,
          );
          if (!video.ended && !video.paused) {
            rafId = requestAnimationFrame(renderLoop);
          }
        };

        video.onended = () => {
          if (webgl) webgl.draw(video);
          else if (ctx2d) ctx2d.drawImage(video, 0, 0, width, height);
          if (recorder.state !== 'inactive') recorder.stop();
        };

        recorder.start(250);
        await video.play();
        renderLoop();
      } catch (err) {
        fail(err instanceof Error ? err : new Error(String(err)));
      }
    };

    video.onerror = () => fail(new Error('Could not read video stream'));
  });
}

/** Extract an upscaled 4K or 8K still frame from the video for stock photo submission. */
export async function extractUpscaledVideoFrame(
  video: HTMLVideoElement,
  target: VideoTarget,
  model: VideoModel,
  format: 'jpg' | 'png' = 'jpg',
): Promise<{ blob: Blob; width: number; height: number }> {
  const { width, height } = resolveVideoDimensions(
    video.videoWidth || 1920,
    video.videoHeight || 1080,
    target.longEdge,
  );
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const webgl = createWebglUpscaler(canvas, model.sharpen, model.contrast);
  if (webgl) {
    webgl.draw(video);
  } else {
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(video, 0, 0, width, height);
  }
  const mime = format === 'png' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Frame capture failed'))), mime, 0.95),
  );
  webgl?.dispose();
  return { blob, width, height };
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
