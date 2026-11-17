import { useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLicense } from '@/state/LicenseState';

export function PremiumGate({ children }: { children: ReactNode }) {
  const { premium, loading, error } = useLicense();
  const opened = useRef(false);
  if (premium) opened.current = true;
  return <>
    {opened.current && <div hidden={!premium} inert={!premium}>{children}</div>}
    {!premium && (loading ? <p className="text-ink-muted">Checking subscription…</p> : <div className="rounded-card border border-line bg-surface p-6"><h1 className="text-lg">Premium subscription required</h1><p className="mt-2 text-sm text-ink-muted">{error ? 'We could not verify your subscription. Check your connection and try again.' : 'Activate an authorized code to access the workspace.'}</p><Link className="mt-4 inline-block text-brand-fg underline" to="/subscription">Open subscription</Link></div>)}
  </>;
}
