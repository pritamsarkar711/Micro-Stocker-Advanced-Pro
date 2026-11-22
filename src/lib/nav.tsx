import type { GoogleIconName } from '@/components/ui/GoogleIcon';

export interface NavItem {
  to: string;
  label: string;
  shortLabel?: string;
  icon: GoogleIconName;
  group: 'workspace' | 'tools' | 'catalog' | 'system';
  keywords?: string[];
  mobileTab?: boolean;
  /** Only rendered for accounts with the administrator role. */
  adminOnly?: boolean;
  /** Reachable from Settings and cross-links, hidden from the primary rail. */
  secondary?: boolean;
}

export const NAV_GROUPS: Array<{ id: NavItem['group']; label: string }> = [
  { id: 'workspace', label: 'Workspace' },
  { id: 'tools', label: 'Studio Tools' },
  { id: 'catalog', label: 'Catalog' },
  { id: 'system', label: 'Account & System' },
];

export const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Overview',
    icon: 'dashboard',
    group: 'workspace',
    keywords: ['home', 'summary', 'stats'],
    mobileTab: true,
  },
  {
    to: '/metadata',
    label: 'Metadata Generator',
    shortLabel: 'Metadata',
    icon: 'photo_library',
    group: 'workspace',
    keywords: ['import', 'keywords', 'title', 'ai', 'tag', 'csv', 'eps', 'svg', 'jpg', 'png'],
    mobileTab: true,
  },
  {
    to: '/upscale',
    label: 'Image Upscaler',
    shortLabel: 'Upscale',
    icon: 'photo_size_select_large',
    group: 'tools',
    keywords: ['2k', '4k', '8k', 'upscale', 'enlarge', 'super resolution'],
    mobileTab: true,
  },
  {
    to: '/video-upscale',
    label: 'Video Upscaler',
    shortLabel: 'Video',
    icon: 'videocam',
    group: 'tools',
    keywords: ['2k', '4k', '8k', 'footage', 'enlarge', 'mp4'],
  },
  {
    to: '/bg-remove',
    label: 'Background Remover',
    shortLabel: 'Cutout',
    icon: 'content_cut',
    group: 'tools',
    keywords: ['cutout', 'transparent', 'png', 'rembg', 'isolate'],
  },
  {
    to: '/quality',
    label: 'Quality Checker',
    shortLabel: 'Quality',
    icon: 'fact_check',
    group: 'tools',
    keywords: ['check', 'sharpness', 'blur', 'duplicate', 'review'],
  },
  {
    to: '/optimize',
    label: 'Image Optimizer',
    shortLabel: 'Optimize',
    icon: 'compress',
    group: 'tools',
    keywords: ['compress', 'webp', 'avif', 'filesize'],
  },
  {
    to: '/convert',
    label: 'Image Converter',
    shortLabel: 'Convert',
    icon: 'swap_horiz',
    group: 'tools',
    keywords: ['jpg', 'png', 'webp', 'avif', 'tiff', 'bmp', 'ico', 'gif', 'format'],
    mobileTab: true,
  },
  {
    to: '/vectorize',
    label: 'Image to Vector',
    shortLabel: 'Vectorize',
    icon: 'polyline',
    group: 'tools',
    keywords: ['png', 'jpg', 'webp', 'svg', 'eps', 'ai', 'vector', 'illustrator'],
    mobileTab: true,
  },
  {
    to: '/motion',
    label: 'Motion Video',
    shortLabel: 'Motion',
    icon: 'videocam',
    group: 'tools',
    keywords: ['animation', 'loop', '4k', '8k', 'generate', 'video'],
    mobileTab: true,
  },
  {
    to: '/backgrounds',
    label: 'Backgrounds',
    shortLabel: 'Backgrounds',
    icon: 'image',
    group: 'tools',
    keywords: ['background', 'texture', 'pattern', 'style', 'svg', 'eps', '2k', '4k', '8k'],
    mobileTab: true,
  },

  /* Catalog */
  {
    to: '/earnings',
    label: 'Earnings',
    icon: 'table_chart',
    group: 'catalog',
    keywords: ['sales', 'royalties', 'revenue'],
  },
  {
    to: '/planner',
    label: 'Planner',
    icon: 'calendar_month',
    group: 'catalog',
    secondary: true,
    keywords: ['seasonal', 'holidays', 'events', 'schedule'],
  },
  {
    to: '/releases',
    label: 'Releases',
    icon: 'assignment_turned_in',
    group: 'catalog',
    secondary: true,
    keywords: ['model release', 'property release', 'consent'],
  },
  {
    to: '/bank',
    label: 'Keyword Bank',
    icon: 'local_offer',
    group: 'catalog',
    secondary: true,
    keywords: ['synonyms', 'vocabulary', 'translations'],
  },

  /* Account & system */
  {
    to: '/subscription',
    label: 'Subscription',
    icon: 'workspace_premium',
    group: 'system',
    keywords: ['activation', 'premium', 'licence', 'license', 'code', 'plan'],
  },
  {
    to: '/admin',
    label: 'Admin Console',
    icon: 'admin_panel_settings',
    group: 'system',
    keywords: ['codes', 'tokens', 'licenses', 'users', 'subscriptions', 'manage'],
    adminOnly: true,
  },
  {
    to: '/cloud',
    label: 'Sync & devices',
    icon: 'cloud_sync',
    group: 'system',
    keywords: ['devices', 'backup', 'sync', 'desktop', 'android', 'web'],
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: 'settings',
    group: 'system',
    keywords: ['theme', 'currency', 'ai', 'openrouter', 'gemini', 'custom', 'color'],
  },
  {
    to: '/contact',
    label: 'Contact',
    icon: 'send',
    group: 'system',
    secondary: true,
    keywords: ['telegram', 'support', 'creator', 'message', 'joegoldberg2025'],
  },
  {
    to: '/about',
    label: 'About',
    icon: 'info',
    group: 'system',
    secondary: true,
    keywords: ['version', 'license', 'desktop'],
  },
];

/** Navigation visible to a given role. Admin-only entries are never rendered
 * for regular users – role checks are repeated on the route level too. */
export function navItemsFor(isAdmin: boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.secondary && (!item.adminOnly || isAdmin));
}

export function navGroupsFor(isAdmin: boolean) {
  const items = navItemsFor(isAdmin);
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: items.filter((item) => item.group === group.id),
  })).filter((group) => group.items.length > 0);
}

export const MOBILE_TABS = NAV_ITEMS.filter((item) => item.mobileTab && !item.adminOnly);

/** Secondary destinations surfaced from Settings instead of the rail. */
export const SECONDARY_NAV = NAV_ITEMS.filter((item) => item.secondary && !item.adminOnly);
