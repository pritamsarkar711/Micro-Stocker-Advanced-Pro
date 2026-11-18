import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  type CryptoCheck,
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
  mismatch: 'Needs review',
};

/** Why a chain check refused an invoice, in the customer's words. */
const CREDIT_ROWS: Partial<Record<string, { label: string }>> = {
  vector: { label: 'EPS, SVG and AI Illustrator render' },
  jpg: { label: 'JPG studio render' },
  premium_upscale: { label: 'Premium upscale model' },
  video_premium: { label: 'Premium video upscale' },
  background: { label: 'Background remover' },
};

const REASON_LABEL: Record<string, string> = {
  'tx reused': 'That transaction was already used for another order.',
  'tx older than invoice': 'That transaction was sent before this invoice was created.',
  'amount short': 'The amount received is below the invoice amount. Send the difference and check again.',
  'wrong destination': 'That transaction did not reach our wallet.',
  'wrong network': 'That transaction was sent on a different network.',
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
  const [checkingOrder, setCheckingOrder] = useState<string | null>(null);

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

  // A row can be re-checked on demand; the chain reader is the only authority.
  const checkInvoice = async (invoice: Invoice) => {
    setCheckingOrder(invoice.order_id);
    const result = await verifyCrypto(invoice.invoice_id);
    setCheckingOrder(null);
    if ('error' in result && result.error) {
      toast.error('Check failed', String(result.error));
      return;
    }
    const check = result as CryptoCheck;
    if (check.status === 'confirmed') {
      toast.success('Payment confirmed', 'Your plan is active.');
      restart();
      return;
    }
    if (check.status === 'mismatch') {
      toast.error('Payment needs review', REASON_LABEL[check.reason ?? ''] ?? 'The transfer did not match this invoice.');
      void load();
      return;
    }
    if (check.status === 'expired') {
      toast.info('Invoice expired', 'Create a new order to continue.');
      void load();
      return;
    }
    toast.info('Not seen yet', check.message ?? 'Waiting for the transfer to reach the network.');
  };

  // Refreshes the plan, credit and order lists without dismissing the sheet,
  // so the invoice or receipt stays on screen until the customer is done.
  const restart = () => {
    void refresh();
    void load();
  };

  return (
    <div>
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

              <div className="mt-4 border-t border-line pt-3">
                <p className="text-2xs font-semibold uppercase tracking-wide text-ink-muted">Included</p>
                <ul className="mt-1.5 space-y-1 text-[0.8125rem]">
                  {FEATURE_ROWS.filter((row) => plan.features[row.key]).map((row) => (
                    <li key={row.key} className="flex items-center gap-2">
                      <GIcon name="check_circle" size={16} className="text-ok" />
                      {row.label}
                    </li>
                  ))}
                  <li className="flex items-center gap-2">
                    <GIcon name="photo_size_select_large" size={16} className="text-ok" />
                    Up to {(plan.features.max_export_px ?? 4000).toLocaleString()} px exports
                  </li>
                </ul>
                {FEATURE_ROWS.some((row) => !plan.features[row.key]) && (
                  <>
                    <p className="mt-3 text-2xs font-semibold uppercase tracking-wide text-ink-muted">Not included</p>
                    <ul className="mt-1.5 space-y-1 text-[0.8125rem] text-ink-muted">
                      {FEATURE_ROWS.filter((row) => !plan.features[row.key]).map((row) => (
                        <li key={row.key} className="flex items-center gap-2">
                          <GIcon name="close" size={16} className="opacity-50" />
                          {row.label}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

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
                const pendingInvoice = invoice && (invoice.status === 'pending' || invoice.status === 'seen');
                const status = invoice && order.status !== 'approved' ? invoice.status : order.status;
                return (
                  <div key={order.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.8125rem] font-medium">
                        {order.plan_slug} · {termLabel(order.months)}
                      </p>
                      <p className="truncate text-2xs text-ink-muted">
                        {bdt(order.amount_bdt)} · {order.method}
                        {order.txn_ref ? ` · ${order.txn_ref}` : ''}
                        {invoice ? ` · ${invoice.symbol} ${invoice.network}` : ''}
                      </p>
                    </div>
                    {pendingInvoice && (
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={checkingOrder === order.id}
                        onClick={() => void checkInvoice(invoice)}
                        icon={<GIcon name="refresh" size={15} />}
                      >
                        Check
                      </Button>
                    )}
                    <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{STATUS_LABEL[status] ?? status}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Credits" icon={<GIcon name="savings" size={18} />} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 text-[0.8125rem]">
            {(Object.keys(costs) as Array<keyof typeof costs>)
              .filter((key) => CREDIT_ROWS[key])
              .map((key) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 text-ink-muted">{CREDIT_ROWS[key]!.label}</span>
                  <Badge tone="neutral">
                    {costs[key] ? `${costs[key]} credits` : 'No credits'}
                  </Badge>
                </div>
              ))}
          </div>
          <ul className="space-y-1.5 text-2xs leading-relaxed text-ink-muted">
            <li className="flex gap-1.5">
              <GIcon name="check_circle" size={15} className="mt-0.5 shrink-0 text-ok" />
              Credits are spent only when one of the four generators or another credit tool starts.
            </li>
            <li className="flex gap-1.5">
              <GIcon name="check_circle" size={15} className="mt-0.5 shrink-0 text-ok" />
              A failed job is refunded automatically.
            </li>
            <li className="flex gap-1.5">
              <GIcon name="check_circle" size={15} className="mt-0.5 shrink-0 text-ok" />
              Leftover credits stay after a plan ends and are used again with the next plan.
            </li>
            <li className="flex gap-1.5">
              <GIcon name="check_circle" size={15} className="mt-0.5 shrink-0 text-ok" />
              Background remover and standard upscales never use credits.
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
  const [txHash, setTxHash] = useState('');

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
    toast.success('Order created', isCrypto ? 'Send the amount shown below.' : 'Send the amount, then wait for approval.');
    if (isCrypto && asset) {
      const created = await createCryptoInvoice(result.order_id, asset.id);
      if (isFailure(created)) setError(created.error);
      else setInvoice(created);
    }
    onDone();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={`${plan.name} · ${termLabel(price.months)}`}
      description={`${bdt(price.price_bdt)} · ${price.credits.toLocaleString('en-US')} credits`}
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
                    <span className="flex h-7 items-center gap-1">
                      <CoinMark asset="usdt" size={20} />
                      <CoinMark asset="btc" size={20} />
                    </span>
                  ) : (
                    <PaymentMark method={entry.id} size={28} />
                  )}
                  <span className="text-2xs font-semibold">{entry.label}</span>
                </button>
              );
            })}
          </div>

          {!isCrypto && selected && (
            <div className="space-y-3">
              <div className="rounded-[var(--r-control)] border border-line bg-surface-2 p-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-2xs text-ink-muted">Send exactly</p>
                    <p className="text-[1.125rem] font-bold">{bdt(price.price_bdt)}</p>
                  </div>
                  <PaymentMark method={selected.id as 'bkash' | 'nagad'} size={26} />
                </div>
                <div className="mt-2 divide-y divide-line">
                  {(selected.config.numbers ?? []).map((number) => (
                    <div key={number} className="flex items-center justify-between gap-2 py-1.5 first:pt-0 last:pb-0">
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
                {selected.config.instructions && (
                  <p className="mt-2 text-2xs text-ink-muted">{selected.config.instructions}</p>
                )}
              </div>

              <Field label="Transaction ID">
                <Input value={txn} onChange={(event) => setTxn(event.target.value.toUpperCase())} placeholder="8N7A2K9XQ1" />
              </Field>
              <Field label="Sender number" hint="optional">
                <Input value={sender} onChange={(event) => setSender(event.target.value)} placeholder="01XXXXXXXXX" />
              </Field>
            </div>
          )}

          {isCrypto && (
            <div className="space-y-3">
              <Field label="Coin and network">
                <Select value={assetId} onChange={(event) => { setAssetId(event.target.value); setInvoice(null); }}>
                  {assets.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.symbol} · {entry.network}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Transaction hash" hint="optional">
                <Input
                  value={txHash}
                  onChange={(event) => setTxHash(event.target.value.trim())}
                  placeholder="0x… or the signature"
                />
              </Field>
              {asset && (
                <div className="flex items-center gap-2.5 rounded-[var(--r-control)] border border-line bg-surface-2 p-2.5">
                  <CoinMark asset={asset.symbol.toLowerCase()} size={26} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.8125rem] font-semibold">{asset.symbol} on {asset.network}</p>
                    <p className="truncate font-mono text-2xs text-ink-muted">{asset.address}</p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-2xs font-semibold text-brand-fg"
                    onClick={() => void copyText(asset.address).then(() => toast.success('Address copied'))}
                  >
                    Copy
                  </button>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-[var(--r-control)] border border-danger/30 bg-danger-soft px-3 py-2 text-[0.8125rem] text-danger">{error}</div>
          )}

          <Button className="w-full" loading={busy} onClick={() => void submit()} icon={<GIcon name="check_circle" size={18} />}>
            {isCrypto ? 'Create invoice' : 'Submit payment'}
          </Button>
        </div>
      ) : invoice ? (
        <InvoicePanel invoice={invoice} hash={txHash} onPaid={onDone} onClose={onClose} />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-[var(--r-control)] border border-ok/30 bg-ok-soft px-3 py-2.5 text-[0.8125rem] text-ok">
            <GIcon name="check_circle" size={18} />
            Payment submitted
          </div>
          <p className="text-2xs text-ink-muted">
            Access starts as soon as an administrator approves it. This page shows the change.
          </p>
          <Button className="w-full" variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------- crypto invoice */

/**
 * Live view of one crypto invoice.
 *
 * The panel asks the chain reader every fifteen seconds until the invoice
 * reaches a final state, so a customer who pays and watches this screen sees
 * their plan switch on without pressing anything. The manual button exists for
 * the first seconds, before the transfer reaches a block.
 */
function InvoicePanel({
  invoice,
  hash,
  onPaid,
  onClose,
}: {
  invoice: CryptoInvoice;
  hash?: string;
  onPaid: () => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [check, setCheck] = useState<CryptoCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const paid = useRef(onPaid);
  paid.current = onPaid;
  // The pasted hash is offered once; afterwards the invoice remembers it.
  const firstHash = useRef(hash ?? '');

  const status = check?.status ?? 'pending';
  const settled = status === 'confirmed' || status === 'expired' || status === 'mismatch';
  const settledRef = useRef(settled);
  settledRef.current = settled;

  const poll = useCallback(async (silent: boolean) => {
    if (!silent) setBusy(true);
    const hint = firstHash.current;
    firstHash.current = '';
    const result = await verifyCrypto(invoice.invoice_id, hint || undefined);
    if (!silent) setBusy(false);
    if ('error' in result && result.error) {
      if (!silent) toast.error('Check failed', String(result.error));
      return;
    }
    const next = result as CryptoCheck;
    setCheck(next);
    if (next.status === 'confirmed') {
      paid.current();
      toast.success('Payment confirmed', 'Your plan is active.');
    }
  }, [invoice.invoice_id, toast]);

  useEffect(() => {
    void poll(true);
    const id = window.setInterval(() => {
      if (settledRef.current) {
        window.clearInterval(id);
        return;
      }
      void poll(true);
    }, 15_000);
    return () => window.clearInterval(id);
  }, [poll]);

  const copy = (value: string, label: string) => void copyText(value).then(() => toast.success(`${label} copied`));
  const reason = check?.reason ? REASON_LABEL[check.reason] ?? check.reason : null;

  return (
    <div className="space-y-3">
      <div className="rounded-[var(--r-control)] border border-line p-3">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-2xs text-ink-muted">Send exactly</p>
            <p className="font-mono text-[1.0625rem] font-semibold">
              {cryptoAmount(invoice.amount)} {invoice.symbol}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <CoinMark asset={invoice.symbol.toLowerCase()} size={24} />
            <button type="button" className="text-2xs font-semibold text-brand-fg" onClick={() => copy(String(invoice.amount), 'Amount')}>
              Copy
            </button>
          </div>
        </div>

        <p className="mt-3 text-2xs text-ink-muted">{invoice.network} address</p>
        <div className="flex items-start justify-between gap-2">
          <p className="break-all font-mono text-[0.75rem] leading-snug">{invoice.address}</p>
          <button
            type="button"
            className="shrink-0 text-2xs font-semibold text-brand-fg"
            onClick={() => copy(invoice.address, 'Address')}
          >
            Copy
          </button>
        </div>

        {check?.tx_hash && (
          <div className="mt-3 border-t border-line pt-2">
            <p className="text-2xs text-ink-muted">Transaction</p>
            <p className="break-all font-mono text-[0.6875rem] leading-snug">{check.tx_hash}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[status] ?? 'neutral'} icon={status === 'confirmed' ? <GIcon name="check_circle" size={14} /> : undefined}>
          {STATUS_LABEL[status] ?? status}
          {typeof check?.confirmations === 'number' && status !== 'confirmed' ? ` · ${check.confirmations}/${check.required ?? invoice.confirmations_required}` : ''}
        </Badge>
        {!settled && (
          <Button variant="outline" size="sm" loading={busy} onClick={() => void poll(false)} icon={<GIcon name="refresh" size={16} />}>
            Check now
          </Button>
        )}
        {!settled && <span className="text-2xs text-ink-muted">Checking automatically</span>}
      </div>

      {reason && <p className="text-2xs text-danger">{reason}</p>}
      {!reason && status === 'pending' && (
        <p className="text-2xs text-ink-muted">{check?.message ?? `Waiting for the transfer. Confirmations needed: ${invoice.confirmations_required}.`}</p>
      )}
      {status === 'confirmed' && (
        <div className="flex items-center gap-2 rounded-[var(--r-control)] border border-ok/30 bg-ok-soft px-3 py-2.5 text-[0.8125rem] text-ok">
          <GIcon name="check_circle" size={18} />
          Paid. Your plan and credits are active.
        </div>
      )}
      {status === 'expired' && (
        <div className="flex items-center gap-2 rounded-[var(--r-control)] border border-line bg-surface-2 px-3 py-2.5 text-[0.8125rem] text-ink-muted">
          <GIcon name="schedule" size={18} />
          This invoice expired. Start a new order.
        </div>
      )}

      <Button className="w-full" variant={status === 'confirmed' ? 'primary' : 'outline'} onClick={onClose}>
        {status === 'confirmed' ? 'Done' : 'Close'}
      </Button>
    </div>
  );
}
