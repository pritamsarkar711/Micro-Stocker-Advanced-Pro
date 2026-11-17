import type { GoogleIconName } from '@/components/ui/GoogleIcon';

export interface NavItem {
  to: string;
  label: string;
  shortLabel?: string;
  icon: GoogleIconName;
  group: 'workspace' | 'tools' | 'catalog' | 'system';
  keywords?: string[];
  mobileTab?: boolean;
}

export const NAV_GROUPS: Array<{ id: NavItem['group']; label: string }> = [
  { id: 'workspace', label: 'Workspace' },
  { id: 'tools', label: 'Studio Tools' },
  { id: 'catalog', label: 'Catalog' },
  { id: 'system', label: 'System & Help' },
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
    to: '/library',
    label: 'Library & Metadata',
    shortLabel: 'Library',
    icon: 'photo_library',
    group: 'workspace',
    keywords: ['import', 'keywords', 'title', 'ai', 'tag', 'xmp', 'iptc'],
    mobileTab: true,
  },
  {
    to: '/prepare',
    label: 'Prepare',
    icon: 'tune',
    group: 'workspace',
    keywords: ['exif', 'gps', 'strip', 'svg', 'eps', 'duplicates', 'resize'],
  },
  {
    to: '/export',
    label: 'Export & CSV',
    shortLabel: 'Export',
    icon: 'upload_file',
    group: 'workspace',
    keywords: ['csv', 'shutterstock', 'adobe', 'freepik', 'embed', 'xmp'],
    mobileTab: true,
  },

  /* Studio tools */
  {
    to: '/upscale',
    label: 'Image Upscaler',
    shortLabel: 'Upscale',
    icon: 'photo_size_select_large',
    group: 'tools',
    keywords: ['4k', '8k', 'realesrgan', 'waifu2x', 'enlarge', 'super resolution'],
    mobileTab: true,
  },
  {
    to: '/video-upscale',
    label: 'Video Upscaler',
    shortLabel: 'Video',
    icon: 'videocam',
    group: 'tools',
    keywords: ['footage', '4k', '8k', '60fps', 'rife', 'anime4k', 'mp4'],
  },
  {
    to: '/bg-remove',
    label: 'Background Remover',
    shortLabel: 'Cutout',
    icon: 'content_cut',
    group: 'tools',
    keywords: ['cutout', 'transparent', 'png', 'rembg', 'u2net', 'birefnet', 'isnet', 'isolate'],
  },
  {
    to: '/convert',
    label: 'Image Converter',
    shortLabel: 'Convert',
    icon: 'swap_horiz',
    group: 'tools',
    keywords: ['jpg', 'png', 'webp', 'avif', 'tiff', 'bmp', 'ico', 'gif', 'svg', 'format'],
    mobileTab: true,
  },

  /* Catalog */
  { to: '/plan', label: 'Submission Tracker', icon: 'assignment_turned_in', group: 'catalog', keywords: ['queue', 'submission', 'status'] },
  { to: '/earnings', label: 'Earnings', icon: 'table_chart', group: 'catalog', keywords: ['sales', 'royalties', 'revenue'] },
  {
    to: '/planner',
    label: 'Planner',
    icon: 'calendar_month',
    group: 'catalog',
    keywords: ['seasonal', 'holidays', 'events', 'schedule'],
  },
  {
    to: '/platforms',
    label: 'Platform Rules',
    shortLabel: 'Platforms',
    icon: 'storefront',
    group: 'catalog',
    keywords: ['shutterstock', 'adobe', 'freepik', 'getty', 'requirements', 'specs'],
  },
  {
    to: '/releases',
    label: 'Releases',
    icon: 'assignment_turned_in',
    group: 'catalog',
    keywords: ['model release', 'property release', 'consent'],
  },
  {
    to: '/bank',
    label: 'Keyword Bank',
    icon: 'local_offer',
    group: 'catalog',
    keywords: ['synonyms', 'vocabulary', 'translations'],
  },

  /* System & Help */
  { to: '/subscription', label: 'Subscription', icon: 'workspace_premium', group: 'system', keywords: ['activation', 'premium', 'licence', 'subscription'] },
  {
    to: '/cloud',
    label: 'Cloud Sync',
    icon: 'cloud_sync',
    group: 'system',
    keywords: ['supabase', 'backup', 'sync', 'database'],
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: 'settings',
    group: 'system',
    keywords: ['theme', 'currency', 'ai', 'openrouter', 'gemini', 'ollama', 'color'],
  },
  {
    to: '/contact',
    label: 'Contact',
    icon: 'send',
    group: 'system',
    keywords: ['telegram', 'support', 'creator', 'message', 'joegoldberg2025'],
  },
  {
    to: '/report',
    label: 'Report Issue',
    icon: 'bug_report',
    group: 'system',
    keywords: ['bug', 'feedback', 'problem', 'report'],
  },
  {
    to: '/about',
    label: 'About',
    icon: 'info',
    group: 'system',
    keywords: ['version', 'license', 'desktop'],
  },
];

export const MOBILE_TABS = NAV_ITEMS.filter((item) => item.mobileTab);
