import { useEffect, useState } from 'react';
import { Logo } from '@/components/layout/Logo';
import { launch } from '@/lib/launch';

/**
 * The first thing a cold start paints: the mark, the name and a hairline of
 * progress. It never blocks for longer than `launch.splashMs`, and it is sized
 * with safe-area padding so the wordmark clears a notch and a gesture bar.
 */
export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    const started = performance.now();
    let frame = 0;
    const tick = () => {
      const elapsed = performance.now() - started;
      const ratio = Math.min(1, elapsed / launch.splashMs);
      // Ease out so the bar slows as it lands, instead of marching linearly.
      setProgress(8 + Math.round(92 * (1 - Math.pow(1 - ratio, 2))));
      if (ratio < 1) frame = requestAnimationFrame(tick);
      else onDone();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [onDone]);

  return (
    <div className="launch-screen relative flex h-dvh w-full flex-col items-center justify-center overflow-hidden bg-[#0b0c0f] px-8">
      <div aria-hidden="true" className="launch-glow" />

      <div className="launch-rise relative flex flex-col items-center text-center">
        <div className="launch-mark">
          <Logo size={92} />
        </div>
        <h1 className="display mt-6 text-[1.75rem] leading-none font-bold tracking-[-0.02em] text-white">
          Micro Stocker
        </h1>
        <p className="mt-2 text-[0.6875rem] font-semibold tracking-[0.34em] text-white/45 uppercase">
          Advanced Pro
        </p>
      </div>

      <div className="absolute inset-x-0 bottom-[calc(2.75rem+env(safe-area-inset-bottom,0px))] flex flex-col items-center gap-3 px-10">
        <div className="h-[3px] w-full max-w-[13rem] overflow-hidden rounded-full bg-white/12">
          <div
            className="h-full rounded-full bg-white/85 transition-[width] duration-100 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[0.6875rem] font-medium tracking-[0.14em] text-white/35 uppercase">
          Contributor studio
        </p>
      </div>
    </div>
  );
}
