import { useEffect, useState } from 'react';
import { licensingClient } from '@/lib/cloud/licensing';
import { demoMode } from '@/lib/cloud/demo';

export interface RenderModel {
  id: string;
  label: string;
  provider: string;
  providerLabel: string;
  /** Rough per render cost, shown as a hint, never charged from the browser. */
  note?: string;
}

const DEMO_MODELS: RenderModel[] = [
  { id: 'deepseek-flash', label: 'DeepSeek 4.1 Flash', provider: 'deepseek', providerLabel: 'DeepSeek', note: 'fast, sharp briefs' },
  { id: 'gemini-5.3-flash', label: 'Gemini 5.3 Flash', provider: 'google', providerLabel: 'Google', note: 'best detail' },
  { id: 'minimax-m3.1-flash', label: 'MiniMax 3.1 Flash', provider: 'minimax', providerLabel: 'MiniMax', note: 'cheapest' },
  { id: 'kimi-k2.5', label: 'Kimi K2.5', provider: 'moonshot', providerLabel: 'Moonshot', note: 'long context' },
];

let cache: { key: string; models: RenderModel[]; at: number } | null = null;

/**
 * Models a user may pick for a generator. The list comes from the server, so an
 * administrator can add a model in the console and it appears in the picker
 * without a rebuild. A failure degrades to the built in list instead of an
 * empty select.
 */
export function useRenderModels(kind: 'vector' | 'image'): RenderModel[] {
  const [models, setModels] = useState<RenderModel[]>(() => {
    if (demoMode) return kind === 'vector' ? DEMO_MODELS : [{ id: 'gpt-image-1', label: 'OpenAI Image', provider: 'openai', providerLabel: 'OpenAI' }];
    return cache?.key === kind ? cache.models : [];
  });

  useEffect(() => {
    if (demoMode) return;
    if (cache && cache.key === kind && Date.now() - cache.at < 120_000) {
      setModels(cache.models);
      return;
    }
    const client = licensingClient();
    if (!client) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await client
        .from('ai_models')
        .select('id, label, provider_id, enabled, kind, sort')
        .eq('enabled', true)
        .eq('kind', kind)
        .order('sort');
      if (cancelled || error || !data?.length) return;
      const list = (data as Array<{ id: string; label: string; provider_id: string }>).map((row) => ({
        id: row.id,
        label: row.label,
        provider: row.provider_id,
        providerLabel: row.provider_id,
      }));
      cache = { key: kind, models: list, at: Date.now() };
      setModels(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [kind]);

  return models;
}
