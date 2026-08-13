'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageIcon, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  assertProcessedImageWithinLimit,
  compressImageBeforeUpload,
  PHOTO_PROCESS_FAILED_MESSAGE,
} from '@/lib/compress-image';
import { hasCardPhoto, validateImageFile } from '@/lib/card-photo';
import { CardWithOrder } from '@/lib/types';
import { cn } from '@/lib/utils';

interface CardPhotoUploadProps {
  editToken: string;
  card: CardWithOrder;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  disabled?: boolean;
  onCardUpdated: (updates: Partial<CardWithOrder>) => void;
}

export function CardPhotoUpload({
  editToken,
  card,
  enabled,
  onEnabledChange,
  disabled = false,
  onCardUpdated,
}: CardPhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const loadPreview = useCallback(async () => {
    if (!hasCardPhoto(card)) {
      setPreviewUrl(null);
      return;
    }

    try {
      const response = await fetch('/api/cards/edit-photo-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edit_token: editToken }),
      });
      const data = (await response.json()) as { signedUrl?: string | null; error?: string };
      if (!response.ok) {
        setPreviewUrl(null);
        return;
      }
      setPreviewUrl(data.signedUrl ?? null);
    } catch {
      setPreviewUrl(null);
    }
  }, [card, editToken]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || disabled) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setPreparingPhoto(true);
    try {
      const compressed = await compressImageBeforeUpload(file);
      assertProcessedImageWithinLimit(compressed.blob.size);
      setPreparingPhoto(false);
      setUploading(true);

      const formData = new FormData();
      formData.append('edit_token', editToken);
      formData.append(
        'file',
        new File([compressed.blob], compressed.fileName, { type: compressed.mimeType })
      );

      const response = await fetch('/api/cards/upload-photo', {
        method: 'POST',
        body: formData,
      });
      const data = (await response.json()) as {
        error?: string;
        previewUrl?: string | null;
        card?: Partial<CardWithOrder>;
      };

      if (!response.ok) {
        toast.error(data.error ?? 'Failed to upload photo');
        return;
      }

      if (data.card) {
        onCardUpdated(data.card);
      }
      setPreviewUrl(data.previewUrl ?? null);
      toast.success('Photo uploaded');
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message ? err.message : PHOTO_PROCESS_FAILED_MESSAGE;
      toast.error(message);
    } finally {
      setPreparingPhoto(false);
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (disabled || !hasCardPhoto(card)) return;

    setRemoving(true);
    try {
      const response = await fetch('/api/cards/remove-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edit_token: editToken }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        toast.error(data.error ?? 'Failed to remove photo');
        return;
      }

      onCardUpdated({
        photo_path: null,
        photo_original_name: null,
        photo_mime_type: null,
        photo_size_bytes: null,
        photo_uploaded_at: null,
      });
      setPreviewUrl(null);
      toast.success('Photo removed');
    } catch {
      toast.error('Failed to remove photo');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50 via-rose-50/40 to-white shadow-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600 ring-1 ring-rose-200/60">
            <ImageIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <Label htmlFor="add_photo" className="text-sm font-semibold text-rose-950">
              Add a photo
            </Label>
            <p className="text-xs text-rose-800/65">One personal image on your card</p>
          </div>
        </div>
        <Switch
          id="add_photo"
          checked={enabled}
          onCheckedChange={onEnabledChange}
          disabled={disabled}
          className="shrink-0 data-[state=checked]:bg-rose-500"
        />
      </div>

      {enabled && (
      <div className="space-y-3 border-t border-rose-100 bg-white/70 px-4 py-4">
        <ul className="space-y-0.5 text-[11px] text-rose-800/55">
          <li>One photo only · JPG, PNG, or WebP · Max 5MB original · optimised under 1MB</li>
        </ul>
        {preparingPhoto ? (
          <div className="flex min-h-[9rem] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-rose-200/80 bg-rose-50/40">
            <Loader2 className="h-5 w-5 animate-spin text-rose-300" />
            <p className="text-sm text-stone-600">Preparing your photo…</p>
          </div>
        ) : previewUrl ? (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-xl bg-stone-100 ring-1 ring-stone-200/70">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Card photo preview"
                className="mx-auto max-h-56 w-full object-contain"
              />
            </div>
            {card.photo_original_name && (
              <p className="truncate text-xs text-stone-500">{card.photo_original_name}</p>
            )}
          </div>
        ) : (
          <div
            className={cn(
              'flex min-h-[9rem] flex-col items-center justify-center rounded-xl border border-dashed border-rose-200/80 bg-rose-50/40 px-4 text-center',
              disabled && 'opacity-60'
            )}
          >
            <ImagePlus className="mb-2 h-8 w-8 text-rose-300" />
            <p className="text-sm text-stone-600">No photo yet</p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={disabled || uploading || preparingPhoto || removing}
          onChange={(event) => void handleFileChange(event)}
        />

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="flex-1 border-rose-200 bg-white hover:bg-rose-50"
            disabled={disabled || uploading || preparingPhoto || removing}
            onClick={() => inputRef.current?.click()}
          >
            {uploading || preparingPhoto ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="mr-2 h-4 w-4" />
            )}
            {hasCardPhoto(card) ? 'Replace photo' : 'Upload photo'}
          </Button>
          {hasCardPhoto(card) && (
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-stone-200 text-stone-600 hover:bg-stone-50"
              disabled={disabled || uploading || preparingPhoto || removing}
              onClick={() => void handleRemove()}
            >
              {removing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Remove photo
            </Button>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
