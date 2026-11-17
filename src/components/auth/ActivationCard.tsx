import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { GIcon } from '@/components/ui/GoogleIcon';
import { useLicense } from '@/state/LicenseState';
import { useToast } from '@/state/ToastState';

/**
 * License-key redemption. A 40 character code upgrades the caller's account on
 * the server; the UI only ever reflects the server answer.
 */
export function ActivationCard({ onActivated }: { onActivated?: () => void }) {
  const { redeem, refresh } = useLicense();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = code.trim();
    if (value.length < 8) {
      setError('Enter the full activation code.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await redeem(value);
      setCode('');
      setDone(true);
      toast.success('Subscription activated', 'Your workspace is unlocked.');
      onActivated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Activation failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field
        label="Activation code"
        htmlFor="activation-code"
        hint="40 characters, supplied by the administrator."
      >
        <Input
          id="activation-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 40));
            setError('');
          }}
          placeholder="Paste your code"
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
          leading={<GIcon name="key" size={18} />}
          className="font-mono tracking-[0.08em]"
        />
      </Field>

      {done && (
        <div role="status" className="flex items-center gap-2 rounded-[var(--r-control)] border border-ok/30 bg-ok-soft px-3 py-2 text-[0.8125rem] font-medium text-ok">
          <GIcon name="check_circle" size={17} />
          Code activated.
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-[var(--r-control)] border border-danger/30 bg-danger-soft px-3 py-2 text-[0.8125rem] font-medium text-danger">
          <GIcon name="error" size={17} className="mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" loading={busy} disabled={code.length < 8} icon={<GIcon name="redeem" size={18} />}>
          Activate
        </Button>
        <Button type="button" variant="outline" onClick={() => void refresh()} icon={<GIcon name="refresh" size={17} />}>
          Refresh
        </Button>
        <span className="text-[0.75rem] text-ink-faint">Codes are single-use.</span>
      </div>
    </form>
  );
}
