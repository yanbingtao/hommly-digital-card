'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { BrandLogo } from '@/components/BrandLogo';
import { CardMessageField } from '@/components/card/CardMessageField';
import { CardIndividualPhotoSection } from '@/components/card/CardIndividualPhotoSection';
import { CardSenderLinksSection } from '@/components/card/CardSenderLinksSection';
import { CardThemePicker } from '@/components/card/CardThemePicker';
import { CardViewPinSection } from '@/components/card/CardViewPinSection';
import { Button } from '@/components/ui/button';
import {
  loadIndividualRecipientEditor,
  publishIndividualRecipients,
} from '@/lib/individual-recipient-editor-actions';
import {
  formatSelectedRecipientsSummary,
  formHasUnsavedChanges,
  getIndividualEditorHeading,
  getIndividualPublishLabel,
  getIndividualPublishOverwriteCopy,
  isPhotoPublishReady,
  prefillToFormState,
} from '@/lib/individual-recipient-editor-prefill';
import type {
  IndividualEditorPrefillState,
  IndividualPhotoMode,
  IndividualRecipientEditorFormState,
  IndividualRecipientEditorLoadResult,
} from '@/lib/individual-recipient-editor-types';
import { buildSenderLinksFromForm } from '@/lib/sender-links';
import { cn } from '@/lib/utils';
import type { Theme } from '@/lib/types';

type IndividualRecipientEditorProps = {
  editToken: string;
  recipientIds: string[];
  onBack: () => void;
  onPublished: () => void | Promise<void>;
};

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function IndividualRecipientEditor({
  editToken,
  recipientIds,
  onBack,
  onPublished,
}: IndividualRecipientEditorProps) {
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [loadResult, setLoadResult] = useState<IndividualRecipientEditorLoadResult | null>(null);
  const [prefill, setPrefill] = useState<IndividualEditorPrefillState | null>(null);
  const [form, setForm] = useState<IndividualRecipientEditorFormState | null>(null);
  const [initialForm, setInitialForm] = useState<IndividualRecipientEditorFormState | null>(null);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [pendingPhotoPreviewUrl, setPendingPhotoPreviewUrl] = useState<string | null>(null);
  const publishInFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadIndividualRecipientEditor({
      edit_token: editToken,
      recipient_ids: recipientIds,
    }).then((result) => {
      if (cancelled) return;
      if (result.error || !result.data) {
        toast.error(result.error ?? 'Unable to load selected gifts.');
        onBack();
        return;
      }
      const nextForm = prefillToFormState(result.data.prefill, result.data.recipients);
      setLoadResult(result.data);
      setPrefill(result.data.prefill);
      setForm(nextForm);
      setInitialForm(nextForm);
      setPendingPhotoFile(null);
      setPendingPhotoPreviewUrl(null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [editToken, recipientIds, onBack]);

  useEffect(() => {
    return () => {
      if (pendingPhotoPreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(pendingPhotoPreviewUrl);
      }
    };
  }, [pendingPhotoPreviewUrl]);

  const selectedNumbers = useMemo(
    () => loadResult?.recipients.map((row) => row.recipient_number) ?? [],
    [loadResult]
  );

  const heading = loadResult
    ? getIndividualEditorHeading(selectedNumbers, loadResult.total_recipient_count)
    : 'Edit eCard';
  const publishLabel = publishing
    ? 'Saving...'
    : loadResult
      ? getIndividualPublishLabel(selectedNumbers, loadResult.total_recipient_count)
      : 'Save eCard';
  const publishOverwriteCopy = loadResult
    ? getIndividualPublishOverwriteCopy(selectedNumbers, loadResult.total_recipient_count)
    : '';
  const selectedSummary = formatSelectedRecipientsSummary(selectedNumbers);
  const isSingle = selectedNumbers.length === 1;

  const handleBack = () => {
    if (form && initialForm && (formHasUnsavedChanges(form, initialForm) || pendingPhotoFile)) {
      const confirmed = window.confirm('You have unsaved changes. Leave this editor?');
      if (!confirmed) return;
    }
    onBack();
  };

  const handleChoosePhoto = (file: File, previewUrl: string) => {
    if (pendingPhotoPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(pendingPhotoPreviewUrl);
    }
    setPendingPhotoFile(file);
    setPendingPhotoPreviewUrl(previewUrl);
    setForm((current) =>
      current
        ? {
            ...current,
            photo_mode: 'one_photo',
          }
        : current
    );
  };

  const handleClearPending = () => {
    setPendingPhotoFile(null);
    if (pendingPhotoPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(pendingPhotoPreviewUrl);
    }
    setPendingPhotoPreviewUrl(null);
  };

  const handlePhotoModeChange = (photo_mode: IndividualPhotoMode) => {
    setForm((current) => (current ? { ...current, photo_mode } : current));
  };

  const handlePublish = async () => {
    if (!form || !loadResult || publishing || publishInFlightRef.current) return;
    if (!form.message.trim()) {
      toast.error('Please write your message before saving.');
      return;
    }

    const senderLinks = form.show_sender_links ? buildSenderLinksFromForm(form.sender_links) : null;
    if (form.show_sender_links && (!senderLinks || Object.keys(senderLinks).length === 0)) {
      toast.error('Please add at least one valid link, or turn off “Share your links”.');
      return;
    }

    if (!isPhotoPublishReady(form) && !(form.photo_mode === 'one_photo' && pendingPhotoFile)) {
      if (form.photo_mode === null) {
        toast.error('Choose a photo setting for the selected gifts before saving.');
      } else {
        toast.error('Please choose a photo before saving.');
      }
      return;
    }

    publishInFlightRef.current = true;
    setPublishing(true);

    let photo_file_base64: string | null = null;
    const photo_enabled = form.photo_mode === 'one_photo';
    if (photo_enabled && pendingPhotoFile) {
      try {
        photo_file_base64 = await fileToBase64(pendingPhotoFile);
      } catch {
        publishInFlightRef.current = false;
        setPublishing(false);
        toast.error('Could not read the selected photo.');
        return;
      }
    }

    const result = await publishIndividualRecipients({
      edit_token: editToken,
      recipient_ids: recipientIds,
      content: {
        message: form.message,
        theme: form.theme,
        show_sender_links: form.show_sender_links,
        sender_links: form.show_sender_links ? senderLinks : null,
        view_pin_enabled: form.view_pin_enabled,
        view_pin: form.view_pin,
        photo_enabled,
        photo_file_base64,
        photo_mime_type: pendingPhotoFile?.type ?? null,
        photo_original_name: pendingPhotoFile?.name ?? null,
        photo_size_bytes: pendingPhotoFile?.size ?? null,
      },
    });

    publishInFlightRef.current = false;
    setPublishing(false);

    if (!result.ok) {
      toast.error(result.error ?? 'Saving failed. Please try again.');
      return;
    }

    toast.success(isSingle ? 'Your eCard was saved.' : 'Your selected eCards were saved.');
    await onPublished();
  };

  if (loading || !form || !prefill || !loadResult) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf8f6]">
        <Loader2 className="h-6 w-6 animate-spin text-stone-400" aria-label="Loading editor" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8f6] pb-32">
      <header className="border-b border-stone-200/70 bg-[#faf8f6]">
        <div className="mx-auto w-full max-w-[720px] px-4 py-6 sm:px-6 sm:py-8">
          <div className="mb-4 flex items-center gap-2.5">
            <BrandLogo href={null} showText={false} imageClassName="h-9 w-9" />
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-rose-600/75">
              Hommly eCards
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-[1.75rem]">
            {heading}
          </h1>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-stone-500 sm:text-base">
            Add your message and optional extras, then save your eCard when you&apos;re ready.
          </p>
          {!isSingle && selectedSummary ? (
            <p className="mt-2 text-sm text-stone-500">Selected: {selectedSummary}</p>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-[720px] px-4 py-6 sm:px-6 sm:py-8">
        <div className="space-y-8 rounded-2xl bg-white px-4 py-6 ring-1 ring-stone-200/70 sm:px-6 sm:py-8">
          {loadResult.warnings.has_mixed_content ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-medium">These gifts currently have different content.</p>
              <p className="mt-1 text-amber-800">
                Saving will update all selected gifts with the settings shown below.
              </p>
            </div>
          ) : null}

          {loadResult.warnings.recipients_with_existing_content > 0 ? (
            <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
              <p className="font-medium">
                {loadResult.warnings.recipients_with_existing_content} selected gift
                {loadResult.warnings.recipients_with_existing_content === 1 ? '' : 's'} already have
                eCard content.
              </p>
              <p className="mt-1">
                Saving will update the editable content for those selected gifts.
              </p>
            </div>
          ) : null}

          <CardMessageField
            value={form.message}
            mixed={prefill.message.kind === 'mixed'}
            onChange={(message) => setForm({ ...form, message })}
          />

          <CardThemePicker
            value={form.theme}
            mixed={prefill.theme.kind === 'mixed'}
            onChange={(theme: Theme) => setForm({ ...form, theme })}
          />

          <section className="space-y-4" aria-labelledby="optional-extras-heading">
            <div className="space-y-1">
              <h2
                id="optional-extras-heading"
                className="text-base font-semibold text-stone-900"
              >
                Optional extras
              </h2>
              <p className="text-sm text-stone-500">Add extra touches to your eCard if you like.</p>
            </div>

            <div className="space-y-3">
              <CardIndividualPhotoSection
                editToken={editToken}
                recipientIds={recipientIds}
                photoMode={form.photo_mode}
                mixed={form.photo_mixed}
                hasExisting={form.photo_has_existing}
                pendingPreviewUrl={pendingPhotoPreviewUrl}
                pendingFileName={pendingPhotoFile?.name ?? null}
                disabled={publishing}
                onPhotoModeChange={handlePhotoModeChange}
                onChoosePhoto={handleChoosePhoto}
                onClearPending={handleClearPending}
              />

              <CardSenderLinksSection
                idPrefix="individual-"
                enabled={form.show_sender_links}
                links={form.sender_links}
                mixed={
                  prefill.show_sender_links.kind === 'mixed' || prefill.sender_links.kind === 'mixed'
                }
                onEnabledChange={(show_sender_links) => setForm({ ...form, show_sender_links })}
                onLinksChange={(sender_links) => setForm({ ...form, sender_links })}
              />

              <CardViewPinSection
                idPrefix="individual-"
                enabled={form.view_pin_enabled}
                pin={form.view_pin}
                pinIsSet={form.view_pin_is_set}
                mixed={prefill.view_pin_enabled.kind === 'mixed'}
                onEnabledChange={(view_pin_enabled) =>
                  setForm({
                    ...form,
                    view_pin_enabled,
                    view_pin: view_pin_enabled ? form.view_pin : '',
                  })
                }
                onPinChange={(view_pin) => setForm({ ...form, view_pin })}
              />
            </div>
          </section>
        </div>
      </main>

      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-20 border-t border-stone-200/80 bg-[#faf8f6]/95 px-4 pt-3',
          'pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm'
        )}
      >
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-3">
          <p className="text-center text-sm text-stone-500 sm:text-left">{publishOverwriteCopy}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 justify-start px-2 text-stone-600 hover:bg-stone-100 hover:text-stone-900 sm:w-auto"
              onClick={handleBack}
              disabled={publishing}
            >
              ← Back to gifts
            </Button>
            <Button
              type="button"
              className="min-h-11 bg-rose-500 px-6 font-semibold hover:bg-rose-600 sm:min-w-[10rem]"
              onClick={() => void handlePublish()}
              disabled={publishing}
              aria-label={publishLabel}
            >
              {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {publishLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
