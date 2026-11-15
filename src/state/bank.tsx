import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { kv } from '@/lib/kv';

/**
 * User keyword bank: personal synonyms, extra category vocabularies and a
 * small translation dictionary. The generator merges this over its built-in
 * banks, and the item editor can append translations.
 */

export type Lang = 'es' | 'de' | 'fr';

export interface KeywordBank {
  synonyms: Record<string, string[]>;
  categories: Record<string, string[]>;
  translations: Record<string, Partial<Record<Lang, string>>>;
}

export const DEFAULT_BANK: KeywordBank = {
  synonyms: {
    ramadan: ['ramadan', 'iftar', 'islamic', 'muslim', 'crescent'],
    jute: ['jute', 'burlap', 'natural fiber', 'eco'],
    nakshi: ['embroidery', 'handcraft', 'traditional', 'folk art'],
  },
  categories: {
    cultural: ['culture', 'tradition', 'heritage', 'festival', 'craft'],
  },
  translations: {
    background: { es: 'fondo', de: 'hintergrund', fr: 'fond' },
    flower: { es: 'flor', de: 'blume', fr: 'fleur' },
    business: { es: 'negocio', de: 'geschäft', fr: 'affaires' },
    pattern: { es: 'patrón', de: 'muster', fr: 'motif' },
    food: { es: 'comida', de: 'essen', fr: 'nourriture' },
  },
};

interface BankState {
  ready: boolean;
  bank: KeywordBank;
  setSynonyms: (key: string, words: string[]) => void;
  renameSynonymKey: (from: string, to: string) => void;
  deleteSynonymKey: (key: string) => void;
  setCategory: (key: string, words: string[]) => void;
  deleteCategory: (key: string) => void;
  setTranslation: (word: string, lang: Lang, value: string) => void;
  resetBank: () => void;
}

const BankContext = createContext<BankState | null>(null);
const KEY = 'msap:keyword-bank';

export function BankProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [bank, setBank] = useState<KeywordBank>(DEFAULT_BANK);

  useEffect(() => {
    kv.get<Partial<KeywordBank>>(KEY, {}).then((stored) => {
      setBank({
        synonyms: { ...DEFAULT_BANK.synonyms, ...stored.synonyms },
        categories: { ...DEFAULT_BANK.categories, ...stored.categories },
        translations: { ...DEFAULT_BANK.translations, ...stored.translations },
      });
      setReady(true);
    });
  }, []);

  const save = useCallback((next: KeywordBank) => {
    setBank(next);
    void kv.set(KEY, next);
  }, []);

  const setSynonyms = useCallback(
    (key: string, words: string[]) => save({ ...bank, synonyms: { ...bank.synonyms, [key]: words } }),
    [bank, save],
  );
  const renameSynonymKey = useCallback(
    (from: string, to: string) => {
      const synonyms = { ...bank.synonyms };
      const words = synonyms[from];
      delete synonyms[from];
      if (to.trim()) synonyms[to.trim().toLowerCase()] = words ?? [];
      save({ ...bank, synonyms });
    },
    [bank, save],
  );
  const deleteSynonymKey = useCallback(
    (key: string) => {
      const synonyms = { ...bank.synonyms };
      delete synonyms[key];
      save({ ...bank, synonyms });
    },
    [bank, save],
  );
  const setCategory = useCallback(
    (key: string, words: string[]) => save({ ...bank, categories: { ...bank.categories, [key]: words } }),
    [bank, save],
  );
  const deleteCategory = useCallback(
    (key: string) => {
      const categories = { ...bank.categories };
      delete categories[key];
      save({ ...bank, categories });
    },
    [bank, save],
  );
  const setTranslation = useCallback(
    (word: string, lang: Lang, value: string) => {
      const entry = { ...bank.translations[word], [lang]: value };
      save({ ...bank, translations: { ...bank.translations, [word]: entry } });
    },
    [bank, save],
  );
  const resetBank = useCallback(() => save(DEFAULT_BANK), [save]);

  const value = useMemo(
    () => ({ ready, bank, setSynonyms, renameSynonymKey, deleteSynonymKey, setCategory, deleteCategory, setTranslation, resetBank }),
    [ready, bank, setSynonyms, renameSynonymKey, deleteSynonymKey, setCategory, deleteCategory, setTranslation, resetBank],
  );
  return <BankContext.Provider value={value}>{children}</BankContext.Provider>;
}

export function useBank(): BankState {
  const ctx = useContext(BankContext);
  if (!ctx) throw new Error('useBank must be used inside <BankProvider>');
  return ctx;
}
