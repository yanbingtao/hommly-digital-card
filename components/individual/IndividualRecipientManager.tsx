'use client';

import { useMemo, useState } from 'react';
import {
  computeBuyerFacingStatusCounts,
  filterRecipientsByBuyerStatus,
  formatSelectedGiftCountLabel,
  getBatchEditActionLabel,
  getPublishedProgressPercent,
  clearRecipientSelection,
  selectAllRecipientIds,
  setSingleRecipientSelection,
  toggleRecipientSelection,
  type BuyerFacingRecipientFilter,
  type IndividualRecipientManagerItem,
} from '@/lib/individual-recipient-manager';
import { refreshIndividualRecipientManager } from '@/lib/individual-recipient-editor-actions';
import { IndividualRecipientEditor } from '@/components/individual/IndividualRecipientEditor';
import { RecipientManagerRow } from '@/components/individual/RecipientManagerRow';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';

type ManagerView = 'list' | 'editor';

const FILTER_OPTIONS: Array<{ id: BuyerFacingRecipientFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'not_started', label: 'Not started' },
  { id: 'published', label: 'Published' },
];

type IndividualRecipientManagerProps = {
  editToken: string;
  initialRecipients: IndividualRecipientManagerItem[];
};

export function IndividualRecipientManager({
  editToken,
  initialRecipients,
}: IndividualRecipientManagerProps) {
  const [recipients, setRecipients] = useState(initialRecipients);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [filter, setFilter] = useState<BuyerFacingRecipientFilter>('all');
  const [view, setView] = useState<ManagerView>('list');

  const sortedRecipients = useMemo(
    () => [...recipients].sort((a, b) => a.recipient_number - b.recipient_number),
    [recipients]
  );

  const counts = useMemo(() => computeBuyerFacingStatusCounts(sortedRecipients), [sortedRecipients]);
  const progressPercent = getPublishedProgressPercent({
    published_count: counts.published_count,
    draft_count: 0,
    not_started_count: counts.not_started_count,
    total_count: counts.total_count,
  });
  const visibleRecipients = useMemo(
    () => filterRecipientsByBuyerStatus(sortedRecipients, filter),
    [sortedRecipients, filter]
  );

  const selectedCount = selectedIds.size;
  const batchEditLabel = getBatchEditActionLabel(selectedCount);
  const editorRecipientIds = useMemo(() => Array.from(selectedIds), [selectedIds]);

  const openEditor = (nextSelection: Set<string>) => {
    setSelectedIds(nextSelection);
    setView('editor');
  };

  const handlePublished = async () => {
    const refreshed = await refreshIndividualRecipientManager({ edit_token: editToken });
    if (refreshed.error || !refreshed.recipients) {
      toast.error(refreshed.error ?? 'Published, but the gift list could not be refreshed.');
      return;
    }

    setRecipients(refreshed.recipients);
    setSelectedIds(clearRecipientSelection());
    setView('list');
  };

  if (view === 'editor' && editorRecipientIds.length > 0) {
    return (
      <IndividualRecipientEditor
        editToken={editToken}
        recipientIds={editorRecipientIds}
        onBack={() => setView('list')}
        onPublished={handlePublished}
      />
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-28">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-xl px-4 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-rose-500" />
            <div>
              <h1 className="text-base font-semibold text-stone-800">Personalise Your Gifts</h1>
              <p className="text-sm text-stone-500">Choose one, several, or all gifts to personalise.</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-6">
        <Card className="border-stone-200">
          <CardContent className="space-y-5 p-5">
            <div className="space-y-3">
              <div>
                <p className="text-lg font-semibold text-stone-800">
                  {counts.total_count} Gift{counts.total_count === 1 ? '' : 's'}
                </p>
                <p className="text-sm text-stone-600">
                  {counts.published_count} of {counts.total_count} published
                </p>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-stone-100"
                role="progressbar"
                aria-valuenow={progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Published progress"
              >
                <div
                  className="h-full rounded-full bg-rose-500 transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="grid gap-1 text-sm text-stone-700 sm:grid-cols-2">
                <p>✅ Published: {counts.published_count}</p>
                <p>⚪ Not started: {counts.not_started_count}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedIds(selectAllRecipientIds(sortedRecipients))}
              >
                Select All
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedIds(clearRecipientSelection())}
              >
                Clear
              </Button>
            </div>

            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter gifts">
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === option.id}
                  onClick={() => setFilter(option.id)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    filter === option.id
                      ? 'bg-rose-100 text-rose-800 ring-1 ring-rose-200'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="divide-y divide-stone-100 rounded-lg border border-stone-200 px-3">
              {visibleRecipients.length === 0 ? (
                <p className="py-6 text-center text-sm text-stone-500">No gifts match this filter.</p>
              ) : (
                visibleRecipients.map((item) => (
                  <RecipientManagerRow
                    key={item.id}
                    item={item}
                    checked={selectedIds.has(item.id)}
                    onCheckedChange={() => {
                      setSelectedIds((current) => toggleRecipientSelection(current, item.id));
                    }}
                    onEdit={() => openEditor(setSingleRecipientSelection(item.id))}
                  />
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      {selectedCount > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-stone-800">
              {formatSelectedGiftCountLabel(selectedCount)}
            </p>
            <Button
              type="button"
              className="bg-rose-500 hover:bg-rose-600"
              onClick={() => openEditor(new Set(selectedIds))}
            >
              {batchEditLabel}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
