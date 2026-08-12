'use client';

import { Label } from '@/components/ui/label';
import { CARD_EDITOR_THEMES } from '@/lib/card-editor-themes';
import type { Theme } from '@/lib/types';

type CardThemePickerProps = {
  value: Theme;
  onChange: (theme: Theme) => void;
  mixed?: boolean;
};

export function CardThemePicker({ value, onChange, mixed = false }: CardThemePickerProps) {
  return (
    <div className="space-y-2">
      <Label>Theme</Label>
      {mixed ? (
        <p className="text-xs text-amber-700">Selected gifts currently have different themes.</p>
      ) : null}
      <div className="grid grid-cols-3 gap-2">
        {CARD_EDITOR_THEMES.map((theme) => (
          <button
            key={theme.id}
            type="button"
            onClick={() => onChange(theme.id)}
            className={`rounded-lg border px-3 py-3 text-left transition-all ${
              value === theme.id
                ? 'border-rose-300 bg-rose-50 ring-1 ring-rose-300'
                : 'border-stone-200 bg-white hover:border-stone-300'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className={value === theme.id ? 'text-rose-500' : 'text-stone-400'}>{theme.icon}</span>
              <span className="text-xs font-medium text-stone-700">{theme.label}</span>
            </div>
            <p className="mt-1 text-[10px] text-stone-500">{theme.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
