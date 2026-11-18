import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { SegmentedControl } from '@/components/ui/Field';
import { GIcon } from '@/components/ui/GoogleIcon';
import { copyText } from '@/components/ui/Misc';
import { CoinMark, PaymentMark } from '@/components/pro/BrandMark';
import { bdt } from '@/lib/format';
import { useAuth } from '@/state/AuthState';
import { useLicense } from '@/state/LicenseState';
import { useToast } from '@/state/ToastState';
import {
  createCryptoInvoice,
  isFailure,
  loadCatalog,
  monthlyEquivalent,
  myInvoices,
  myOrders,
  submitPayment,
  termLabel,
  verifyCrypto,
  type CryptoAsset,
  type CryptoInvoice,
  type Invoice,
  type Order,
  type PaymentMethod,
  type Plan,
  type PlanPrice,
} from '@/lib/pro/api';

const FEATURE_ROWS: Array<{ key: keyof Plan['features']; label: string; free: string }> = [
  { key: 'vector', label: 'EPS, SVG and AI generators', free: 'Locked' },
  { key: 'jpg', label: 'JPG image studio', free: 'Locked' },
  { key: 'premium_upscale', label: 'Premium upscale models', free: 'Standard models only' },
  { key: 'video_premium', label: 'Premium video upscaling', free: 'Standard modes only' },
];

/** On chain amounts are shown to six places, the precision wallets print. */
function cryptoAmount(value: number): string {
  return value
    .toFixed(6)
    .replace(/\.?0+$/, '')
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Plain words for the rows the database stores in lower case. */
const STATUS_LABEL: Record<string, string> = {
  approved: 'Approved',
  submitted: 'Waiting for review',
  awaiting: 'Waiting for payment',
  rejected: 'Rejected',
  expired: 'Expired',
  confirmed: 'Confirmed',
  seen: 'Seen on chain',
  pending: 'Waiting for the network',
  mismatch: 'Wrong amount',
};

const STATUS_TONE: Record<string, 'ok' | 'warn' | 'danger' | 'neutral' | 'brand'> = {
  approved: 'ok',
  submitted: 'warn',
  awaiting: 'warn',
  rejected: 'danger',
  expired: 'neutral',
  confirmed: 'ok',
  seen: 'warn',
  pending: 'neutral',
  mismatch: 'danger',
};

export function SubscriptionPage() {
  const { user, openAuth } = useAuth();
  const { premium, planName, credits, expiresAt, isAdmin, refresh, costs } = useLicense();
  const toast = useToast();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [prices, setPrices] = useState<PlanPrice[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [assets, setAssets] = useState<CryptoAsset[]>([]);
  const [catalogError, setCatalogError] = useState('');
  const [term, setTerm] = useState(6);
  const [checkout, setCheckout] = useState<{ plan: Plan; price: PlanPrice } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const load = useCallback(async () => {
    const catalog = await loadCatalog();
    if (catalog.error) setCatalogError(catalog.error);
    setPlans(catalog.plans);
    setPrices(catalog.prices);
    setMethods(catalog.methods);
    setAssets(catalog.assets);
    if (user) {
      const [orderResult, invoiceResult] = await Promise.all([myOrders(), myInvoices()]);
      if (!isFailure(orderResult)) setOrders(orderResult);
      if (!isFailure(invoiceResult)) setInvoices(invoiceResult);
    } else {
      setOrders([]);
      setInvoices([]);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const terms = useMemo(() => Array.from(new Set(prices.map((price) => price.months))).sort((a, b) => a - b), [prices]);

  // Never leave the grid stuck on a term the catalogue does not sell: a price
  // lookup miss shows "n/a" on every card.
  useEffect(() => {
    if (!terms.length) return;
    if (!terms.includes(term)) setTerm(terms.includes(1) ? 1 : terms[0]);
  }, [term, terms]);
  const priceFor = (slug: string, months: number) => prices.find((price) => price.plan_slug === slug && price.months === months);

  const expiryLabel = expiresAt
    ? new Date(expiresAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  const daysLeft = expiresAt ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)) : null;

  // Refreshes the plan, credit and order lists without dismissing the sheet,
  // so the invoice or receipt stays on screen until the customer is done.
  const restart = () => {
    void refresh();
    void load();
  };

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="Subscription"
        description="The studio is free. A plan unlocks the premium generators and the top upscale models."
        actions={
          premium ? (
            <Badge tone="ok" icon={<GIcon name="verified" size={14} />}>
              {isAdmin ? 'Administrator' : expiryLabel ? `${planName ?? 'Active'} · expires ${expiryLabel}` : `${planName ?? 'Active'}`}
            </Badge>
          ) : (
            <Badge tone="neutral">Free plan</Badge>
          )
        }
      />

      {(premium || isAdmin) && (
        <Card className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-[var(--r-control)] bg-brand-soft text-brand-fg">
              <GIcon name="workspace_premium" size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-[0.875rem] font-semibold">{isAdmin ? 'Administrator access' : `${planName} plan`}</p>
              <p className="text-2xs text-ink-muted">
                {isAdmin ? 'Every feature is unlocked for administrators.' : expiryLabel ? `Active until ${expiryLabel}` : 'Active plan'}
                {isAdmin ? '' : ` · ${credits.toLocaleString()} credits left`}
              </p>
              {!isAdmin && daysLeft !== null && (
                <p className={clsx('mt-0.5 text-2xs font-semibold', daysLeft <= 7 ? 'text-warn' : 'text-ink-muted')}>
                  {daysLeft <= 0
                    ? 'Ends today. Renewing now keeps today’s access and adds the new months on top.'
                    : daysLeft === 1
                      ? '1 day left. Renew early: the new months are added to the end.'
                      : `${daysLeft} days left. Renewing early adds the new months to the end.`}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            icon={<GIcon name="refresh" size={16} />}
          >
            Refresh status
          </Button>
        </Card>
      )}

      {catalogError && (
        <div className="mt-4 rounded-[var(--r-control)] border border-danger/30 bg-danger-soft px-3 py-2.5 text-[0.8125rem] text-danger">
          {catalogError}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[1rem] font-semibold">Plans</h2>
        {terms.length > 0 && (
          <SegmentedControl
            size="sm"
            value={String(term)}
            onChange={(value) => setTerm(Number(value))}
            options={terms.map((months) => ({ value: String(months), label: termLabel(months) }))}
          />
        )}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {plans.map((plan) => {
          const price = priceFor(plan.slug, term);
          const current = premium && planName === plan.name;
          return (
            <Card key={plan.slug} className={clsx('flex flex-col', current && 'ring-1 ring-brand/40')}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[0.9375rem] font-semibold">{plan.name}</p>
                  <p className="mt-0.5 text-2xs text-ink-muted">{plan.tagline}</p>
                </div>
                {current && <Badge tone="ok">Current</Badge>}
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-1.5">
                <span className="text-[1.75rem] font-bold leading-none">
                  {price ? bdt(price.price_bdt) : 'Not sold'}
                </span>
                <span className="pb-0.5 text-2xs text-ink-muted">
                  {price ? `/ ${termLabel(term).toLowerCase()}` : 'at this term'}
                </span>
              </div>
              <p className="mt-1 text-2xs text-ink-muted">
                {price
                  ? `${bdt(monthlyEquivalent(price.price_bdt, term))} per month · ${price.credits.toLocaleString('en-US')} credits`
                  : 'Pick another term'}
              </p>
              {price && term > 1 && priceFor(plan.slug, 1) && (
                <p className="mt-1 text-2xs font-semibold text-ok">
                  Save {Math.max(0, Math.round((1 - price.price_bdt / (priceFor(plan.slug, 1)!.price_bdt * term)) * 100))}% against monthly
                </p>
              )}

              <ul className="mt-4 space-y-1.5 border-t border-line pt-3 text-[0.8125rem]">
                {FEATURE_ROWS.map((row) => {
                  const included = Boolean(plan.features[row.key]);
                  return (
                    <li key={row.key} className={clsx('flex items-center gap-2', !included && 'text-ink-muted line-through decoration-1')}>
                      <GIcon name={included ? 'check_circle' : 'close'} size={16} className={included ? 'text-ok' : 'opacity-50'} />
                      {row.label}
                    </li>
                  );
                })}
                <li className="flex items-center gap-2 text-ink-muted">
                  <GIcon name="photo_size_select_large" size={16} className="opacity-60" />
                  Up to {plan.features.max_export_px?.toLocaleString() ?? 4000} px exports
                </li>
              </ul>

              <div className="mt-4 pt-1">
                <Button
                  className="w-full"
                  variant={current ? 'outline' : 'primary'}
                  size="sm"
                  disabled={!price}
                  onClick={() => {
                    if (!user) {
                      toast.info('Sign in to subscribe', 'Create an account or sign in, then pick a plan.');
                      openAuth('login');
                      return;
                    }
                    if (!price) return;
                    setCheckout({ plan, price });
                  }}
                  icon={<GIcon name={current ? 'autorenew' : 'workspace_premium'} size={16} />}
                >
                  {current ? 'Extend plan' : 'Choose plan'}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Free forever" icon={<GIcon name="lock_open" size={18} />} />
          <ul className="space-y-1.5 text-[0.8125rem] text-ink-muted">
            {['Image converter and optimiser', 'Background remover', 'Standard upscale models', 'Vector Studio and the full metadata workspace'].map((line) => (
              <li key={line} className="flex items-center gap-2">
                <GIcon name="check_circle" size={16} className="text-ok" />
                {line}
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-line pt-3 text-2xs text-ink-muted">
            No account is required to use those tools. Plans only unlock the premium generators and the top tier models.
          </p>
        </Card>

        <Card flush>
          <CardHeader title="Your orders" subtitle={orders.length ? undefined : 'Nothing yet'} icon={<GIcon name="receipt_long" size={18} />} />
          {orders.length === 0 ? (
            <p className="px-4 pb-4 text-2xs text-ink-muted">Orders and renewals appear here.</p>
          ) : (
            <div className="divide-y divide-line border-t border-line">
              {orders.slice(0, 5).map((order) => {
                const invoice = invoices.find((entry) => entry.order_id === order.id);
                return (
                  <div key={order.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div>
                      <p className="text-[0.8125rem] font-medium">
                        {order.plan_slug} · {termLabel(order.months)}
                      </p>
                      <p className="text-2xs text-ink-muted">
                        {bdt(order.amount_bdt)} · {order.method}
                        {order.txn_ref ? ` · ${order.txn_ref}` : ''}
                      </p>
                      {invoice && (
                        <p className="mt-0.5 text-2xs text-ink-muted">
                          {invoice.symbol} {invoice.network} · {invoice.confirmations}/{invoice.required_confirmations} confirmations
                        </p>
                      )}
                    </div>
                    <Badge tone={STATUS_TONE[order.status] ?? 'neutral'}>{STATUS_LABEL[order.status] ?? order.status}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="How credits work" icon={<GIcon name="savings" size={18} />} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 text-[0.8125rem]">
            {[
              { key: 'vector', label: 'Vector, EPS, SVG and AI generations' },
              { key: 'jpg', label: 'JPG studio render' },
              { key: 'premium_upscale', label: 'Premium upscale, per image' },
              { key: 'video_premium', label: 'Premium video upscale, per clip' },
            ].map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-3">
                <span className="min-w-0 text-ink-muted">{row.label}</span>
                <Badge tone="neutral">{costs[row.key] ?? 0} credits</Badge>
              </div>
            ))}
          </div>
          <ul className="space-y-1.5 text-2xs leading-relaxed text-ink-muted">
            <li className="flex gap-1.5">
              <GIcon name="check_circle" size={15} className="mt-0.5 shrink-0 text-ok" />
              Credits are only spent when a job starts, and a failed job is refunded automatically.
            </li>
            <li className="flex gap-1.5">
              <GIcon name="check_circle" size={15} className="mt-0.5 shrink-0 text-ok" />
              Leftovers stay in your wallet after a plan ends; they are used again the next time a plan is active.
            </li>
            <li className="flex gap-1.5">
              <GIcon name="check_circle" size={15} className="mt-0.5 shrink-0 text-ok" />
              Every plan adds its full credit amount, and renewing early adds the new months after the current expiry.
            </li>
            <li className="flex gap-1.5">
              <GIcon name="check_circle" size={15} className="mt-0.5 shrink-0 text-ok" />
              The free tools never touch credits: convert, optimise, remove backgrounds and standard upscales are free.
            </li>
          </ul>
        </div>
      </Card>

      {checkout && (
        <CheckoutSheet
          plan={checkout.plan}
          price={checkout.price}
          methods={methods}
          assets={assets}
          onClose={() => {
            setCheckout(null);
            restart();
          }}
          onDone={restart}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------- checkout */

function CheckoutSheet({
  plan,
  price,
  methods,
  assets,
  onClose,
  onDone,
}: {
  plan: Plan;
  price: PlanPrice;
  methods: PaymentMethod[];
  assets: CryptoAsset[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [method, setMethod] = useState<string>(methods[0]?.id ?? 'bkash');
  const [txn, setTxn] = useState('');
  const [sender, setSender] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [placed, setPlaced] = useState<{ orderId: string; status: string } | null>(null);
  const [invoice, setInvoice] = useState<CryptoInvoice | null>(null);
  const [assetId, setAssetId] = useState(assets[0]?.id ?? '');
  const [checking, setChecking] = useState(false);
  const [cryptoState, setCryptoState] = useState<{ status: string; message?: string; confirmations?: number; required?: number } | null>(null);

  const selected = methods.find((entry) => entry.id === method) ?? methods[0];
  const isCrypto = method === 'crypto';
  const asset = assets.find((entry) => entry.id === assetId) ?? assets[0];

  const submit = async () => {
    setBusy(true);
    setError('');
    const result = await submitPayment({
      plan: plan.slug,
      months: price.months,
      method,
      txnRef: isCrypto ? undefined : txn,
      sender: sender || undefined,
    });
    setBusy(false);
    if (isFailure(result)) {
      setError(result.error);
      return;
    }
    setPlaced({ orderId: result.order_id, status: result.status });
    toast.success(
      'Order created',
      isCrypto ? 'Pay the invoice amount and the network confirms it automatically.' : `Send ${bdt(result.amount_bdt)} and an administrator will confirm it.`,
    );
    if (isCrypto && asset) {
      const created = await createCryptoInvoice(result.order_id, asset.id);
      if (isFailure(created)) setError(created.error);
      else setInvoice(created);
    }
    onDone();
  };

  const check = async () => {
    if (!invoice) return;
    setChecking(true);
    const result = await verifyCrypto(invoice.invoice_id);
    setChecking(false);
    if ('error' in result && result.error) {
      setError(String(result.error));
      return;
    }
    setCryptoState(result as { status: string; message?: string; confirmations?: number; required?: number });
    if ((result as { status: string }).status === 'confirmed') {
      toast.success('Payment confirmed', 'Your plan is active.');
      onDone();
      onClose();
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={`${plan.name} · ${termLabel(price.months)}`}
      description={`${bdt(price.price_bdt)} · ${price.credits.toLocaleString('en-US')} credits · access starts the moment payment is confirmed`}
    >
      {!placed ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {methods.map((entry) => {
              const active = entry.id === method;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setMethod(entry.id)}
                  className={clsx(
                    'flex flex-col items-start gap-2 rounded-[var(--r-control)] border p-2.5 text-left transition',
                    active ? 'border-brand bg-brand-soft/60' : 'border-line hover:border-brand/40',
                  )}
                >
                  {entry.id === 'crypto' ? (
                    <span className="flex items-center gap-1">
                      <CoinMark asset="usdt" size={20} />
                      <CoinMark asset="btc" size={20} />
                    </span>
                  ) : (
                    <PaymentMark method={entry.id} size={20} />
                  )}
                  <span className="text-2xs font-semibold">{entry.label}</span>
                </button>
              );
            })}
          </div>

          {!isCrypto && selected && (
            <div className="space-y-3">
              <div className="rounded-[var(--r-control)] border border-line bg-surface-2 p-3">
                <p className="text-2xs text-ink-muted">Send exactly</p>
                <p className="text-[1.125rem] font-bold">{bdt(price.price_bdt)}</p>
                <div className="mt-2 space-y-1">
                  {(selected.config.numbers ?? []).map((number) => (
                    <div key={number} className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[0.8125rem]">{number}</span>
                      <button
                        type="button"
                        className="text-2xs font-semibold text-brand-fg"
                        onClick={() => void copyText(number).then(() => toast.success('Number copied'))}
                      >
                        Copy
                      </button>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-2xs text-ink-muted">{selected.config.instructions}</p>
              </div>

              <Field label="Transaction ID" hint="required">
                <Input value={txn} onChange={(event) => setTxn(event.target.value.toUpperCase())} placeholder="8N7A2K9XQ1" />
              </Field>
              <Field label="Sender number" hint="optional">
                <Input value={sender} onChange={(event) => setSender(event.target.value)} placeholder="01XXXXXXXXX" />
              </Field>
              <p className="text-2xs text-ink-muted">A TrxID can only be claimed once. Orders are reviewed by hand.</p>
            </div>
          )}

          {isCrypto && (
            <div className="space-y-3">
              <Field label="Coin and network">
                <Select value={assetId} onChange={(event) => { setAssetId(event.target.value); setInvoice(null); setCryptoState(null); }}>
                  {assets.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.symbol} · {entry.network}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="flex items-center gap-2 rounded-[var(--r-control)] border border-line bg-surface-2 p-2.5">
                {asset && <CoinMark asset={asset.symbol.toLowerCase()} size={26} />}
                <div className="min-w-0">
                  <p className="text-[0.8125rem] font-semibold">{asset?.symbol} on {asset?.network}</p>
                  <p className="truncate text-2xs text-ink-muted">{asset?.address}</p>
                </div>
              </div>
              <p className="text-2xs text-ink-muted">
                The invoice is created after you continue and shows the exact amount. Payment is detected automatically once the network confirms it.
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-[var(--r-control)] border border-danger/30 bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger">{error}</div>
          )}

          <Button className="w-full" loading={busy} onClick={() => void submit()} icon={<GIcon name="check_circle" size={18} />}>
            {isCrypto ? 'Create invoice' : 'Submit payment'}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-[var(--r-control)] border border-ok/30 bg-ok-soft px-3 py-2.5 text-[0.8125rem] text-ok">
            <GIcon name="check_circle" size={18} />
            Order placed · {placed.status}
          </div>

          {invoice ? (
            <div className="space-y-2">
              <div className="rounded-[var(--r-control)] border border-line p-3">
                <p className="text-2xs text-ink-muted">Send exactly</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[0.9375rem] font-semibold">{cryptoAmount(invoice.amount)} {invoice.symbol}</p>
                  <button
                    type="button"
                    className="text-2xs font-semibold text-brand-fg"
                    onClick={() => void copyText(String(invoice.amount)).then(() => toast.success('Amount copied'))}
                  >
                    Copy
                  </button>
                </div>
                <p className="mt-2 text-2xs text-ink-muted">{invoice.network} address</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="break-all font-mono text-[0.75rem]">{invoice.address}</p>
                  <button
                    type="button"
                    className="shrink-0 text-2xs font-semibold text-brand-fg"
                    onClick={() => void copyText(invoice.address).then(() => toast.success('Address copied'))}
                  >
                    Copy
                  </button>
                </div>
                <p className="mt-2 text-2xs text-ink-muted">
                  Needs {invoice.confirmations_required} confirmations. The invoice expires {new Date(invoice.expires_at).toLocaleTimeString()}.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" loading={checking} onClick={() => void check()} icon={<GIcon name="refresh" size={16} />}>
                  Check payment
                </Button>
                {cryptoState && (
                  <Badge tone={STATUS_TONE[cryptoState.status] ?? 'neutral'}>
                    {cryptoState.status}
                    {typeof cryptoState.confirmations === 'number' ? ` · ${cryptoState.confirmations}/${cryptoState.required}` : ''}
                  </Badge>
                )}
              </div>
              {cryptoState?.message && <p className="text-2xs text-ink-muted">{cryptoState.message}</p>}
            </div>
          ) : (
            <p className="text-[0.8125rem] text-ink-muted">
              An administrator reviews the payment. Access starts as soon as it is approved.
            </p>
          )}

          <Button className="w-full" variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      )}
    </Modal>
  );
}
