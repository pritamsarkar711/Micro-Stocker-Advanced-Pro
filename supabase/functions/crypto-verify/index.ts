// Edge function: turns a chain transaction into a paid order.
//
// The browser may only name an invoice. It cannot name an amount, a destination
// or a status: every value used for settlement is read from the explorer here,
// compared with the invoice, and written by pro_settle_crypto with the service
// role. A reused hash, a short payment or a wrong destination never settles.

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
const TRON_KEY = Deno.env.get('TRON_API_KEY') ?? '';
const SOLANA_RPC = Deno.env.get('SOLANA_RPC_URL') ?? 'https://api.mainnet-beta.solana.com';

type ChainFacts = {
  found: boolean;
  amount: number;
  confirmations: number;
  destination: string;
  network: string;
  reason?: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}

const evmChains: Record<string, { api: string; explorerKey: string }> = {
  BEP20: { api: 'https://api.bscscan.com/api', explorerKey: BSCSCAN_KEY },
  Polygon: { api: 'https://api.polygonscan.com/api', explorerKey: Deno.env.get('POLYGONSCAN_API_KEY') ?? '' },
};

async function readErc20(chain: keyof typeof evmChains, hash: string, asset: string, address: string): Promise<ChainFacts | null> {
  const config = evmChains[chain];
  if (!config.explorerKey) return null;
  const base = `${config.api}?apikey=${config.explorerKey}`;
  const [receipt, tx] = await Promise.all([
    fetch(`${base}&module=proxy&action=eth_getTransactionReceipt&txhash=${hash}`).then((r) => r.json()),
    fetch(`${base}&module=proxy&action=eth_getTransactionByHash&txhash=${hash}`).then((r) => r.json()),
  ]);
  const result = receipt?.result;
  if (!result) return { found: false, amount: 0, confirmations: 0, destination: '', network: chain };
  const status = parseInt(result.status ?? '0x0', 16);
  const to = String(tx?.result?.to ?? '').toLowerCase();
  if (status !== 1) return { found: true, amount: 0, confirmations: 0, destination: to, network: chain, reason: 'transaction reverted' };
  if (to !== address.toLowerCase()) {
    return { found: true, amount: 0, confirmations: 0, destination: to, network: chain, reason: 'wrong destination' };
  }
  const log = (result.logs ?? []).find((entry: Record<string, string>) => entry.to?.toLowerCase() === asset.toLowerCase());
  if (!log) return { found: true, amount: 0, confirmations: 0, destination: to, network: chain, reason: 'transfer not found' };
  // ERC20 transfer amount is word 3 of the data payload.
  const data = String(log.data ?? '');
  const amountHex = `0x${data.slice(2 + 64 * 2, 2 + 64 * 3)}`;
  const raw = Number(BigInt(amountHex));
  const block = await fetch(`${base}&module=proxy&action=eth_blockNumber`).then((r) => r.json());
  const head = parseInt(block?.result ?? '0x0', 16);
  const mined = parseInt(result.blockNumber ?? '0x0', 16);
  return {
    found: true,
    amount: raw / 1e6,
    confirmations: Math.max(0, head - mined + 1),
    destination: to,
    network: chain,
  };
}

async function readTrc20(hash: string, asset: string, address: string): Promise<ChainFacts | null> {
  const headers: Record<string, string> = TRON_KEY ? { 'TRON-PRO-API-KEY': TRON_KEY } : {};
  const info = await fetch(`https://apilist.tronscanapi.com/api/transaction-info?hash=${hash}`, { headers }).then((r) => r.json());
  if (!info || info.Error) return { found: false, amount: 0, confirmations: 0, destination: '', network: 'TRC20' };
  const confirmed = Boolean(info.confirmed ?? info.confirmations >= 19);
  const transfer = info.trc20TransferInfo?.[0]?.to_address === address
    ? info.trc20TransferInfo[0]
    : (info.trc20TransferInfo ?? []).find((entry: Record<string, string>) => entry.to_address === address);
  if (!transfer) {
    return { found: true, amount: 0, confirmations: 0, destination: info.contractData?.to_address ?? '', network: 'TRC20', reason: 'wrong destination' };
  }
  if (asset && transfer.contract_address && transfer.contract_address !== asset) {
    return { found: true, amount: 0, confirmations: 0, destination: address, network: 'TRC20', reason: 'wrong token' };
  }
  return {
    found: true,
    amount: Number(transfer.amount_str ?? 0) / 1e6,
    confirmations: confirmed ? 19 : 1,
    destination: address,
    network: 'TRC20',
  };
}

async function readSolana(hash: string, address: string): Promise<ChainFacts | null> {
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
  if (result.meta?.err) return { found: true, amount: 0, confirmations: 0, destination: '', network: 'Solana', reason: 'transaction failed' };

  const accountKeys: { pubkey: string }[] = result.transaction?.message?.accountKeys ?? [];
  const index = accountKeys.findIndex((key) => key.pubkey === address);
  const pre = result.meta?.preBalances?.[index] ?? 0;
  const post = result.meta?.postBalances?.[index] ?? 0;
  if (index < 0 || post <= pre) {
    return { found: true, amount: 0, confirmations: 0, destination: address, network: 'Solana', reason: 'no transfer to this address' };
  }
  return {
    found: true,
    amount: (post - pre) / 1e9,
    confirmations: result.meta?.confirmations ?? 1,
    destination: address,
    network: 'Solana',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) return json({ error: 'unauthorized' }, 401);

  const user = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: authUser } = await user.auth.getUser();
  if (!authUser?.user) return json({ error: 'unauthorized' }, 401);

  let body: { invoice_id?: string; tx_hash?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid body' }, 400);
  }
  if (!body.invoice_id) return json({ error: 'invoice_id required' }, 400);

  const { data: invoice } = await admin
    .from('crypto_invoices')
    .select('id, order_id, asset_id, address, amount_expected, amount_usd, status, tx_hash, expires_at')
    .eq('id', body.invoice_id)
    .maybeSingle();
  if (!invoice) return json({ error: 'invoice not found' }, 404);

  const { data: order } = await admin
    .from('payment_orders')
    .select('id, user_id, status, method')
    .eq('id', invoice.order_id)
    .maybeSingle();
  if (!order || order.user_id !== authUser.user.id) return json({ error: 'invoice not found' }, 404);
  if (order.method !== 'crypto') return json({ error: 'not a crypto order' }, 400);
  if (order.status === 'approved') return json({ status: 'confirmed', order: order.id });

  const { data: asset } = await admin
    .from('crypto_assets')
    .select('id, symbol, network, address, decimals, confirmations, usd_rate')
    .eq('id', invoice.asset_id)
    .single();
  if (!asset) return json({ error: 'asset unavailable' }, 400);

  const hash = (body.tx_hash ?? invoice.tx_hash ?? '').trim();
  if (!hash) return json({ status: 'pending', message: 'waiting for a transaction hash' });

  const settle = async (facts: ChainFacts) => {
    const { data, error } = await admin.rpc('pro_settle_crypto', {
      p_invoice: invoice.id,
      p_tx: hash,
      p_received: facts.amount,
      p_confirmations: facts.confirmations,
      p_payload: { network: facts.network, destination: facts.destination, reason: facts.reason ?? null, checked_at: new Date().toISOString() },
    });
    if (error) throw error;
    return data;
  };

  try {
    let facts: ChainFacts | null = null;
    if (asset.network in evmChains) {
      const token = asset.symbol === 'USDT' || asset.symbol === 'USDC' || asset.symbol === 'DAI' ? asset.address : asset.address;
      facts = await readErc20(asset.network as keyof typeof evmChains, hash, token, invoice.address);
    } else if (asset.network === 'TRC20') {
      facts = await readTrc20(hash, '', invoice.address);
    } else if (asset.network === 'Solana') {
      facts = await readSolana(hash, invoice.address);
    }

    if (!facts) {
      return json({
        status: 'pending',
        message: 'automatic verification is not configured for this network yet, an admin will review it',
        network: asset.network,
      });
    }
    if (!facts.found) {
      return json({ status: 'pending', message: 'transaction not visible yet', network: facts.network });
    }
    if (facts.amount === 0) {
      await settle(facts);
      return json({ status: 'mismatch', reason: facts.reason ?? 'no matching transfer', network: facts.network });
    }
    const settled = await settle(facts);
    return json({
      status: settled?.status ?? 'pending',
      confirmed: settled?.status === 'confirmed',
      amount: facts.amount,
      confirmations: facts.confirmations,
      required: asset.confirmations,
      network: facts.network,
    });
  } catch (error) {
    return json({ status: 'pending', error: error instanceof Error ? error.message : 'verification error' }, 502);
  }
});
