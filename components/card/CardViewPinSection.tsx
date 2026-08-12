'use client';

import { Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

type CardViewPinSectionProps = {
  enabled: boolean;
  pin: string;
  pinIsSet: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onPinChange: (pin: string) => void;
  mixed?: boolean;
  idPrefix?: string;
};

export function CardViewPinSection({
  enabled,
  pin,
  pinIsSet,
  onEnabledChange,
  onPinChange,
  mixed = false,
  idPrefix = '',
}: CardViewPinSectionProps) {
  const enabledId = `${idPrefix}view_pin_enabled`;
  const pinId = `${idPrefix}view_pin`;

  return (
    <div className="overflow-hidden rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 via-violet-50/40 to-white shadow-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 ring-1 ring-violet-200/60">
            <Lock className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <Label htmlFor={enabledId} className="text-sm font-semibold text-violet-950">
              Viewing PIN
            </Label>
            <p className="text-xs text-violet-800/65">Recipient enters PIN before opening</p>
          </div>
        </div>
        <Switch
          id={enabledId}
          checked={enabled}
          onCheckedChange={(checked) => {
            onEnabledChange(checked);
            if (!checked) onPinChange('');
          }}
          className="shrink-0 data-[state=checked]:bg-violet-500"
        />
      </div>

      {mixed ? (
        <p className="border-t border-violet-100 px-4 py-2 text-xs text-amber-700">
          Selected gifts currently have different PIN settings.
        </p>
      ) : null}

      {enabled && (
        <div className="space-y-2 border-t border-violet-100 bg-white/70 px-4 py-4">
          <Label htmlFor={pinId} className="text-stone-700">
            PIN (4–6 digits)
          </Label>
          <Input
            id={pinId}
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            pattern="[0-9]*"
            maxLength={6}
            value={pin}
            onChange={(event) => onPinChange(event.target.value.replace(/\D/g, ''))}
            placeholder={pinIsSet ? 'Leave blank to keep current PIN' : 'e.g. 1234'}
            className="border-violet-100 bg-white text-center text-lg tracking-widest focus-visible:ring-violet-300"
          />
          {pinIsSet && !pin ? (
            <p className="text-xs text-violet-700">Current PIN is saved — enter a new one to change it.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
