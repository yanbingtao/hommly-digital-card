'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageIcon, ImagePlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  assertProcessedImageWithinLimit,
  compressImageBeforeUpload,
  PHOTO_PROCESS_FAILED_MESSAGE,
} from '@/lib/compress-image';
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
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [existingPreviewUrl, setExistingPreviewUrl] = useState<string | null>(null);
  const isSingle = recipientIds.length === 1;
  const showPhotoPicker = photoMode === 'one_photo';

  const sectionTitle = isSingle ? 'Add a photo' : 'Photo for selected gifts';
  const sectionDescription = isSingle
    ? 'Include a photo with this eCard.'
    : 'Choose whether selected gifts include a photo.';
  const onePhotoLabel = isSingle
    ? 'Add a photo'
    : 'Use one photo for all selected gifts';
  const emptyPickerCopy = isSingle
    ? 'Choose a photo for this eCard'
    : 'Choose a photo for all selected gifts';

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
    if (!file || disabled || preparingPhoto) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setPreparingPhoto(true);
    try {
      const compressed = await compressImageBeforeUpload(file);
      assertProcessedImageWithinLimit(compressed.blob.size);
      const previewObjectUrl = URL.createObjectURL(compressed.blob);
      onChoosePhoto(
        new File([compressed.blob], compressed.fileName, { type: compressed.mimeType }),
        previewObjectUrl
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message ? err.message : PHOTO_PROCESS_FAILED_MESSAGE;
      toast.error(message);
    } finally {
      setPreparingPhoto(false);
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
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
          <ImageIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-stone-900">{sectionTitle}</p>
          <p className="text-xs text-stone-500">{sectionDescription}</p>
        </div>
      </div>

      <div className="space-y-3 border-t border-stone-100 bg-stone-50/40 px-4 py-4 sm:px-5">
        {mixed ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
            <p className="font-medium">Selected gifts currently have different photos.</p>
            <p className="mt-1 text-amber-800">
              Choose the final photo setting for all selected gifts before saving.
            </p>
          </div>
        ) : null}

        <fieldset className="space-y-2" disabled={disabled}>
          <legend className="sr-only">{sectionTitle}</legend>
          <label
            className={cn(
              'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors',
              photoMode === 'none'
                ? 'border-rose-200 bg-rose-50/50'
                : 'border-stone-200 bg-white hover:bg-stone-50'
            )}
          >
            <input
              type="radio"
              name="individual_photo_mode"
              className="accent-rose-500"
              checked={photoMode === 'none'}
              onChange={() => handleModeChange('none')}
              disabled={disabled}
            />
            <span className="text-sm text-stone-700">No photo</span>
          </label>
          <label
            className={cn(
              'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors',
              photoMode === 'one_photo'
                ? 'border-rose-200 bg-rose-50/50'
                : 'border-stone-200 bg-white hover:bg-stone-50'
            )}
          >
            <input
              type="radio"
              name="individual_photo_mode"
              className="accent-rose-500"
              checked={photoMode === 'one_photo'}
              onChange={() => handleModeChange('one_photo')}
              disabled={disabled}
            />
            <span className="text-sm text-stone-700">{onePhotoLabel}</span>
          </label>
        </fieldset>

        {photoMode === null ? (
          <p className="text-xs text-amber-800">Select a photo option above before saving.</p>
        ) : null}

        {showPhotoPicker ? (
          <>
            <ul className="space-y-0.5 text-[11px] text-stone-500">
              <li>
                {isSingle
                  ? 'JPG, PNG, or WebP · Max 5MB original · optimised under 1MB'
                  : 'One photo shared across selected gifts · JPG, PNG, or WebP · Max 5MB original · optimised under 1MB'}
              </li>
            </ul>

            {preparingPhoto ? (
              <div className="flex min-h-[9rem] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-stone-200 bg-white">
                <Loader2 className="h-5 w-5 animate-spin text-stone-300" />
                <p className="text-sm text-stone-500">Preparing your photo…</p>
              </div>
            ) : loadingPreview && !previewUrl ? (
              <div className="flex min-h-[9rem] items-center justify-center rounded-xl border border-dashed border-stone-200 bg-white">
                <Loader2 className="h-5 w-5 animate-spin text-stone-300" />
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
                  'flex min-h-[9rem] flex-col items-center justify-center rounded-xl border border-dashed border-stone-200 bg-white px-4 text-center',
                  disabled && 'opacity-60'
                )}
              >
                <ImagePlus className="mb-2 h-8 w-8 text-stone-300" />
                <p className="text-sm text-stone-600">{emptyPickerCopy}</p>
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={disabled || preparingPhoto}
              onChange={(event) => void handleFileChange(event)}
            />

            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full border-stone-200 bg-white hover:bg-stone-50"
              disabled={disabled || preparingPhoto}
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus className="mr-2 h-4 w-4" />
              {previewUrl ? 'Replace photo' : 'Choose photo'}
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
