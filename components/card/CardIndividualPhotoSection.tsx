'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageIcon, ImagePlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { compressImageBeforeUpload } from '@/lib/compress-image';
import { validateImageFile } from '@/lib/card-photo';
import { getIndividualRecipientPhotoPreview } from '@/lib/individual-recipient-editor-actions';
import type { IndividualPhotoMode } from '@/lib/individual-recipient-editor-types';
import { toast } from 'sonner';

type CardIndividualPhotoSectionProps = {
  editToken: string;
  recipientIds: string[];
  photoMode: IndividualPhotoMode | null;
  mixed: boolean;
  hasExisting: boolean;
  pendingPreviewUrl: string | null;
  pendingFileName: string | null;
  disabled?: boolean;
  onPhotoModeChange: (mode: IndividualPhotoMode) => void;
  onChoosePhoto: (file: File, previewUrl: string) => void;
  onClearPending: () => void;
};

export function CardIndividualPhotoSection({
  editToken,
  recipientIds,
  photoMode,
  mixed,
  hasExisting,
  pendingPreviewUrl,
  pendingFileName,
  disabled = false,
  onPhotoModeChange,
  onChoosePhoto,
  onClearPending,
}: CardIndividualPhotoSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [existingPreviewUrl, setExistingPreviewUrl] = useState<string | null>(null);

  const showPhotoPicker = photoMode === 'one_photo';

  const loadExistingPreview = useCallback(async () => {
    if (mixed || pendingPreviewUrl || photoMode !== 'one_photo') {
      setExistingPreviewUrl(null);
      return;
    }

    if (!hasExisting) {
      setExistingPreviewUrl(null);
      return;
    }

    setLoadingPreview(true);
    try {
      const result = await getIndividualRecipientPhotoPreview({
        edit_token: editToken,
        recipient_ids: recipientIds,
      });
      if (result.error) {
        setExistingPreviewUrl(null);
        return;
      }
      if (result.mixed) {
        setExistingPreviewUrl(null);
        return;
      }
      setExistingPreviewUrl(result.signedUrl);
    } catch {
      setExistingPreviewUrl(null);
    } finally {
      setLoadingPreview(false);
    }
  }, [editToken, recipientIds, hasExisting, mixed, pendingPreviewUrl, photoMode]);

  useEffect(() => {
    void loadExistingPreview();
  }, [loadExistingPreview]);

  const previewUrl = pendingPreviewUrl ?? existingPreviewUrl;

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || disabled) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    try {
      const compressed = await compressImageBeforeUpload(file);
      const previewObjectUrl = URL.createObjectURL(compressed.blob);
      onChoosePhoto(
        new File([compressed.blob], compressed.fileName, { type: compressed.mimeType }),
        previewObjectUrl
      );
    } catch {
      toast.error('Could not prepare this image. Please try another photo.');
    }
  };

  const handleModeChange = (mode: IndividualPhotoMode) => {
    if (disabled) return;
    onPhotoModeChange(mode);
    if (mode === 'none') {
      onClearPending();
      setExistingPreviewUrl(null);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50 via-rose-50/40 to-white shadow-sm">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600 ring-1 ring-rose-200/60">
          <ImageIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-rose-950">Photo for selected gifts</p>
          <p className="text-xs text-rose-800/65">Choose whether selected gifts include a photo.</p>
        </div>
      </div>

      <div className="space-y-3 border-t border-rose-100 bg-white/70 px-4 py-4">
        {mixed ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
            <p className="font-medium">Selected gifts currently have different photos.</p>
            <p className="mt-1 text-amber-800">
              Choose the final photo setting for all selected gifts before publishing.
            </p>
          </div>
        ) : null}

        <fieldset className="space-y-2" disabled={disabled}>
          <legend className="sr-only">Photo for selected gifts</legend>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-rose-100 px-3 py-2.5 hover:bg-rose-50/50">
            <input
              type="radio"
              name="individual_photo_mode"
              className="mt-0.5"
              checked={photoMode === 'none'}
              onChange={() => handleModeChange('none')}
              disabled={disabled}
            />
            <span className="text-sm text-stone-700">No photo</span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-rose-100 px-3 py-2.5 hover:bg-rose-50/50">
            <input
              type="radio"
              name="individual_photo_mode"
              className="mt-0.5"
              checked={photoMode === 'one_photo'}
              onChange={() => handleModeChange('one_photo')}
              disabled={disabled}
            />
            <span className="text-sm text-stone-700">Use one photo for all selected gifts</span>
          </label>
        </fieldset>

        {photoMode === null ? (
          <p className="text-xs text-amber-800">Select a photo option above before publishing.</p>
        ) : null}

        {showPhotoPicker ? (
          <>
            <ul className="space-y-0.5 text-[11px] text-rose-800/55">
              <li>One photo shared across selected gifts · JPG, PNG, or WebP · Max 5MB before compression</li>
            </ul>

            {loadingPreview && !previewUrl ? (
              <div className="flex min-h-[9rem] items-center justify-center rounded-xl border border-dashed border-rose-200/80 bg-rose-50/40">
                <Loader2 className="h-5 w-5 animate-spin text-rose-300" />
              </div>
            ) : previewUrl ? (
              <div className="space-y-3">
                <div className="overflow-hidden rounded-xl bg-stone-100 ring-1 ring-stone-200/70">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Gift photo preview"
                    className="mx-auto max-h-56 w-full object-contain"
                  />
                </div>
                {pendingFileName ? (
                  <p className="truncate text-xs text-stone-500">{pendingFileName}</p>
                ) : null}
              </div>
            ) : (
              <div
                className={cn(
                  'flex min-h-[9rem] flex-col items-center justify-center rounded-xl border border-dashed border-rose-200/80 bg-rose-50/40 px-4 text-center',
                  disabled && 'opacity-60'
                )}
              >
                <ImagePlus className="mb-2 h-8 w-8 text-rose-300" />
                <p className="text-sm text-stone-600">Choose a photo for all selected gifts</p>
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={disabled}
              onChange={(event) => void handleFileChange(event)}
            />

            <Button
              type="button"
              variant="outline"
              className="w-full border-rose-200 bg-white hover:bg-rose-50"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus className="mr-2 h-4 w-4" />
              {previewUrl ? 'Replace Photo' : 'Choose Photo'}
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
