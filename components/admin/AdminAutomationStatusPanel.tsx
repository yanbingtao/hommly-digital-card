import {
  formatAutomationSyncStatusDetail,
  formatAutomationSyncStatusLabel,
  shouldShowAdminAutomationStatus,
} from '@/lib/card-automation';
import type { CardWithOrder } from '@/lib/types';

type AdminAutomationStatusPanelProps = {
  card: CardWithOrder;
  variant?: 'details' | 'create-success';
};

export function AdminAutomationStatusPanel({
  card,
  variant = 'details',
}: AdminAutomationStatusPanelProps) {
  if (!shouldShowAdminAutomationStatus(card)) {
    return null;
  }

  const status = card.automation_sync_status ?? 'not_required';
  const statusLabel = formatAutomationSyncStatusLabel(status);
  const statusDetail = formatAutomationSyncStatusDetail(card);
  const isWaiting = status === 'pending' || status === 'failed';
  const isClaimed = status === 'claimed';

  return (
    <div
      className={
        variant === 'create-success'
          ? 'rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-3 text-sm text-stone-700'
          : 'rounded-lg border border-stone-200 bg-stone-50/80 px-3 py-3'
      }
    >
      <p className="text-sm font-medium text-stone-800">
        Automation:{' '}
        {isWaiting ? (
          <span>⏳ Waiting for Mac mini</span>
        ) : isClaimed && statusDetail ? (
          <span>{statusDetail}</span>
        ) : (
          <span>{statusLabel}</span>
        )}
      </p>

      {isWaiting ? (
        <p className="mt-1 text-xs leading-relaxed text-stone-600">
          QR print files and the Hommly-E-Card Lark card will be prepared automatically.
          Physical printing still requires <strong>Print Full Set</strong> in Lark.
        </p>
      ) : null}

      {status === 'failed' && card.automation_last_error ? (
        <p className="mt-1 text-xs text-rose-700">{card.automation_last_error}</p>
      ) : null}

      {variant === 'details' && status !== 'pending' && status !== 'failed' && !isClaimed ? (
        <p className="mt-1 text-xs text-stone-500">Status: {statusLabel}</p>
      ) : null}
    </div>
  );
}
