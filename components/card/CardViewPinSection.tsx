'use client';

import { Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

type CardViewPinSectionProps = {
  enabled: boolean;
  pin: string;
  pinIsSet: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onPinChange: (pin: string) => void;
  mixed?: boolean;
  idPrefix?: string;
  className?: string;
};

export function CardViewPinSection({
  enabled,
  pin,
  pinIsSet,
  onEnabledChange,
  onPinChange,
  mixed = false,
  idPrefix = '',
  className,
}: CardViewPinSectionProps) {
  const enabledId = `${idPrefix}view_pin_enabled`;
  const pinId = `${idPrefix}view_pin`;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-stone-200 bg-white',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
            <Lock className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <Label htmlFor={enabledId} className="text-sm font-semibold text-stone-900">
              Viewing PIN
            </Label>
            <p className="text-xs text-stone-500">
              Require a PIN before the recipient can open this eCard.
            </p>
          </div>
        </div>
        <Switch
          id={enabledId}
          checked={enabled}
          onCheckedChange={(checked) => {
            onEnabledChange(checked);
            if (!checked) onPinChange('');
          }}
          className="shrink-0 data-[state=checked]:bg-rose-500"
        />
      </div>

      {mixed ? (
        <p className="border-t border-stone-100 px-4 py-2 text-xs text-amber-700 sm:px-5">
          Selected gifts currently have different PIN settings.
        </p>
      ) : null}

      {enabled ? (
        <div className="space-y-2 border-t border-stone-100 bg-stone-50/40 px-4 py-4 sm:px-5">
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
            className="border-stone-200 bg-white text-center text-lg tracking-widest focus-visible:ring-rose-400/30"
          />
          {pinIsSet && !pin ? (
            <p className="text-xs text-stone-500">
              Current PIN is saved — enter a new one to change it.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
