import { GIcon, type GoogleIconName } from './GoogleIcon';

const FORMAT_ICONS: Record<string, GoogleIconName> = {
  // Web & Next-Gen
  jpg: 'photo_camera',
  jpeg: 'photo_camera',
  jfif: 'photo_camera',
  png: 'image',
  apng: 'animation',
  webp: 'public',
  avif: 'high_quality',
  jxl: 'photo_size_select_large',
  heif: 'photo_camera',
  heic: 'photo_camera',
  jp2: 'hd',
  j2k: 'hd',
  gif: 'gif_box',
  qoi: 'speed',
  // Stock, Print & Design
  tiff: 'photo_library',
  tif: 'photo_library',
  psd: 'layers',
  psb: 'layers',
  svg: 'polyline',
  svgz: 'polyline',
  eps: 'draw',
  pdf: 'description',
  ai: 'brush',
  // HDR, VFX, Cinema & 3D
  exr: 'light_mode',
  hdr: 'light_mode',
  pfm: 'tune',
  tga: 'texture',
  dds: 'grid_view',
  ktx: 'memory',
  dpx: 'movie',
  cin: 'theaters',
  sgi: 'landscape',
  fits: 'explore',
  // Desktop, Icons & UI
  bmp: 'grid_view',
  dib: 'grid_view',
  ico: 'apps',
  cur: 'center_focus_strong',
  icns: 'desktop_windows',
  xbm: 'code',
  xpm: 'palette',
  // Netpbm & Classic
  pam: 'filter_center_focus',
  ppm: 'palette',
  pgm: 'contrast',
  pbm: 'grain',
  pnm: 'image',
  farbfeld: 'inventory_2',
  ff: 'inventory_2',
  pcx: 'brush',
  wbmp: 'straighten',
  ras: 'grid_view',
  iff: 'photo_camera',
  lbm: 'photo_camera',
  // Camera RAW
  dng: 'camera',
  cr2: 'camera',
  cr3: 'camera',
  nef: 'camera',
  arw: 'camera',
  raf: 'camera',
  orf: 'camera',
  rw2: 'camera',
  pef: 'camera',
  srw: 'camera',
  raw: 'camera',
  xcf: 'brush',
  ora: 'layers',
  sketch: 'draw',
  fig: 'draw',
  xd: 'draw',
  jpe: 'photo_camera',
  jng: 'photo_camera',
  mng: 'animation',
  koa: 'image',
  pic: 'image',
  pcd: 'photo_camera',
  zip: 'folder_open',
  // Video & Data
  mp4: 'movie',
  webm: 'smart_display',
  mov: 'video_file',
  mkv: 'video_file',
  csv: 'table_chart',
  xmp: 'code',
  all: 'layers',
};

export function formatIconName(format: string): GoogleIconName {
  return FORMAT_ICONS[format.toLowerCase()] ?? 'image';
}

export function FormatIcon({
  format,
  size = 16,
  className,
}: {
  format: string;
  size?: number;
  className?: string;
}) {
  return <GIcon name={formatIconName(format)} size={size} className={className} />;
}
