// Edge function: writes provider keys without ever returning them.
//
// Only an admin JWT can call it. The key is written with the service role into
// pro_provider_keys (no grants, no policies, invisible to every client) and the
// response contains a masked hint so the panel can show "sk-...f2c9".

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
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

  if (body.action !== 'set-key') return json({ error: 'unknown action' }, 400);
  const providerId = (body.provider_id ?? '').trim();
  const secret = (body.secret ?? '').trim();
  if (!providerId) return json({ error: 'provider_id required' }, 400);
  if (secret.length < 16 || secret.length > 400) return json({ error: 'key looks invalid' }, 400);

  const { data: provider } = await admin.from('ai_providers').select('id').eq('id', providerId).maybeSingle();
  if (!provider) return json({ error: 'unknown provider' }, 404);

  const hint = `${secret.slice(0, 4)}...${secret.slice(-4)}`;
  const { error } = await admin.from('pro_provider_keys').upsert(
    { provider_id: providerId, secret, updated_at: new Date().toISOString(), updated_by: null },
    { onConflict: 'provider_id' },
  );
  if (error) return json({ error: 'could not store key' }, 500);

  await admin.from('ai_providers').update({ key_hint: hint, key_updated_at: new Date().toISOString() }).eq('id', providerId);
  await admin.from('admin_audit').insert({ action: 'provider.key', target: providerId, detail: { hint } });

  return json({ ok: true, provider_id: providerId, key_hint: hint });
});
