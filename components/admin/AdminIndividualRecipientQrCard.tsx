'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AdminIndividualRecipientItem } from '@/lib/admin-card-types';
import {
  COMPACT_QR_WIDTH,
  downloadDataUrl,
  generateCompactQRCodeDataURL,
  individualRecipientViewQrFilename,
} from '@/lib/qr';

type AdminIndividualRecipientQrCardProps = {
  recipient: AdminIndividualRecipientItem;
  orderNumber: string;
  copiedField: string | null;
  onCopy: (text: string, field: string) => void;
};

export function AdminIndividualRecipientQrCard({
  recipient,
  orderNumber,
  copiedField,
  onCopy,
}: AdminIndividualRecipientQrCardProps) {
  const copyKey = `recipient-${recipient.recipient_number}`;
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setQrDataUrl(null);
    void generateCompactQRCodeDataURL(recipient.viewUrl).then((dataUrl) => {
      if (!cancelled) {
        setQrDataUrl(dataUrl);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [recipient.viewUrl]);

  const handleDownload = () => {
    if (!qrDataUrl) return;
    downloadDataUrl(
      qrDataUrl,
      individualRecipientViewQrFilename(orderNumber, recipient.recipient_number)
    );
  };

  const qrPreview = qrDataUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={qrDataUrl}
      alt={`View QR for ${recipient.label}`}
      width={COMPACT_QR_WIDTH}
      height={COMPACT_QR_WIDTH}
      className="h-[96px] w-[96px] rounded-md border border-stone-200 bg-white"
    />
  ) : (
    <div
      className="flex h-[96px] w-[96px] items-center justify-center rounded-md border border-stone-200 bg-stone-50"
      aria-label={`Loading QR for ${recipient.label}`}
    >
      <Loader2 className="h-4 w-4 animate-spin text-stone-400" />
    </div>
  );

  return (
    <div className="rounded-lg bg-stone-50/80 px-3 py-3 ring-1 ring-stone-100">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-stone-800">{recipient.label}</p>
              <p className="mt-0.5 text-[11px] text-stone-500">{recipient.statusLabel}</p>
            </div>
            <div className="shrink-0 sm:hidden">{qrPreview}</div>
          </div>

          <div className="mt-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
              View URL
            </p>
            <div className="flex items-center gap-1 rounded-lg bg-white/80 py-1 pl-2.5 pr-1 ring-1 ring-stone-200/70">
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left font-mono text-[11px] text-stone-600 transition-colors hover:text-stone-900"
                title={recipient.viewUrl}
                onClick={() => void onCopy(recipient.viewUrl, copyKey)}
              >
                {recipient.viewUrl}
              </button>
              <button
                type="button"
                aria-label={`Copy View URL for ${recipient.label}`}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
                onClick={() => void onCopy(recipient.viewUrl, copyKey)}
              >
                {copiedField === copyKey ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 border-stone-200 bg-white"
            disabled={!qrDataUrl}
            onClick={handleDownload}
          >
            <Download className="mr-2 h-4 w-4" />
            Download View QR
          </Button>
        </div>

        <div className="hidden shrink-0 sm:block">{qrPreview}</div>
      </div>
    </div>
  );
}

type AdminIndividualRecipientQrListProps = {
  recipients: AdminIndividualRecipientItem[];
  orderNumber: string;
  copiedField: string | null;
  onCopy: (text: string, field: string) => void;
};

export function AdminIndividualRecipientQrList({
  recipients,
  orderNumber,
  copiedField,
  onCopy,
}: AdminIndividualRecipientQrListProps) {
  return (
    <div className="space-y-3">
      {recipients.map((recipient) => (
        <AdminIndividualRecipientQrCard
          key={recipient.recipient_number}
          recipient={recipient}
          orderNumber={orderNumber}
          copiedField={copiedField}
          onCopy={onCopy}
        />
      ))}
    </div>
  );
}
