'use client';

import { formatRecipientNumber } from '@/lib/card-recipients';
import {
  getRecipientPersonalisationStatus,
  getRecipientRowSubtitle,
  type IndividualRecipientManagerItem,
} from '@/lib/individual-recipient-manager';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STATUS_LABELS = {
  published: { emoji: '✅', text: 'Published' },
  draft: { emoji: '🟡', text: 'Draft' },
  not_started: { emoji: '⚪', text: 'Not started' },
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
  const label = formatRecipientNumber(item.recipient_number);
  const uiStatus = getRecipientPersonalisationStatus(item);
  const statusMeta = STATUS_LABELS[uiStatus];
  const subtitle = getRecipientRowSubtitle(item);

  return (
    <div className="flex items-start gap-3 border-b border-stone-100 px-1 py-3 last:border-b-0">
      <Checkbox
        id={`gift-select-${item.id}`}
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={`Select ${label}`}
        className="mt-1"
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label
            htmlFor={`gift-select-${item.id}`}
            className="cursor-pointer text-sm font-semibold text-stone-800"
          >
            {label}
          </label>
          <span className="shrink-0 text-xs font-medium text-stone-600" aria-label={`Status: ${statusMeta.text}`}>
            <span aria-hidden="true">{statusMeta.emoji} </span>
            {statusMeta.text}
          </span>
        </div>
        {subtitle ? <p className="mt-0.5 text-xs text-stone-500">{subtitle}</p> : null}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={onEdit}
        aria-label={`Edit ${label}`}
      >
        Edit
      </Button>
    </div>
  );
}

export function RecipientStatusBadge({
  status,
  className,
}: {
  status: keyof typeof STATUS_LABELS;
  className?: string;
}) {
  const meta = STATUS_LABELS[status];
  return (
    <span className={cn('text-sm text-stone-700', className)}>
      <span aria-hidden="true">{meta.emoji} </span>
      {meta.text}
    </span>
  );
}
