import clsx from 'clsx';
import type { ReactNode, SVGProps } from 'react';

/**
 * Vector Studio glyph set.
 *
 * The studio needs geometry glyphs (triangle, polygon, pen, alignment) that do
 * not exist in the Material Symbols subset used elsewhere, so they live here as
 * a small stroke-based set drawn on the same 24px grid, 1.7px stroke and round
 * joins. Everything inherits `currentColor`, so light and dark themes are free.
 */
const GLYPHS: Record<string, ReactNode> = {
  cursor: <path d="M5 3.2 18.4 10 13 11.4 10.6 18.2 5 3.2Z" />,
  marquee: <path d="M4 8V5.6A1.6 1.6 0 0 1 5.6 4H8M16 4h2.4A1.6 1.6 0 0 1 20 5.6V8M20 16v2.4a1.6 1.6 0 0 1-1.6 1.6H16M8 20H5.6A1.6 1.6 0 0 1 4 18.4V16" strokeDasharray="2.4 2.4" />,
  rect: <rect x="3.6" y="5.6" width="16.8" height="12.8" rx="0.8" />,
  roundrect: <rect x="3.6" y="5.6" width="16.8" height="12.8" rx="4" />,
  ellipse: <ellipse cx="12" cy="12" rx="8.4" ry="6.6" />,
  circle: <circle cx="12" cy="12" r="7.4" />,
  triangle: <path d="M12 4 20.4 19H3.6L12 4Z" />,
  diamond: <path d="M12 3.6 20.4 12 12 20.4 3.6 12 12 3.6Z" />,
  star: <path d="m12 3.8 2.5 5.3 5.7.7-4.2 4 1.1 5.7L12 16.8 6.9 19.5l1.1-5.7-4.2-4 5.7-.7L12 3.8Z" />,
  polygon: <path d="M12 3.4 19.6 8.3v7.4L12 20.6 4.4 15.7V8.3L12 3.4Z" />,
  line: <path d="M4.6 19.4 19.4 4.6" />,
  arrow: <path d="M3.8 20.2 20.2 3.8M20.2 3.8H12M20.2 3.8v8.2" />,
  pen: <path d="M4 20c1.2-4.4 2.5-7.4 4.6-9.6 2-2.2 4.6-3.4 7.2-4.6M4 20l1.2-4.4c.5-1.7 1.6-2.9 3.3-3.4" />,
  text: <path d="M4.8 6.4V4.8h14.4v1.6M12 4.8v14.4M9 19.2h6" />,
  hand: <path d="M8 13.4V6.6a1.4 1.4 0 0 1 2.8 0v5.2m0-1V4.6a1.4 1.4 0 0 1 2.8 0v6.2m0-.6a1.4 1.4 0 0 1 2.8 0v3.2c0 4.3-2.5 6.6-5.8 6.6-2 0-3.4-.8-4.5-2.4L4.4 15a1.5 1.5 0 0 1 2.3-1.9L8 14.4" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  fit: <path d="M4 8.4V5.6A1.6 1.6 0 0 1 5.6 4h2.8M15.6 4h2.8A1.6 1.6 0 0 1 20 5.6v2.8M20 15.6v2.8a1.6 1.6 0 0 1-1.6 1.6h-2.8M8.4 20H5.6A1.6 1.6 0 0 1 4 18.4v-2.8M9 9h6v6H9z" />,
  undo: <path d="M8.4 8.4H15a4.6 4.6 0 0 1 0 9.2h-4.4M8.4 8.4l3-3M8.4 8.4l3 3" />,
  redo: <path d="M15.6 8.4H9a4.6 4.6 0 0 0 0 9.2h4.4M15.6 8.4l-3-3M15.6 8.4l-3 3" />,
  align_left: <path d="M4 4v16M7.6 7.6h9.6M7.6 16.4h6" />,
  align_center_h: <path d="M12 4v16M6.4 7.6h11.2M8.8 16.4h6.4" />,
  align_right: <path d="M20 4v16M6.8 7.6h9.6M10.4 16.4h6" />,
  align_top: <path d="M4 4h16M7.6 7.6v9.6M16.4 7.6v6" />,
  align_middle: <path d="M4 12h16M7.6 6.4v11.2M16.4 8.8v6.4" />,
  align_bottom: <path d="M4 20h16M7.6 6.8v9.6M16.4 10.4v6" />,
  front: <path d="M8.4 4.4h11.2v11.2H8.4zM4.4 8.4v11.2h11.2" />,
  back: <path d="M4.4 8.4h11.2v11.2H4.4zM8.4 4.4h11.2v11.2" />,
  up: <path d="M12 19V6M7.4 10.6 12 6l4.6 4.6" />,
  down: <path d="M12 5v13M7.4 13.4 12 18l4.6-4.6" />,
  group: <path d="M4.4 8.4h11.2v11.2H4.4zM8.4 8.4V4.4h11.2v11.2h-4" />,
  ungroup: <path d="M4 4h6.4v6.4H4zM13.6 13.6H20V20h-6.4zM13.6 4h2.8M4 13.6v2.8" />,
  copy: <path d="M9 9h10.4v10.4H9zM15 9V4.6H4.6V15H9" />,
  trash: <path d="M4.6 6.8h14.8M9.6 6.8V4.6h4.8v2.2M6.4 6.8l.9 12.6h9.4l.9-12.6M10.4 10.4v5.8M13.6 10.4v5.8" />,
  eye: <path d="M2.8 12S6.4 6.2 12 6.2 21.2 12 21.2 12 17.6 17.8 12 17.8 2.8 12 2.8 12Z" />,
  eye_off: <path d="M4 4l16 16M9.4 5.1A9.8 9.8 0 0 1 12 4.8c5.6 0 9.2 7.2 9.2 7.2a17 17 0 0 1-3 3.9M6.2 7.1A17 17 0 0 0 2.8 12S6.4 19.2 12 19.2c1.3 0 2.5-.4 3.6-1" />,
  lock: <path d="M6.6 10.4h10.8v9H6.6zM9 10.4V7.8a3 3 0 0 1 6 0v2.6" />,
  unlock: <path d="M6.6 10.4h10.8v9H6.6zM9 10.4V7.8a3 3 0 0 1 5.6-1.5" />,
  download: <path d="M12 4v11M7.6 11l4.4 4.4 4.4-4.4M4.6 19.4h14.8" />,
  image: <path d="M4.4 5.6h15.2v12.8H4.4zM4.4 15.4l4.2-4.2 3.6 3.6 2.8-2.6 4.6 4.4M15.8 9.4a1.2 1.2 0 1 0 0-.1" />,
  grid: <path d="M4.4 4.4h6v6h-6zM13.6 4.4h6v6h-6zM4.4 13.6h6v6h-6zM13.6 13.6h6v6h-6z" />,
  layers: <path d="M12 3.6 20.4 8 12 12.4 3.6 8 12 3.6ZM3.6 12.6 12 17l8.4-4.4M3.6 16.8 12 21.2l8.4-4.4" />,
  preview: <path d="M4.4 5.6h15.2v12.8H4.4zM10 9.4l4.4 2.6L10 14.6V9.4Z" />,
  rotate: <path d="M19 12a7 7 0 1 1-2.4-5.3M19 4.4V9h-4.6" />,
  check: <path d="M4.8 12.6 9.4 17l9.8-10" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  chevron_down: <path d="m6.4 9.4 5.6 5.6 5.6-5.6" />,
  save: <path d="M5 5.6h11.2L19 8.4V19H5zM8.4 5.6v4.8h6.6M8.4 19v-5.2h7.2V19" />,
  refresh: <path d="M4.6 12a7.4 7.4 0 0 1 12.8-5M19.4 12a7.4 7.4 0 0 1-12.8 5M17.4 3.6V7.2h-3.6M6.6 20.4V16.8H10" />,
  ruler: <path d="M3.6 14.4 14.4 3.6l6 6L9.6 20.4zM7.8 10.2l1.8 1.8M10.8 7.2l1.8 1.8M13.8 4.2l1.8 1.8" />,
  search: <path d="M10.8 4.6a6.2 6.2 0 1 1 0 12.4 6.2 6.2 0 0 1 0-12.4ZM15.4 15.4l4.2 4.2" />,
  flip_h: <path d="M12 3.6v16.8M8.4 7.4 3.8 12l4.6 4.6M15.6 7.4 20.2 12l-4.6 4.6" />,
  flip_v: <path d="M3.6 12h16.8M7.4 8.4 12 3.8l4.6 4.6M7.4 15.6 12 20.2l4.6-4.6" />,
  centre: <path d="M12 3.6v16.8M3.6 12h16.8M8 6h8v12H8z" />,
};

export type StudioIconName = keyof typeof GLYPHS;

export interface StudioIconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: StudioIconName | string;
  size?: number;
  filled?: boolean;
}

export function StudioIcon({ name, size = 18, className, filled, style, ...rest }: StudioIconProps) {
  const glyph = GLYPHS[name as StudioIconName];
  if (!glyph) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={clsx('shrink-0', className)}
      style={style}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {glyph}
    </svg>
  );
}
