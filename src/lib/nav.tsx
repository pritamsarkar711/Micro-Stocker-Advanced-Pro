import type { ReactNode } from 'react';
import {
  Cloud,
  Gauge,
  Info,
  MonitorSmartphone,
  Settings,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  group: 'main' | 'system';
  /** Shown in the phone bottom tab bar (max 4 recommended). */
  tab?: boolean;
  description?: string;
}

/**
 * Navigation is data-driven: when the real feature spec arrives, new modules
 * (Inventory, POS, Purchases, Reports…) are added here only.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Overview',
    icon: <Gauge className="size-5" />,
    group: 'main',
    tab: true,
    description: 'System status at a glance',
  },
  {
    to: '/cloud',
    label: 'Cloud connection',
    icon: <Cloud className="size-5" />,
    group: 'main',
    tab: true,
    description: 'Supabase project, credentials and sync',
  },
  {
    to: '/responsive',
    label: 'Responsive lab',
    icon: <MonitorSmartphone className="size-5" />,
    group: 'system',
    tab: true,
    description: 'Prove the layout adapts at every width',
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: <Settings className="size-5" />,
    group: 'system',
    tab: true,
    description: 'Appearance, scale, data and shortcuts',
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
  { id: 'main', title: 'Workspace' },
  { id: 'system', title: 'System' },
] as const;
