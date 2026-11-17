import type { StudioIconName } from '@/components/vector/StudioIcon';
import type { AlignMode, Box } from '@/lib/vector/editor';

/**
 * Studio vocabulary.
 *
 * Tools, canvas presets, the alignment map and the geometry each drawing tool
 * produces live here so the editor page only carries interaction logic.
 */

export type Tool =
  | 'select'
  | 'rect'
  | 'roundrect'
  | 'ellipse'
  | 'circle'
  | 'triangle'
  | 'diamond'
  | 'star'
  | 'polygon'
  | 'line'
  | 'arrow'
  | 'text';

export const TOOLS
: Array<{ id: Tool; icon: StudioIconName; label: string; shortcut: string }> = [
  { id: 'select', icon: 'cursor', label: 'Select', shortcut: 'V' },
  { id: 'rect', icon: 'rect', label: 'Rectangle', shortcut: 'R' },
  { id: 'roundrect', icon: 'roundrect', label: 'Rounded box', shortcut: 'U' },
  { id: 'ellipse', icon: 'ellipse', label: 'Ellipse', shortcut: 'O' },
  { id: 'circle', icon: 'circle', label: 'Circle', shortcut: 'C' },
  { id: 'triangle', icon: 'triangle', label: 'Triangle', shortcut: 'G' },
  { id: 'diamond', icon: 'diamond', label: 'Diamond', shortcut: 'D' },
  { id: 'star', icon: 'star', label: 'Star', shortcut: 'S' },
  { id: 'polygon', icon: 'polygon', label: 'Polygon', shortcut: 'P' },
  { id: 'line', icon: 'line', label: 'Line', shortcut: 'L' },
  { id: 'arrow', icon: 'arrow', label: 'Arrow', shortcut: 'A' },
  { id: 'text', icon: 'text', label: 'Text', shortcut: 'T' },
];

export const DOC_PRESETS = [
  { id: 'square', label: 'Square', size: '2000 × 2000', w: 2000, h: 2000 },
  { id: 'photo', label: 'Photo', size: '4000 × 3000', w: 4000, h: 3000 },
  { id: 'hd', label: 'HD', size: '3840 × 2160', w: 3840, h: 2160 },
  { id: 'portrait', label: 'Portrait', size: '3000 × 4000', w: 3000, h: 4000 },
  { id: 'story', label: 'Story', size: '1080 × 1920', w: 1080, h: 1920 },
  { id: 'social', label: 'Wide', size: '1200 × 630', w: 1200, h: 630 },
];


export const ALIGN_BUTTONS: Array<{ mode: AlignMode; icon: StudioIconName; label: string }> = [
  { mode: 'left', icon: 'align_left', label: 'Align left' },
  { mode: 'center', icon: 'align_center_h', label: 'Centre' },
  { mode: 'right', icon: 'align_right', label: 'Align right' },
  { mode: 'top', icon: 'align_top', label: 'Align top' },
  { mode: 'middle', icon: 'align_middle', label: 'Middle' },
  { mode: 'bottom', icon: 'align_bottom', label: 'Align bottom' },
];

export const ICON_FOR_TAG: Record<string, StudioIconName> = {
  rect: 'rect',
  circle: 'circle',
  ellipse: 'ellipse',
  line: 'line',
  text: 'text',
  g: 'group',
  path: 'polygon',
};

export const round = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export const num = (value: string | number | null | undefined, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function shapePath(tool: Tool, box: Box): string {
  const { x, y, w, h } = box;
  const cx = x + w / 2;
  const cy = y + h / 2;
  switch (tool) {
    case 'triangle':
      return `M ${round(cx)} ${round(y)} L ${round(x + w)} ${round(y + h)} L ${round(x)} ${round(y + h)} Z`;
    case 'diamond':
      return `M ${round(cx)} ${round(y)} L ${round(x + w)} ${round(cy)} L ${round(cx)} ${round(y + h)} L ${round(x)} ${round(cy)} Z`;
    case 'polygon': {
      const points: string[] = [];
      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        points.push(`${round(cx + Math.cos(angle) * (w / 2))} ${round(cy + Math.sin(angle) * (h / 2))}`);
      }
      return `M ${points.join(' L ')} Z`;
    }
    case 'star': {
      const points: string[] = [];
      for (let i = 0; i < 10; i += 1) {
        const radius = i % 2 === 0 ? 0.5 : 0.21;
        const angle = (Math.PI / 5) * i - Math.PI / 2;
        points.push(`${round(cx + Math.cos(angle) * w * radius)} ${round(cy + Math.sin(angle) * h * radius)}`);
      }
      return `M ${points.join(' L ')} Z`;
    }
    case 'arrow': {
      const shaft = h * 0.34;
      const tip = Math.min(w * 0.38, h * 0.6);
      const top = cy - shaft / 2;
      const bottom = cy + shaft / 2;
      return `M ${round(x)} ${round(top)} L ${round(x + w - tip)} ${round(top)} L ${round(x + w - tip)} ${round(y)} L ${round(x + w)} ${round(cy)} L ${round(x + w - tip)} ${round(y + h)} L ${round(x + w - tip)} ${round(bottom)} L ${round(x)} ${round(bottom)} Z`;
    }
    default:
      return `M ${round(x)} ${round(y)} L ${round(x + w)} ${round(y + h)}`;
  }
}
