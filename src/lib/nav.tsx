import type { ReactNode } from 'react';
import {
  Box,
  Cloud,
  FileDown,
  Gauge,
  Info,
  MonitorSmartphone,
  Settings,
  Store,
  Zap,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  group: 'main' | 'system';
  /** Shown in the phone bottom tab bar (exactly 4). */
  tab?: boolean;
  description?: string;
}

/**
 * Navigation is data-driven: the microstock modules live under "Workflow",
 * infrastructure pages under "System".
 */
export const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Overview',
    icon: <Gauge className="size-5" />,
    group: 'main',
    description: 'System status at a glance',
  },
  {
    to: '/library',
    label: 'Library',
    icon: <Box className="size-5" />,
    group: 'main',
    tab: true,
    description: 'Import, edit and embed stock metadata',
  },
  {
    to: '/export',
    label: 'Export',
    icon: <FileDown className="size-5" />,
    group: 'main',
    tab: true,
    description: 'Per-platform CSV, renames and embedding',
  },
  {
    to: '/upscale',
    label: 'Upscale',
    icon: <Zap className="size-5" />,
    group: 'main',
    tab: true,
    description: 'Local AI upscaling to 8K with licence-safe models',
  },
  {
    to: '/platforms',
    label: 'Platforms',
    icon: <Store className="size-5" />,
    group: 'main',
    tab: true,
    description: 'Requirement reference for 10 marketplaces',
  },
  {
    to: '/cloud',
    label: 'Cloud connection',
    icon: <Cloud className="size-5" />,
    group: 'system',
    description: 'Supabase project, credentials and sync',
  },
  {
    to: '/responsive',
    label: 'Responsive lab',
    icon: <MonitorSmartphone className="size-5" />,
    group: 'system',
    description: 'Prove the layout adapts at every width',
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: <Settings className="size-5" />,
    group: 'system',
    description: 'Appearance, scale, AI assistant, data',
  },
  {
    to: '/about',
    label: 'About',
    icon: <Info className="size-5" />,
    group: 'system',
    description: 'Runtime, versions and licence',
  },
];

export const NAV_GROUPS = [
  { id: 'main', title: 'Workflow' },
  { id: 'system', title: 'System' },
] as const;
