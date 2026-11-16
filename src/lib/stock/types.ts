/** Core domain types for the microstock toolkit. */

export type StockFormat =
  | 'jpg'
  | 'png'
  | 'eps'
  | 'ai'
  | 'svg'
  | 'webp'
  | 'tiff'
  | 'avif'
  | 'bmp'
  | 'gif'
  | 'ico';

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
  aiPrompt?: string;
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
  path?: string;
  thumbUrl?: string;
  inMemory?: boolean;
  metadata: StockMetadata;
  flags: ItemFlags;
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
  aiPrompt: '',
  editorial: false,
  mature: false,
  illustration: false,
  license: 'free',
};
