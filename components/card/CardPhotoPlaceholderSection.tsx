'use client';

import { ImageIcon } from 'lucide-react';

export function CardPhotoPlaceholderSection() {
  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-50/80 opacity-70">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-400">
          <ImageIcon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-stone-700">Add a photo</p>
          <p className="text-xs text-stone-500">Available in the next update</p>
        </div>
      </div>
    </div>
  );
}
