import { useEffect, useState } from 'react';

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export const BREAKPOINTS: Record<Breakpoint, number> = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

const canMatchMedia = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (canMatchMedia() ? window.matchMedia(query).matches : false));

  useEffect(() => {
    if (!canMatchMedia()) return;
    const mql = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Live viewport info for adaptive layout logic. */
export function useViewport() {
  const [size, setSize] = useState(() => ({
    width: typeof window === 'undefined' ? 1440 : window.innerWidth,
    height: typeof window === 'undefined' ? 900 : window.innerHeight,
    dpr: typeof window === 'undefined' ? 1 : window.devicePixelRatio,
  }));

  useEffect(() => {
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        setSize({
          width: window.innerWidth,
          height: window.innerHeight,
          dpr: window.devicePixelRatio,
        }),
      );
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  const width = size.width;
  const breakpoint: Breakpoint =
    width >= BREAKPOINTS['2xl']
      ? '2xl'
      : width >= BREAKPOINTS.xl
        ? 'xl'
        : width >= BREAKPOINTS.lg
          ? 'lg'
          : width >= BREAKPOINTS.md
            ? 'md'
            : width >= BREAKPOINTS.sm
              ? 'sm'
              : 'xs';

  return {
    ...size,
    breakpoint,
    isTouch:
      typeof window !== 'undefined' &&
      (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window),
  };
}
