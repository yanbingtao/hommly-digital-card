'use client';

import { Label } from '@/components/ui/label';
import { CARD_EDITOR_THEMES } from '@/lib/card-editor-themes';
import { cn } from '@/lib/utils';
import type { Theme } from '@/lib/types';

type CardThemePickerProps = {
  value: Theme;
  onChange: (theme: Theme) => void;
  mixed?: boolean;
  className?: string;
};

export function CardThemePicker({
  value,
  onChange,
  mixed = false,
  className,
}: CardThemePickerProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="space-y-1">
        <Label className="text-base font-semibold text-stone-900">Theme</Label>
        <p className="text-sm text-stone-500">Choose the mood for this eCard.</p>
      </div>
      {mixed ? (
        <p className="text-xs text-amber-700">Selected gifts currently have different themes.</p>
      ) : null}
      <div
        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
        role="radiogroup"
        aria-label="eCard theme"
      >
        {CARD_EDITOR_THEMES.map((theme) => {
          const selected = value === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(theme.id)}
              className={cn(
                'rounded-xl border px-3.5 py-3.5 text-left transition-colors duration-200 motion-reduce:transition-none',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 focus-visible:ring-offset-2',
                selected
                  ? 'border-rose-300 bg-rose-50/80 ring-1 ring-rose-200'
                  : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/80'
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg',
                    selected ? 'bg-rose-100 text-rose-600' : 'bg-stone-100 text-stone-500'
                  )}
                  aria-hidden="true"
                >
                  {theme.icon}
                </span>
                <span className="text-sm font-semibold text-stone-800">{theme.label}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-stone-500">{theme.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
