-- Tokens.bd is the primary supply for model access.
--
-- It speaks the OpenAI format at https://tokens.bd/v1 and also answers the
-- Anthropic format at the root, so one key covers every model the studio uses.
-- Model ids are namespaced, for example deepseek/deepseek-v4.1-flash.
--
-- The deepseek row below uses the id published in the tokens.bd documentation.
-- The other three are seeded switched off: confirm each id in the tokens.bd
-- dashboard, paste the key in the admin console, then enable the row. A wrong
-- id would fail at run time, and an admin should not pay for that discovery.
insert into public.ai_providers (id, label, base_url, enabled, sort)
values ('tokensbd', 'Tokens.bd', 'https://tokens.bd/v1', true, 0)
on conflict (id) do update
  set base_url = excluded.base_url,
      label = excluded.label,
      sort = excluded.sort;

insert into public.ai_models (id, provider_id, upstream_id, label, kind, premium, enabled, cost_in_per_mtok, cost_out_per_mtok, notes, sort)
values
  ('tb-deepseek-flash', 'tokensbd', 'deepseek/deepseek-v4.1-flash', 'DeepSeek 4.1 Flash', 'vector', false, true, 0.14, 0.28, 'Primary vector model through tokens.bd', 0),
  ('tb-gemini-flash', 'tokensbd', 'google/gemini-5.3-flash', 'Gemini 5.3 Flash', 'vector', true, false, 0.10, 0.40, 'Confirm the id in the tokens.bd dashboard, then enable', 1),
  ('tb-minimax-flash', 'tokensbd', 'minimax/MiniMax-M3.1-Flash', 'MiniMax 3.1 Flash', 'vector', false, false, 0.09, 0.36, 'Confirm the id in the tokens.bd dashboard, then enable', 2),
  ('tb-kimi', 'tokensbd', 'moonshotai/kimi-k2.5', 'Kimi K2.5', 'vector', true, false, 0.60, 1.80, 'Confirm the id in the tokens.bd dashboard, then enable', 3),
  ('tb-image', 'tokensbd', 'openai/gpt-image-1', 'Image Studio', 'image', true, false, 0, 0, 'Image generation id from tokens.bd; confirm before enabling', 4)
on conflict (id) do update
  set provider_id = excluded.provider_id,
      upstream_id = excluded.upstream_id,
      label = excluded.label,
      kind = excluded.kind,
      notes = excluded.notes,
      sort = excluded.sort;

-- One supply is simpler to bill and to rotate: the direct provider rows stay in
-- the table for reference but are switched off with their models.
update public.ai_models set enabled = false where provider_id <> 'tokensbd';
update public.ai_providers set enabled = false where id <> 'tokensbd';
