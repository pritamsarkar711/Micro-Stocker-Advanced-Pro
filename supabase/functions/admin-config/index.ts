// Edge function: writes provider keys without ever returning them.
//
// Only an admin JWT can call it. The key is written with the service role into
// pro_provider_keys (no grants, no policies, invisible to every client) and the
// response contains a masked hint so the panel can show "sk-...f2c9".
//
// pro_is_admin() itself requires aal2 once the administrator owns an
// authenticator, so this endpoint inherits two step verification for free.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

/** Known shapes so a pasted dashboard URL or placeholder is rejected early. */
const KEY_RULES: Record<string, { prefixes?: string[]; note: string }> = {
  moonshot: { prefixes: ['sk-'], note: 'Moonshot keys start with sk-.' },
  deepseek: { prefixes: ['sk-'], note: 'DeepSeek keys start with sk-.' },
  minimax: { note: 'MiniMax keys are long JWT style strings.' },
  openai: { prefixes: ['sk-'], note: 'OpenAI keys start with sk-.' },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}

function mask(secret: string): string {
  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
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
  const { data: isAdmin } = await user.rpc('pro_is_admin');
  if (!isAdmin) return json({ error: 'not allowed' }, 403);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  let body: { action?: string; provider_id?: string; secret?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid body' }, 400);
  }

  const action = body.action ?? 'set-key';
  const providerId = (body.provider_id ?? '').trim();
  if (!providerId) return json({ error: 'provider_id required' }, 400);

  const { data: provider } = await admin.from('ai_providers').select('id, label').eq('id', providerId).maybeSingle();
  if (!provider) return json({ error: 'unknown provider' }, 404);

  if (action === 'clear-key') {
    await admin.from('pro_provider_keys').delete().eq('provider_id', providerId);
    await admin
      .from('ai_providers')
      .update({ key_hint: null, key_updated_at: null })
      .eq('id', providerId);
    await admin.from('admin_audit').insert({ action: 'provider.key.clear', target: providerId, detail: {} });
    return json({ ok: true, provider_id: providerId, key_hint: null });
  }

  if (action !== 'set-key') return json({ error: 'unknown action' }, 400);

  // Trim pasted whitespace, invisible characters and the quotes a chat app adds.
  const secret = (body.secret ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim();
  if (secret.length < 16 || secret.length > 400) return json({ error: 'That key looks too short or too long. Copy the whole value.' }, 400);
  if (/\s/.test(secret)) return json({ error: 'Keys never contain spaces. Copy it again without line breaks.' }, 400);
  if (/^(your|paste|enter|sk-xxx|sk-\.\.\.|test|changeme)/i.test(secret)) {
    return json({ error: 'That looks like the placeholder text, not a real key.' }, 400);
  }
  const rules = KEY_RULES[providerId];
  if (rules?.prefixes && !rules.prefixes.some((prefix) => secret.startsWith(prefix))) {
    return json({ error: rules.note }, 400);
  }

  const hint = mask(secret);
  const { error } = await admin.from('pro_provider_keys').upsert(
    { provider_id: providerId, secret, updated_at: new Date().toISOString(), updated_by: null },
    { onConflict: 'provider_id' },
  );
  if (error) return json({ error: 'could not store key' }, 500);

  await admin.from('ai_providers').update({ key_hint: hint, key_updated_at: new Date().toISOString() }).eq('id', providerId);
  await admin.from('admin_audit').insert({ action: 'provider.key', target: providerId, detail: { hint } });

  return json({ ok: true, provider_id: providerId, key_hint: hint, label: provider.label });
});
