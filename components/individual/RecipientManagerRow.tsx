'use client';

import { Check } from 'lucide-react';
import {
  formatBuyerFacingGiftBadge,
  formatBuyerFacingGiftTitle,
  getBuyerFacingRecipientStatus,
  getRecipientRowActionLabel,
  getRecipientRowSubtitle,
  type IndividualRecipientManagerItem,
} from '@/lib/individual-recipient-manager';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

const BUYER_STATUS_LABELS = {
  published: { text: 'Ready' },
  not_started: { text: 'To personalise' },
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
  const isReady = uiStatus === 'published';
  const statusMeta = BUYER_STATUS_LABELS[uiStatus];
  const subtitle = getRecipientRowSubtitle(item);
  const actionLabel = getRecipientRowActionLabel(item);
  const checkboxId = `gift-select-${item.id}`;

  return (
    <div
      className={cn(
        'group flex items-center gap-3 px-3 py-4 transition-colors duration-200 motion-reduce:transition-none sm:gap-4 sm:px-5 sm:py-5',
        checked
          ? 'bg-rose-50/70'
          : 'bg-transparent hover:bg-stone-50/80'
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
          'focus-visible:ring-rose-400/40'
        )}
      />

      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-medium tabular-nums transition-colors duration-200 motion-reduce:transition-none',
          isReady
            ? 'bg-rose-100/80 text-rose-700'
            : 'bg-stone-100 text-stone-600'
        )}
        aria-hidden="true"
      >
        {isReady ? <Check className="h-4 w-4 stroke-[2.5]" /> : badge}
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

      <button
        type="button"
        onClick={onEdit}
        aria-label={`${actionLabel.replace(' →', '')} ${title}`}
        className={cn(
          'inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg px-2 text-sm font-medium text-rose-600',
          'transition-colors duration-200 motion-reduce:transition-none',
          'hover:bg-rose-50 hover:text-rose-700',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 focus-visible:ring-offset-2'
        )}
      >
        {actionLabel}
      </button>
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
