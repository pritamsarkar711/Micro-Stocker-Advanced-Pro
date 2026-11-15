/** Core domain types for the microstock toolkit. */

export type StockFormat = 'jpg' | 'png' | 'eps' | 'ai' | 'svg' | 'webp';

export type PlatformId =
  | 'shutterstock'
  | 'adobe'
  | 'freepik'
  | 'pixabay'
  | 'dreamstime'
  | '123rf'
  | 'depositphotos'
  | 'vecteezy'
  | 'getty'
  | 'alamy'
  | 'pond5'
  | 'vectorstock'
  | 'canva'
  | 'envato';

export interface StockMetadata {
  title: string;
  description: string;
  keywords: string[];
  categories: string[];
}

export interface ItemFlags {
  aiGenerated: boolean;
  aiTool: string;
  editorial: boolean;
  mature: boolean;
  illustration: boolean;
  /** Vecteezy CSV license column. */
  license: 'free' | 'pro' | 'editorial';
}

export interface StockItem {
  id: string;
  name: string;
  format: StockFormat;
  sizeBytes: number;
  width?: number;
  height?: number;
  /** Desktop: absolute path on disk. Browser: undefined. */
  path?: string;
  /** Session-only object URL for thumbnails/previews. */
  thumbUrl?: string;
  /** True when raw bytes are held in the session (browser import). */
  inMemory?: boolean;
  metadata: StockMetadata;
  flags: ItemFlags;
  /** Release registry ids covering recognisable people/property in this file. */
  releaseIds?: string[];
  embeddedAt: string | null;
  importedAt: string;
  updatedAt: string;
}

export type ContentKind = 'photo' | 'vector' | 'raster-illustration';

export function kindOf(item: StockItem): ContentKind {
  if (item.format === 'eps' || item.format === 'ai' || item.format === 'svg') return 'vector';
  if (item.flags.illustration) return 'raster-illustration';
  return 'photo';
}

export function megapixels(item: StockItem): number | null {
  if (!item.width || !item.height) return null;
  return (item.width * item.height) / 1_000_000;
}

export interface Issue {
  level: 'error' | 'warn' | 'info';
  scope: 'file' | 'metadata' | 'platform' | 'policy';
  platform?: PlatformId;
  message: string;
  hint?: string;
}

export const EMPTY_METADATA: StockMetadata = {
  title: '',
  description: '',
  keywords: [],
  categories: [],
};

export const DEFAULT_FLAGS: ItemFlags = {
  aiGenerated: false,
  aiTool: '',
  editorial: false,
  mature: false,
  illustration: false,
  license: 'free',
};
