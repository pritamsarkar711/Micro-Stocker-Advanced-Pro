import { useState } from 'react';
import { BookMarked, Globe2, Layers, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, Input } from '@/components/ui/Field';
import { useBank, type Lang } from '@/state/bank';
import { useToast } from '@/state/ToastState';

const LANGS: { id: Lang; label: string }[] = [
  { id: 'es', label: 'ES' },
  { id: 'de', label: 'DE' },
  { id: 'fr', label: 'FR' },
];

export function BankPage() {
  const bank = useBank();
  const toast = useToast();
  const [newSynKey, setNewSynKey] = useState('');
  const [newCatKey, setNewCatKey] = useState('');
  const [newWord, setNewWord] = useState('');

  const wordsEditor = (words: string[], onChange: (next: string[]) => void) => (
    <div className="flex flex-wrap gap-1.5 rounded-[0.375rem] border border-line bg-surface-2 p-2">
      {words.map((word) => (
        <span key={word} className="inline-flex items-center gap-1 rounded-[0.25rem] bg-brand-soft px-1.5 py-0.5 text-[0.6875rem] font-medium text-brand-fg">
          {word}
          <button type="button" aria-label={`Remove ${word}`} onClick={() => onChange(words.filter((w) => w !== word))}>
            <Trash2 className="size-3" />
          </button>
        </span>
      ))}
      <input
        placeholder="+ word, Enter"
        className="min-w-28 flex-1 bg-transparent px-1 py-0.5 text-xs text-fg placeholder:text-fg-subtle focus:outline-none"
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            const value = (event.target as HTMLInputElement).value.trim().toLowerCase();
            if (value && !words.includes(value)) onChange([...words, value]);
            (event.target as HTMLInputElement).value = '';
          }
        }}
      />
    </div>
  );

  return (
    <>
      <PageHeader
        title="Keyword bank"
        description="Merged into every generation"
        actions={
          <Button size="sm" variant="ghost" icon={<RotateCcw className="size-4" />} onClick={() => { bank.resetBank(); toast.info('Bank reset', 'Back to the shipped defaults plus nothing.'); }}>
            Reset to defaults
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
        <Card title="Synonyms" action={<BookMarked className="size-4 text-fg-subtle" />} flush>
          <div className="flex flex-col divide-y divide-line">
            {Object.entries(bank.bank.synonyms).map(([key, words]) => (
              <div key={key} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start">
                <div className="flex w-40 shrink-0 items-center gap-1">
                  <Input
                    defaultValue={key}
                    className="h-8 font-mono text-xs"
                    onBlur={(event) => {
                      const next = event.target.value.trim().toLowerCase();
                      if (next && next !== key) bank.renameSynonymKey(key, next);
                    }}
                  />
                  <Button size="xs" variant="ghost" aria-label={`Delete ${key}`} icon={<Trash2 className="size-3.5" />} onClick={() => bank.deleteSynonymKey(key)} />
                </div>
                <div className="flex-1">{wordsEditor(words, (next) => bank.setSynonyms(key, next))}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 border-t border-line p-3">
            <Input value={newSynKey} onChange={(e) => setNewSynKey(e.target.value)} placeholder="new token (e.g. pohela)" className="h-9" />
            <Button
              size="sm"
              icon={<Plus className="size-4" />}
              onClick={() => {
                const key = newSynKey.trim().toLowerCase();
                if (!key) return;
                bank.setSynonyms(key, []);
                setNewSynKey('');
              }}
            >
              Add
            </Button>
          </div>
        </Card>

        <div className="flex flex-col gap-2">
          <Card title="Categories" action={<Layers className="size-4 text-fg-subtle" />} flush>
            <div className="flex flex-col divide-y divide-line">
              {Object.entries(bank.bank.categories).map(([key, words]) => (
                <div key={key} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start">
                  <div className="flex w-40 shrink-0 items-center gap-1">
                    <Badge tone="brand" size="md" className="justify-center">{key}</Badge>
                    <Button size="xs" variant="ghost" aria-label={`Delete ${key}`} icon={<Trash2 className="size-3.5" />} onClick={() => bank.deleteCategory(key)} />
                  </div>
                  <div className="flex-1">{wordsEditor(words, (next) => bank.setCategory(key, next))}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 border-t border-line p-3">
              <Input value={newCatKey} onChange={(e) => setNewCatKey(e.target.value)} placeholder="new category key" className="h-9" />
              <Button
                size="sm"
                icon={<Plus className="size-4" />}
                onClick={() => {
                  const key = newCatKey.trim().toLowerCase();
                  if (!key) return;
                  bank.setCategory(key, []);
                  setNewCatKey('');
                }}
              >
                Add
              </Button>
            </div>
          </Card>

          <Card title="Translations" action={<Globe2 className="size-4 text-fg-subtle" />}>
            <div className="grid grid-cols-[1fr_repeat(3,3.5rem)] gap-2 text-[0.6875rem] font-semibold tracking-wide text-fg-subtle uppercase">
              <span>English</span>
              {LANGS.map((lang) => (
                <span key={lang.id} className="text-center">{lang.label}</span>
              ))}
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {Object.entries(bank.bank.translations).map(([word, entry]) => (
                <div key={word} className="grid grid-cols-[1fr_repeat(3,3.5rem)] items-center gap-2">
                  <span className="truncate text-sm text-fg">{word}</span>
                  {LANGS.map((lang) => (
                    <Input
                      key={lang.id}
                      defaultValue={entry[lang.id] ?? ''}
                      className="h-8 px-1.5 text-center text-xs"
                      onBlur={(event) => bank.setTranslation(word, lang.id, event.target.value.trim().toLowerCase())}
                    />
                  ))}
                </div>
              ))}
              <div className="grid grid-cols-[1fr_repeat(3,3.5rem)] items-center gap-2">
                <Field label="" className="col-span-4">
                  <div className="flex gap-2">
                    <Input value={newWord} onChange={(e) => setNewWord(e.target.value)} placeholder="add English word…" className="h-9" />
                    <Button
                      size="sm"
                      icon={<Plus className="size-4" />}
                      onClick={() => {
                        const word = newWord.trim().toLowerCase();
                        if (!word) return;
                        bank.setTranslation(word, 'es', '');
                        setNewWord('');
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </Field>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
