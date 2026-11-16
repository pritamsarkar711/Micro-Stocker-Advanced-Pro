import { useState, type FormEvent } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { GIcon } from '@/components/ui/GoogleIcon';
import { useBank } from '@/state/bank';
import { useToast } from '@/state/ToastState';
import { parseKeywordInput } from '@/lib/stock/metadata';

export function BankPage() {
  const { bank, setSynonyms, deleteSynonymKey, setCategory, deleteCategory, resetBank } = useBank();
  const toast = useToast();

  const [trigger, setTrigger] = useState('');
  const [words, setWords] = useState('');
  const [catName, setCatName] = useState('');
  const [catWords, setCatWords] = useState('');

  function handleAddSynonym(e: FormEvent) {
    e.preventDefault();
    const key = trigger.trim().toLowerCase();
    const list = parseKeywordInput(words);
    if (!key || !list.length) return;
    setSynonyms(key, list);
    setTrigger('');
    setWords('');
    toast.success(`Saved synonym set for ${key}`);
  }

  function handleAddCategory(e: FormEvent) {
    e.preventDefault();
    const key = catName.trim().toLowerCase();
    const list = parseKeywordInput(catWords);
    if (!key || !list.length) return;
    setCategory(key, list);
    setCatName('');
    setCatWords('');
    toast.success(`Saved pack ${key}`);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Keyword Bank"
        actions={
          <Button
            size="sm"
            variant="ghost"
            icon={<GIcon name="restart_alt" size={15} />}
            onClick={() => {
              resetBank();
              toast.info('Keyword bank reset');
            }}
          >
            Reset defaults
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="space-y-4">
          <CardHeader title="Synonym Sets" icon={<GIcon name="local_offer" size={17} />} />

          <form onSubmit={handleAddSynonym} className="grid grid-cols-1 gap-2.5 sm:grid-cols-12">
            <div className="sm:col-span-4">
              <Field label="Trigger word">
                <Input
                  value={trigger}
                  onChange={(e) => setTrigger(e.target.value)}
                  placeholder="coffee"
                />
              </Field>
            </div>
            <div className="sm:col-span-6">
              <Field label="Related tags">
                <Input
                  value={words}
                  onChange={(e) => setWords(e.target.value)}
                  placeholder="espresso, latte, cafe, morning"
                />
              </Field>
            </div>
            <div className="flex items-end sm:col-span-2">
              <Button type="submit" size="md" variant="primary" className="w-full">
                Save
              </Button>
            </div>
          </form>

          <div className="divide-y divide-line">
            {Object.entries(bank.synonyms).map(([key, list]) => (
              <div key={key} className="flex items-start justify-between gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-ink">{key}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {list.map((w) => (
                      <span
                        key={w}
                        className="rounded-[var(--r-xs)] bg-surface-2 px-1.5 py-0.5 text-2xs text-ink-muted"
                      >
                        {w}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => deleteSynonymKey(key)}
                  className="inline-flex size-6 items-center justify-center text-ink-faint hover:text-danger"
                  aria-label={`Delete ${key}`}
                >
                  <GIcon name="delete" size={14} />
                </button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-4">
          <CardHeader title="Topic Packs" icon={<GIcon name="category" size={17} />} />

          <form onSubmit={handleAddCategory} className="grid grid-cols-1 gap-2.5 sm:grid-cols-12">
            <div className="sm:col-span-4">
              <Field label="Pack name">
                <Input
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="minimal studio"
                />
              </Field>
            </div>
            <div className="sm:col-span-6">
              <Field label="Keywords">
                <Input
                  value={catWords}
                  onChange={(e) => setCatWords(e.target.value)}
                  placeholder="clean, copy space, isolated, white"
                />
              </Field>
            </div>
            <div className="flex items-end sm:col-span-2">
              <Button type="submit" size="md" variant="primary" className="w-full">
                Save
              </Button>
            </div>
          </form>

          <div className="divide-y divide-line">
            {Object.entries(bank.categories).map(([key, list]) => (
              <div key={key} className="flex items-start justify-between gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-ink">{key}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {list.map((w) => (
                      <span
                        key={w}
                        className="rounded-[var(--r-xs)] bg-surface-2 px-1.5 py-0.5 text-2xs text-ink-muted"
                      >
                        {w}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(list.join(', '));
                      toast.success('Copied pack keywords');
                    }}
                    className="inline-flex size-6 items-center justify-center text-ink-faint hover:text-accent"
                    aria-label={`Copy ${key}`}
                  >
                    <GIcon name="content_copy" size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteCategory(key)}
                    className="inline-flex size-6 items-center justify-center text-ink-faint hover:text-danger"
                    aria-label={`Delete ${key}`}
                  >
                    <GIcon name="delete" size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
