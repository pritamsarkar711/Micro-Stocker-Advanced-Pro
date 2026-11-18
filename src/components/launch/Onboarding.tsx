import { useState } from 'react';
import clsx from 'clsx';
import { GIcon, type GoogleIconName } from '@/components/ui/GoogleIcon';

interface Slide {
  icon: GoogleIconName;
  eyebrow: string;
  title: string;
  copy: string;
  points: string[];
}

const SLIDES: Slide[] = [
  {
    icon: 'edit_note',
    eyebrow: 'Step 1 · Metadata',
    title: 'Titles and keywords, drafted from the picture',
    copy: 'The studio reads the image, then writes a title and a keyword set that pass agency review.',
    points: ['Offline analyser built in', 'AI models when you want them', 'No dashes, no filler words'],
  },
  {
    icon: 'upload_file',
    eyebrow: 'Step 2 · Export',
    title: 'One library, fourteen marketplaces',
    copy: 'Every agency has its own CSV dialect and limits. Export the exact file each portal accepts.',
    points: ['Shutterstock, Adobe, Getty and more', 'IPTC and XMP embedded on device', 'Per-agency size and tag rules'],
  },
  {
    icon: 'photo_size_select_large',
    eyebrow: 'Step 3 · Studio tools',
    title: 'Upscale, cut out and convert on the phone',
    copy: 'Heavy work runs on the device. Files land in Documents and can be shared straight to a portal.',
    points: ['Up to 8K upscaling', 'Transparent cutouts', 'Works without a signal'],
  },
];

export function Onboarding({
  onFinish,
  onSkip,
  onBack,
}: {
  onFinish: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;

  const next = () => {
    if (last) onFinish();
    else setIndex((value) => value + 1);
  };

  return (
    <div className="launch-screen flex h-dvh w-full flex-col bg-bg">
      <div className="flex items-center justify-between px-5 pt-[calc(0.75rem+env(safe-area-inset-top,0px))]">
        <button
          type="button"
          onClick={() => (index === 0 ? onBack() : setIndex((value) => value - 1))}
          className="launch-icon-button"
          aria-label="Go back"
        >
          <GIcon name="arrow_forward" size={20} className="rotate-180" />
        </button>
        <button type="button" onClick={onSkip} className="launch-text-button">
          Skip
        </button>
      </div>

      <div key={index} className="launch-slide flex min-h-0 flex-1 flex-col px-5 pt-4 sm:px-8">
        <div className="launch-art">
          <span className="launch-art-icon">
            <GIcon name={slide.icon} size={54} />
          </span>
        </div>

        <div className="mt-7">
          <p className="text-2xs font-semibold tracking-[0.16em] text-brand-fg uppercase">{slide.eyebrow}</p>
          <h2 className="display mt-2 text-[1.5rem] leading-[1.15] font-bold tracking-[-0.02em] text-ink sm:text-[1.875rem]">
            {slide.title}
          </h2>
          <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-ink-muted">{slide.copy}</p>
        </div>

        <ul className="mt-5 space-y-2">
          {slide.points.map((point) => (
            <li key={point} className="flex items-center gap-2.5 text-[0.875rem] text-ink">
              <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-ok-soft text-ok">
                <GIcon name="check" size={14} />
              </span>
              <span className="min-w-0">{point}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:px-8">
        <div className="mb-4 flex items-center gap-1.5" role="tablist" aria-label="Onboarding steps">
          {SLIDES.map((entry, dot) => (
            <button
              key={entry.eyebrow}
              type="button"
              role="tab"
              aria-selected={dot === index}
              aria-label={entry.eyebrow}
              onClick={() => setIndex(dot)}
              className={clsx(
                'h-1.5 rounded-full transition-all',
                dot === index ? 'w-7 bg-brand' : 'w-1.5 bg-line-strong hover:bg-ink-faint',
              )}
            />
          ))}
        </div>
        <button type="button" onClick={next} className="launch-primary">
          {last ? 'Create an account' : 'Next'}
          <GIcon name={last ? 'person_add' : 'arrow_forward'} size={18} />
        </button>
      </div>
    </div>
  );
}
