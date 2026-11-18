import type { SVGProps } from 'react';

/**
 * One credit. A coin with a spark, drawn on the brand gradient so it reads at
 * 14 px in a badge and at 40 px in a summary card.
 */
export function CreditIcon({ size = 14, className, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      <defs>
        <linearGradient id="credit-coin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff4f9a" />
          <stop offset="100%" stopColor="#a61f5c" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="9.25" fill="url(#credit-coin)" />
      <circle cx="12" cy="12" r="9.25" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" />
      <path
        d="M13.2 5.6 8.1 12.1h2.9l-.9 6.3 5.3-6.9h-3l.8-5.9Z"
        fill="#fff"
        fillOpacity="0.95"
      />
    </svg>
  );
}
