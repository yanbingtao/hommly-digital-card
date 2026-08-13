'use client';

import {
  canViewRecipientEcard,
  formatBuyerFacingGiftBadge,
  formatBuyerFacingGiftTitle,
  getBuyerFacingRecipientStatus,
  getRecipientManagerViewUrl,
  getRecipientRowActionLabel,
  getRecipientRowSubtitle,
  getRecipientRowViewLabel,
  type IndividualRecipientManagerItem,
} from '@/lib/individual-recipient-manager';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

const BUYER_STATUS_LABELS = {
  published: { text: 'Ready' },
  not_started: { text: 'To edit' },
} as const;

type RecipientManagerRowProps = {
  item: IndividualRecipientManagerItem;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onEdit: () => void;
};

export function RecipientManagerRow({
  item,
  checked,
  onCheckedChange,
  onEdit,
}: RecipientManagerRowProps) {
  const title = formatBuyerFacingGiftTitle(item.recipient_number);
  const badge = formatBuyerFacingGiftBadge(item.recipient_number);
  const uiStatus = getBuyerFacingRecipientStatus(item);
  const statusMeta = BUYER_STATUS_LABELS[uiStatus];
  const subtitle = getRecipientRowSubtitle(item);
  const actionLabel = getRecipientRowActionLabel(item);
  const viewLabel = getRecipientRowViewLabel(item);
  const viewUrl = getRecipientManagerViewUrl(item);
  const showView = canViewRecipientEcard(item) && Boolean(viewUrl);
  const checkboxId = `gift-select-${item.id}`;

  return (
    <div
      className={cn(
        'group flex items-center gap-3 px-3 py-3.5 transition-colors duration-200 motion-reduce:transition-none sm:gap-4 sm:px-5 sm:py-4',
        checked ? 'bg-rose-50/65' : 'bg-transparent hover:bg-stone-50/80'
      )}
    >
      <Checkbox
        id={checkboxId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={`Select ${title}`}
        className={cn(
          'h-5 w-5 rounded-[5px] border-stone-300 shadow-none transition-colors duration-200 motion-reduce:transition-none',
          'data-[state=checked]:border-rose-500 data-[state=checked]:bg-rose-500 data-[state=checked]:text-white',
          'data-[state=indeterminate]:border-rose-500 data-[state=indeterminate]:bg-rose-500 data-[state=indeterminate]:text-white',
          'focus-visible:ring-rose-400/40'
        )}
      />

      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[13px] font-medium tabular-nums transition-colors duration-200 motion-reduce:transition-none sm:h-10 sm:w-10 sm:text-sm',
          checked
            ? 'bg-rose-100/90 text-rose-700'
            : 'bg-stone-100 text-stone-600'
        )}
        aria-hidden="true"
      >
        {badge}
      </div>

      <div className="min-w-0 flex-1">
        <label
          htmlFor={checkboxId}
          className="cursor-pointer text-[15px] font-semibold tracking-tight text-stone-900"
        >
          {title}
        </label>
        <p
          className="mt-0.5 text-sm text-stone-500"
          aria-label={`Status: ${statusMeta.text}`}
        >
          {subtitle}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        {showView && viewUrl ? (
          <a
            href={viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View ${title} eCard (opens in a new tab)`}
            className={cn(
              'inline-flex min-h-11 items-center justify-center rounded-lg px-2 text-sm font-medium text-stone-600',
              'transition-colors duration-200 motion-reduce:transition-none',
              'hover:bg-stone-100 hover:text-stone-800',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/40 focus-visible:ring-offset-2'
            )}
          >
            <span className="sm:hidden">View</span>
            <span className="hidden sm:inline">{viewLabel}</span>
          </a>
        ) : null}

        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit eCard for ${title}`}
          className={cn(
            'inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg px-2.5 text-sm font-medium text-rose-600',
            'transition-colors duration-200 motion-reduce:transition-none',
            'hover:bg-rose-50 hover:text-rose-700',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 focus-visible:ring-offset-2'
          )}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

export function RecipientStatusBadge({
  status,
  className,
}: {
  status: keyof typeof BUYER_STATUS_LABELS;
  className?: string;
}) {
  const meta = BUYER_STATUS_LABELS[status];
  return <span className={cn('text-sm text-stone-600', className)}>{meta.text}</span>;
}
