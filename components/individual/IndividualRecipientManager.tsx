'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  computeBuyerFacingStatusCounts,
  filterRecipientsByBuyerStatus,
  formatSelectAllToolbarLabel,
  formatSelectedGiftCountLabel,
  getBatchEditActionLabel,
  getPublishedProgressPercent,
  getSelectAllToolbarState,
  clearRecipientSelection,
  selectAllRecipientIds,
  setSingleRecipientSelection,
  toggleRecipientSelection,
  type BuyerFacingRecipientFilter,
  type IndividualRecipientManagerItem,
} from '@/lib/individual-recipient-manager';
import { refreshIndividualRecipientManager } from '@/lib/individual-recipient-editor-actions';
import { BrandLogo } from '@/components/BrandLogo';
import { IndividualRecipientEditor } from '@/components/individual/IndividualRecipientEditor';
import { RecipientManagerRow } from '@/components/individual/RecipientManagerRow';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type ManagerView = 'list' | 'editor';

const FILTER_OPTIONS: Array<{
  id: BuyerFacingRecipientFilter;
  label: string;
  countKey: 'total_count' | 'not_started_count' | 'published_count';
}> = [
  { id: 'all', label: 'All', countKey: 'total_count' },
  { id: 'not_started', label: 'To personalise', countKey: 'not_started_count' },
  { id: 'published', label: 'Ready', countKey: 'published_count' },
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
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const listScrollRef = useRef<HTMLDivElement | null>(null);

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
  const selectAllState = getSelectAllToolbarState(selectedCount, counts.total_count);
  const selectAllLabel = formatSelectAllToolbarLabel(
    selectAllState,
    selectedCount,
    counts.total_count
  );
  const selectAllChecked =
    selectAllState === 'all' ? true : selectAllState === 'partial' ? 'indeterminate' : false;

  const updateListOverflow = useCallback(() => {
    const node = listScrollRef.current;
    if (!node) {
      setCanScrollUp(false);
      setCanScrollDown(false);
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = node;
    const maxScrollTop = scrollHeight - clientHeight;
    setCanScrollUp(scrollTop > 2);
    setCanScrollDown(maxScrollTop > 2 && scrollTop < maxScrollTop - 2);
  }, []);

  useEffect(() => {
    updateListOverflow();
  }, [visibleRecipients.length, filter, updateListOverflow]);

  useEffect(() => {
    const node = listScrollRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      updateListOverflow();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [updateListOverflow]);

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

  const handleSelectAllToggle = (checked: boolean | 'indeterminate') => {
    // Preserve existing Select All scope: entire order, not only the active filter.
    if (checked === true) {
      setSelectedIds(selectAllRecipientIds(sortedRecipients));
      return;
    }
    setSelectedIds(clearRecipientSelection());
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
    <div className="min-h-screen bg-[#faf8f6] pb-32">
      <main className="mx-auto w-full max-w-[800px] px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-8 sm:mb-10">
          <BrandLogo
            href={null}
            showText={false}
            className="mb-4"
            imageClassName="h-8 w-8"
          />
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-[1.75rem]">
            Personalise your gifts
          </h1>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-stone-500 sm:text-base">
            Add a personal touch to each gift — or select several to personalise them together.
          </p>
        </header>

        <section className="mb-8 sm:mb-10" aria-labelledby="gift-progress-heading">
          <h2
            id="gift-progress-heading"
            className="text-lg font-semibold tracking-tight text-stone-900 sm:text-xl"
          >
            {counts.published_count} of {counts.total_count} ready
          </h2>

          <div
            className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-stone-200/80"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Personalisation progress"
          >
            <div
              className="h-full rounded-full bg-rose-500 transition-[width] duration-200 ease-out motion-reduce:transition-none"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-stone-500">
            <div className="flex items-baseline gap-1.5">
              <dt className="sr-only">Total gifts</dt>
              <dd>
                <span className="font-medium text-stone-700">{counts.total_count}</span> gifts
              </dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="sr-only">Ready</dt>
              <dd>
                <span className="font-medium text-stone-700">{counts.published_count}</span> ready
              </dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="sr-only">To personalise</dt>
              <dd>
                <span className="font-medium text-stone-700">{counts.not_started_count}</span> to
                personalise
              </dd>
            </div>
          </dl>
        </section>

        <section aria-label="Manage gifts" className="space-y-3">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter gifts">
            {FILTER_OPTIONS.map((option) => {
              const selected = filter === option.id;
              const count = counts[option.countKey];
              return (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setFilter(option.id)}
                  className={cn(
                    'inline-flex min-h-10 items-center rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-200 motion-reduce:transition-none',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 focus-visible:ring-offset-2',
                    selected
                      ? 'bg-rose-500 text-white'
                      : 'bg-stone-100/90 text-stone-600 hover:bg-stone-200/80 hover:text-stone-800'
                  )}
                >
                  {option.label}{' '}
                  <span
                    className={cn('ml-1 tabular-nums', selected ? 'text-rose-50' : 'text-stone-400')}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200/70">
            <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/70 px-3 py-3 sm:px-5">
              <Checkbox
                id="select-all-gifts"
                checked={selectAllChecked}
                onCheckedChange={handleSelectAllToggle}
                aria-label={selectAllLabel}
                className={cn(
                  'h-5 w-5 rounded-[5px] border-stone-300 shadow-none transition-colors duration-200 motion-reduce:transition-none',
                  'data-[state=checked]:border-rose-500 data-[state=checked]:bg-rose-500 data-[state=checked]:text-white',
                  'data-[state=indeterminate]:border-rose-500 data-[state=indeterminate]:bg-rose-500 data-[state=indeterminate]:text-white',
                  'focus-visible:ring-rose-400/40'
                )}
              />
              <label
                htmlFor="select-all-gifts"
                className="min-h-11 flex-1 cursor-pointer content-center text-sm font-medium text-stone-800"
              >
                {selectAllLabel}
              </label>
              {selectedCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setSelectedIds(clearRecipientSelection())}
                  className={cn(
                    'min-h-11 shrink-0 rounded-md px-1 text-sm font-medium text-stone-500',
                    'transition-colors duration-200 motion-reduce:transition-none',
                    'hover:text-stone-800',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 focus-visible:ring-offset-2'
                  )}
                >
                  Clear selection
                </button>
              ) : null}
            </div>

            <div className="relative">
              {visibleRecipients.length === 0 ? (
                <p className="px-5 py-12 text-center text-sm text-stone-500">
                  No gifts match this filter.
                </p>
              ) : (
                <>
                  <div
                    ref={listScrollRef}
                    onScroll={updateListOverflow}
                    className={cn(
                      'gift-list-scroll max-h-[min(58dvh,520px)] overflow-y-auto overflow-x-hidden sm:max-h-[min(60vh,620px)]'
                    )}
                    role="region"
                    aria-label="Gift list"
                    tabIndex={0}
                  >
                    <ul className="divide-y divide-stone-100/90">
                      {visibleRecipients.map((item) => (
                        <li key={item.id}>
                          <RecipientManagerRow
                            item={item}
                            checked={selectedIds.has(item.id)}
                            onCheckedChange={() => {
                              setSelectedIds((current) =>
                                toggleRecipientSelection(current, item.id)
                              );
                            }}
                            onEdit={() => openEditor(setSingleRecipientSelection(item.id))}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div
                    aria-hidden="true"
                    className={cn(
                      'pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-white to-transparent transition-opacity duration-200 motion-reduce:transition-none',
                      canScrollUp ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div
                    aria-hidden="true"
                    className={cn(
                      'pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-white to-transparent transition-opacity duration-200 motion-reduce:transition-none',
                      canScrollDown ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      {selectedCount > 0 ? (
        <div
          className={cn(
            'fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3',
            'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200'
          )}
        >
          <div className="mx-auto flex w-full max-w-[800px] items-center justify-between gap-4 rounded-2xl bg-stone-900 px-4 py-3.5 text-white shadow-lg shadow-stone-900/15 sm:px-5">
            <p className="text-sm font-medium text-stone-100">
              {formatSelectedGiftCountLabel(selectedCount)}
            </p>
            <button
              type="button"
              onClick={() => openEditor(new Set(selectedIds))}
              className={cn(
                'inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-rose-500 px-4 text-sm font-semibold text-white',
                'transition-colors duration-200 motion-reduce:transition-none',
                'hover:bg-rose-400',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-900'
              )}
            >
              {batchEditLabel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
