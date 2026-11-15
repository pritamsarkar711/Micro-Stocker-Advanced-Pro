import type { ReactNode } from 'react';
import {
  BarChart3,
  BookMarked,
  CalendarCheck,
  Cloud,
  FileDown,
  FileSignature,
  Gauge,
  Images,
  Layers,
  Settings,
  ShieldCheck,
  Store,
  Zap,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  group: 'workflow' | 'data' | 'system';
  /** One of the four phone tab-bar entries. */
  tab?: boolean;
  /** Extra search terms for Ctrl+K. */
  keywords?: string;
}

export const NAV_GROUPS = [
  { id: 'workflow', title: 'Workflow' },
  { id: 'data', title: 'Data' },
  { id: 'system', title: 'System' },
] as const;

/**
 * Grouped by the job a contributor is doing: prepare files, publish them,
 * then read the numbers. Each item carries a single-word label — the icon
 * plus the label is the whole affordance.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Overview', icon: <Gauge className="size-[1.15rem]" />, group: 'workflow', keywords: 'dashboard home status' },
  { to: '/library', label: 'Library', icon: <Images className="size-[1.15rem]" />, group: 'workflow', tab: true, keywords: 'files import metadata keywords edit' },
  { to: '/prepare', label: 'Prepare', icon: <ShieldCheck className="size-[1.15rem]" />, group: 'workflow', keywords: 'file doctor exif gps vector sanitize resize' },
  { to: '/upscale', label: 'Upscale', icon: <Zap className="size-[1.15rem]" />, group: 'workflow', tab: true, keywords: 'ai real-esrgan 8k upscale enlarge' },
  { to: '/export', label: 'Export', icon: <FileDown className="size-[1.15rem]" />, group: 'workflow', tab: true, keywords: 'csv download rename embed' },
  { to: '/plan', label: 'Planner', icon: <CalendarCheck className="size-[1.15rem]" />, group: 'workflow', keywords: 'queue submission caps batch' },
  { to: '/platforms', label: 'Platforms', icon: <Store className="size-[1.15rem]" />, group: 'workflow', tab: true, keywords: 'marketplace rules requirements limits' },
  { to: '/releases', label: 'Releases', icon: <FileSignature className="size-[1.15rem]" />, group: 'data', keywords: 'model property release contract' },
  { to: '/earnings', label: 'Earnings', icon: <BarChart3 className="size-[1.15rem]" />, group: 'data', keywords: 'sales revenue royalties reports' },
  { to: '/bank', label: 'Keywords', icon: <BookMarked className="size-[1.15rem]" />, group: 'data', keywords: 'bank synonyms categories translations' },
  { to: '/cloud', label: 'Cloud', icon: <Cloud className="size-[1.15rem]" />, group: 'system', keywords: 'supabase sync backup' },
  { to: '/settings', label: 'Settings', icon: <Settings className="size-[1.15rem]" />, group: 'system', keywords: 'theme zoom density preferences backup' },
  { to: '/about', label: 'About', icon: <Layers className="size-[1.15rem]" />, group: 'system', keywords: 'version licence build' },
];

export const TAB_ITEMS = NAV_ITEMS.filter((item) => item.tab);
