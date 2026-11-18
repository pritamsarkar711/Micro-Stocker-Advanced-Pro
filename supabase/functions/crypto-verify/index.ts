// Edge function: turns a chain transaction into a paid order.
//
// Two modes:
//   { invoice_id, tx_hash? }  the customer asks about one invoice
//   { action: 'watch' }       the studio scans every open invoice and settles
//                             whatever the chain already confirms
//
// The browser may only name an invoice, never an amount, a destination or a
// status. Every value used for settlement is read from the chain here, compared
// with the invoice, and written by pro_settle_crypto with the service role. A
// reused hash, a short payment, a wrong destination or a transfer that predates
// the invoice never settles.
//
// The watch mode is called by a scheduled job with WATCH_SECRET, or by an
// administrator from the console (their JWT is checked against pro_is_admin).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const BSCSCAN_KEY = Deno.env.get('BSCSCAN_API_KEY') ?? '';
const POLYGON_KEY = Deno.env.get('POLYGONSCAN_API_KEY') ?? '';
const TRON_KEY = Deno.env.get('TRON_API_KEY') ?? '';
const SOLANA_RPC = Deno.env.get('SOLANA_RPC_URL') ?? 'https://api.mainnet-beta.solana.com';
const WATCH_SECRET = Deno.env.get('WATCH_SECRET') ?? '';

type ChainFacts = {
  found: boolean;
  amount: number;
  confirmations: number;
  destination: string;
  network: string;
  time?: string | null;
  reason?: string;
};

type InvoiceRow = {
  id: string;
  order_id: string;
  user_id?: string;
  asset_id: string;
  address: string;
  contract: string | null;
  symbol: string;
  network: string;
  decimals: number;
  amount_expected: number;
  confirmations_required: number;
  created_at: string;
  expires_at: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}

/**
 * Public JSON RPC endpoints. Reading a receipt, a block or a log range needs no
 * account, so verification works the moment a wallet address is set. The
 * explorer keys are only used for the one call a node cannot answer quickly:
 * listing native coin transfers into an address.
 */
const EVM: Record<string, { rpc: string; scan: string; key: string }> = {
  BEP20: {
    rpc: Deno.env.get('BSC_RPC_URL') ?? 'https://bsc-dataseed.binance.org',
    scan: 'https://api.bscscan.com/api',
    key: BSCSCAN_KEY,
  },
  Polygon: {
    rpc: Deno.env.get('POLYGON_RPC_URL') ?? 'https://polygon-rpc.com',
    scan: 'https://api.polygonscan.com/api',
    key: POLYGON_KEY,
  },
};

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

async function rpc(url: string, method: string, params: unknown[]) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const body = await response.json();
  if (body?.error) throw new Error(String(body.error.message ?? 'rpc error'));
  return body?.result;
}

function hex(value: string): number {
  return parseInt(value ?? '0x0', 16);
}

/** Token transfers use the log, native coins use the transaction itself. */
async function readEvm(chain: keyof typeof EVM, hash: string, invoice: InvoiceRow): Promise<ChainFacts | null> {
  const config = EVM[chain];
  const receipt = await rpc(config.rpc, 'eth_getTransactionReceipt', [hash]);
  if (!receipt) return { found: false, amount: 0, confirmations: 0, destination: '', network: chain };

  const head = hex(await rpc(config.rpc, 'eth_blockNumber', []));
  const mined = hex(receipt.blockNumber);
  const confirmations = Math.max(0, head - mined + 1);
  const block = await rpc(config.rpc, 'eth_getBlockByNumber', [receipt.blockNumber, false]);
  const time = block?.timestamp ? new Date(hex(block.timestamp) * 1000).toISOString() : null;

  if (hex(receipt.status) !== 1) {
    return { found: true, amount: 0, confirmations, destination: '', network: chain, time, reason: 'transaction reverted' };
  }

  // Native coin: BNB or POL straight to the wallet.
  if (!invoice.contract) {
    const tx = await rpc(config.rpc, 'eth_getTransactionByHash', [hash]);
    const to = String(tx?.to ?? '').toLowerCase();
    if (to !== invoice.address.toLowerCase()) {
      return { found: true, amount: 0, confirmations, destination: to, network: chain, time, reason: 'wrong destination' };
    }
    return { found: true, amount: Number(BigInt(tx?.value ?? '0x0')) / 1e18, confirmations, destination: to, network: chain, time };
  }

  // Token: the Transfer log names the contract, the recipient and the amount.
  const wanted = invoice.contract.toLowerCase();
  const log = (receipt.logs ?? []).find(
    (entry: Record<string, unknown>) =>
      String(entry.address ?? '').toLowerCase() === wanted &&
      `0x${String((entry.topics as string[])?.[2] ?? '').slice(-40)}`.toLowerCase() === invoice.address.toLowerCase(),
  );
  if (!log) {
    return { found: true, amount: 0, confirmations, destination: invoice.address, network: chain, time, reason: 'transfer to this wallet not found' };
  }
  const data = String(log.data ?? '');
  const raw = Number(BigInt(`0x${data.slice(2, 2 + 64)}`));
  // USDT and USDC on BNB Smart Chain use eighteen decimals, the Polygon token
  // uses six. The asset row carries the right number, so the amount is always
  // scaled by what the token itself declares.
  return { found: true, amount: raw / 10 ** (invoice.decimals ?? 18), confirmations, destination: invoice.address, network: chain, time };
}

async function readTrc20(hash: string, invoice: InvoiceRow): Promise<ChainFacts | null> {
  const headers: Record<string, string> = TRON_KEY ? { 'TRON-PRO-API-KEY': TRON_KEY } : {};
  const info = await fetch(`https://apilist.tronscanapi.com/api/transaction-info?hash=${hash}`, { headers }).then((r) => r.json());
  if (!info || info.Error) return { found: false, amount: 0, confirmations: 0, destination: '', network: 'TRC20' };

  const time = info.block_ts ? new Date(Number(info.block_ts)).toISOString() : null;
  const confirmed = Boolean(info.confirmed || Number(info.confirmations ?? 0) >= 19);
  const transfers: Array<Record<string, string>> = info.trc20TransferInfo ?? [];
  const transfer = transfers.find((entry) => entry.to_address === invoice.address);
  if (!transfer) {
    return { found: true, amount: 0, confirmations: confirmed ? 19 : 1, destination: '', network: 'TRC20', time, reason: 'wrong destination' };
  }
  if (info.contractRet && info.contractRet !== 'SUCCESS') {
    return { found: true, amount: 0, confirmations: 0, destination: invoice.address, network: 'TRC20', time, reason: 'transaction failed' };
  }
  return {
    found: true,
    amount: Number(transfer.amount_str ?? 0) / 10 ** Number(invoice.decimals ?? 6),
    confirmations: confirmed ? 19 : 1,
    destination: invoice.address,
    network: 'TRC20',
    time,
  };
}

async function readSolana(hash: string, invoice: InvoiceRow): Promise<ChainFacts | null> {
  const response = await fetch(SOLANA_RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTransaction',
      params: [hash, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
    }),
  });
  const body = await response.json();
  const result = body?.result;
  if (!result) return { found: false, amount: 0, confirmations: 0, destination: '', network: 'Solana' };
  const time = result.blockTime ? new Date(result.blockTime * 1000).toISOString() : null;
  if (result.meta?.err) {
    return { found: true, amount: 0, confirmations: 0, destination: '', network: 'Solana', time, reason: 'transaction failed' };
  }

  const accountKeys: Array<{ pubkey: string }> = result.transaction?.message?.accountKeys ?? [];

  // SPL transfer: the mint and the owner identify the movement exactly.
  if (invoice.contract) {
    const balances: Array<{ mint: string; owner?: string; uiTokenAmount?: { uiAmount?: number | null } }> =
      result.meta?.postTokenBalances ?? [];
    const entry = balances.find((row) => row.mint === invoice.contract && row.owner === invoice.address);
    const post = Number(entry?.uiTokenAmount?.uiAmount ?? 0);
    const before = (result.meta?.preTokenBalances ?? []).find(
      (row: { mint: string; owner?: string }) => row.mint === invoice.contract && row.owner === invoice.address,
    );
    const pre = Number((before as { uiTokenAmount?: { uiAmount?: number | null } } | undefined)?.uiTokenAmount?.uiAmount ?? 0);
    if (!entry || post <= pre) {
      return { found: true, amount: 0, confirmations: 0, destination: invoice.address, network: 'Solana', time, reason: 'no transfer to this wallet' };
    }
    return { found: true, amount: post - pre, confirmations: result.meta?.confirmations ?? 1, destination: invoice.address, network: 'Solana', time };
  }

  const index = accountKeys.findIndex((key) => key.pubkey === invoice.address);
  const pre = result.meta?.preBalances?.[index] ?? 0;
  const post = result.meta?.postBalances?.[index] ?? 0;
  if (index < 0 || post <= pre) {
    return { found: true, amount: 0, confirmations: 0, destination: invoice.address, network: 'Solana', time, reason: 'no transfer to this wallet' };
  }
  return { found: true, amount: (post - pre) / 1e9, confirmations: result.meta?.confirmations ?? 1, destination: invoice.address, network: 'Solana', time };
}

function readChain(hash: string, invoice: InvoiceRow): Promise<ChainFacts | null> | null {
  if (invoice.network in EVM) return readEvm(invoice.network as keyof typeof EVM, hash, invoice);
  if (invoice.network === 'TRC20') return readTrc20(hash, invoice);
  if (invoice.network === 'Solana') return readSolana(hash, invoice);
  return null;
}

/**
 * Transfers that reached the wallet after the invoice was created, with the
 * amount the chain reports for each one.
 *
 * Token transfers are read straight from the node with an address and topic
 * filter, so no explorer account is needed. Native coin transfers need an index,
 * which only the explorer provides; without a key the customer can paste the
 * transaction id and it is still verified on chain.
 *
 * The watcher only settles candidates whose amount matches the invoice, so an
 * unrelated payment into the same wallet can never mark a waiting invoice as
 * wrong. A null amount means the chain did not publish one; those are settled
 * and let the settlement rules decide.
 */
async function discover(invoice: InvoiceRow): Promise<Array<{ hash: string; amount: number | null }>> {
  const since = Date.parse(invoice.created_at) - 15 * 60_000;
  try {
    if (invoice.network in EVM) {
      const config = EVM[invoice.network as keyof typeof EVM];
      if (!invoice.contract) {
        if (!config.key) return [];
        const body = await fetch(
          `${config.scan}?apikey=${config.key}&module=account&action=txlist&address=${invoice.address}` +
          '&startblock=0&endblock=99999999&page=1&offset=40&sort=desc',
        ).then((r) => r.json());
        const rows: Array<Record<string, string>> = Array.isArray(body?.result) ? body.result : [];
        return rows
          .filter((row) => Number(row.timeStamp) * 1000 >= since && String(row.to).toLowerCase() === invoice.address.toLowerCase())
          .map((row) => ({ hash: row.hash, amount: Number(row.value) / 1e18 }))
          .slice(0, 8);
      }

      const head = hex(await rpc(config.rpc, 'eth_blockNumber', []));
      const topics = [TRANSFER_TOPIC, null, `0x${invoice.address.toLowerCase().replace(/^0x/, '').padStart(64, '0')}`];
      const found: Array<{ hash: string; amount: number | null }> = [];
      // A little over an hour of BNB Smart Chain blocks, matching the invoice
      // window without asking a public node for a huge range.
      for (let end = head; end > head - 3000 && found.length < 8; end -= 500) {
        const logs = await rpc(config.rpc, 'eth_getLogs', [{
          address: invoice.contract.toLowerCase(),
          topics,
          fromBlock: `0x${Math.max(0, end - 499).toString(16)}`,
          toBlock: `0x${end.toString(16)}`,
        }]);
        for (const log of logs ?? []) {
          found.push({
            hash: String(log.transactionHash),
            amount: Number(BigInt(String(log.data))) / 10 ** (invoice.decimals ?? 18),
          });
        }
      }
      return found.slice(0, 8);
    }
    if (invoice.network === 'TRC20') {
      const headers: Record<string, string> = TRON_KEY ? { 'TRON-PRO-API-KEY': TRON_KEY } : {};
      const body = await fetch(
        `https://apilist.tronscanapi.com/api/token_trc20/transfers?limit=40&start=0&sort=-timestamp&count=true&toAddress=${invoice.address}`,
        { headers },
      ).then((r) => r.json());
      const rows: Array<Record<string, unknown>> = body?.token_transfers ?? [];
      return rows
        .filter((row) => Number(row.block_ts ?? 0) >= since)
        .map((row) => ({
          hash: String(row.transaction_id ?? ''),
          amount: Number((row.quant ?? (row as { amount_str?: string }).amount_str) ?? 0) / 10 ** (invoice.decimals ?? 6),
        }))
        .filter((row) => Boolean(row.hash))
        .slice(0, 8);
    }
    if (invoice.network === 'Solana') {
      const body = await fetch(SOLANA_RPC, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSignaturesForAddress', params: [invoice.address, { limit: 20 }] }),
      }).then((r) => r.json());
      const rows: Array<{ signature: string; blockTime?: number }> = body?.result ?? [];
      return rows
        .filter((row) => (row.blockTime ?? 0) * 1000 >= since)
        .map((row) => ({ hash: row.signature, amount: null }))
        .slice(0, 8);
    }
  } catch {
    return [];
  }
  return [];
}

/** True when a discovered transfer is close enough to the invoice amount. */
function plausible(candidate: { amount: number | null }, invoice: InvoiceRow): boolean {
  if (candidate.amount === null) return true;
  return candidate.amount >= invoice.amount_expected * 0.995 && candidate.amount <= invoice.amount_expected * 1.2;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const anon = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });

  let body: { invoice_id?: string; tx_hash?: string; action?: string; secret?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid body' }, 400);
  }

  const { data: authUser } = await anon.auth.getUser();
  const isAdmin = authUser?.user
    ? Boolean((await anon.rpc('pro_is_admin')).data)
    : false;
  const secretOk = WATCH_SECRET.length > 0 && body.secret === WATCH_SECRET;

  const settleFor = async (invoice: InvoiceRow, hash: string) => {
    const facts = readChain(hash, invoice);
    if (!facts) return { status: 'pending', message: `automatic checks are not available for ${invoice.network}` };
    const resolved = await facts;
    if (!resolved) return { status: 'pending', message: `automatic checks are not available for ${invoice.network}` };
    const { data, error } = await admin.rpc('pro_settle_crypto', {
      p_invoice: invoice.id,
      p_tx: hash,
      p_received: resolved.amount,
      p_confirmations: resolved.confirmations,
      p_payload: { network: resolved.network, destination: resolved.destination, reason: resolved.reason ?? null, checked_at: new Date().toISOString() },
      p_tx_time: resolved.time ?? null,
    });
    if (error) return { status: 'pending', error: error.message };
    return {
      status: (data as { status?: string })?.status ?? 'pending',
      reason: (data as { reason?: string })?.reason,
      amount: resolved.amount,
      confirmations: resolved.confirmations,
      required: invoice.confirmations_required,
      network: resolved.network,
    };
  };

  // ---- watch mode ---------------------------------------------------------
  if (body.action === 'watch') {
    if (!isAdmin && !secretOk) return json({ error: 'not allowed' }, 403);
    const { data: candidates, error } = await admin.rpc('pro_watch_invoices');
    if (error) return json({ error: error.message }, 500);
    const rows = (candidates ?? []) as InvoiceRow[];
    const results: Array<Record<string, unknown>> = [];

    for (const invoice of rows) {
      const found = (await discover(invoice)).filter((candidate) => plausible(candidate, invoice));
      if (!found.length) {
        results.push({ invoice: invoice.id, status: 'waiting' });
        continue;
      }
      let settled: Record<string, unknown> | null = null;
      for (const candidate of found) {
        const attempt = await settleFor(invoice, candidate.hash);
        if (attempt.status === 'confirmed') {
          settled = { ...attempt, tx: candidate.hash };
          break;
        }
        if (!settled && attempt.status !== 'pending') settled = { ...attempt, tx: candidate.hash };
      }
      results.push({ invoice: invoice.id, status: (settled?.status as string) ?? 'waiting', tx: settled?.tx ?? null });
    }

    return json({ scanned: rows.length, settled: results.filter((row) => row.status === 'confirmed').length, results });
  }

  // ---- one invoice --------------------------------------------------------
  if (!body.invoice_id) return json({ error: 'invoice_id required' }, 400);
  if (!authUser?.user) return json({ error: 'unauthorized' }, 401);

  const { data: invoice } = await admin
    .from('crypto_invoices')
    .select('id, order_id, asset_id, address, amount_expected, status, tx_hash, expires_at, created_at')
    .eq('id', body.invoice_id)
    .maybeSingle();
  if (!invoice) return json({ error: 'invoice not found' }, 404);

  const { data: order } = await admin
    .from('payment_orders')
    .select('id, user_id, status, method')
    .eq('id', invoice.order_id)
    .maybeSingle();
  if (!order || (order.user_id !== authUser.user.id && !isAdmin)) return json({ error: 'invoice not found' }, 404);
  if (order.method !== 'crypto') return json({ error: 'not a crypto order' }, 400);
  if (order.status === 'approved') return json({ status: 'confirmed', order: order.id });

  const { data: asset } = await admin
    .from('crypto_assets')
    .select('id, symbol, network, address, contract, decimals, confirmations, usd_rate')
    .eq('id', invoice.asset_id)
    .single();
  if (!asset) return json({ error: 'asset unavailable' }, 400);

  const row: InvoiceRow = {
    id: invoice.id,
    order_id: invoice.order_id,
    asset_id: invoice.asset_id,
    address: invoice.address,
    contract: (asset as { contract?: string | null }).contract ?? null,
    symbol: (asset as { symbol: string }).symbol,
    network: (asset as { network: string }).network,
    decimals: Number((asset as { decimals: number }).decimals ?? 6),
    amount_expected: Number(invoice.amount_expected),
    confirmations_required: Number((asset as { confirmations: number }).confirmations),
    created_at: invoice.created_at,
    expires_at: invoice.expires_at,
  };

  // No hash supplied: look for one on the chain before answering "nothing yet".
  let hash = (body.tx_hash ?? invoice.tx_hash ?? '').trim();
  if (!hash) {
    const found = (await discover(row)).filter((candidate) => plausible(candidate, row));
    hash = found[0]?.hash ?? '';
  }
  if (!hash) return json({ status: 'pending', message: 'waiting for the transfer' });

  try {
    const result = await settleFor(row, hash);
    return json({ ...result, tx_hash: hash });
  } catch (error) {
    return json({ status: 'pending', error: error instanceof Error ? error.message : 'verification error' }, 502);
  }
});
