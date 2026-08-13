'use client';

import { Link2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { SenderLinkFormInputs } from '@/lib/sender-links';

type CardSenderLinksSectionProps = {
  enabled: boolean;
  links: SenderLinkFormInputs;
  onEnabledChange: (enabled: boolean) => void;
  onLinksChange: (links: SenderLinkFormInputs) => void;
  mixed?: boolean;
  idPrefix?: string;
  className?: string;
};

export function CardSenderLinksSection({
  enabled,
  links,
  onEnabledChange,
  onLinksChange,
  mixed = false,
  idPrefix = '',
  className,
}: CardSenderLinksSectionProps) {
  const enabledId = `${idPrefix}show_sender_links`;
  const field = (name: keyof SenderLinkFormInputs) => `${idPrefix}${name}`;

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
            <Link2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <Label htmlFor={enabledId} className="text-sm font-semibold text-stone-900">
              Share your links
            </Label>
            <p className="text-xs text-stone-500">Show social or web links below your message.</p>
          </div>
        </div>
        <Switch
          id={enabledId}
          checked={enabled}
          onCheckedChange={onEnabledChange}
          className="shrink-0 data-[state=checked]:bg-rose-500"
        />
      </div>

      {mixed ? (
        <p className="border-t border-stone-100 px-4 py-2 text-xs text-amber-700 sm:px-5">
          Selected gifts currently have different link settings.
        </p>
      ) : null}

      {enabled ? (
        <div className="space-y-3 border-t border-stone-100 bg-stone-50/40 px-4 py-4 sm:px-5">
          {(
            [
              ['whatsapp', 'WhatsApp', 'e.g. 6591234567'],
              ['instagram', 'Instagram', 'e.g. @username'],
              ['linkedin', 'LinkedIn', 'https://linkedin.com/in/username'],
              ['tiktok', 'TikTok', 'e.g. @username'],
              ['website', 'Website', 'https://example.com'],
              ['email', 'Email', 'hello@example.com'],
            ] as const
          ).map(([name, label, placeholder]) => (
            <div key={name} className="space-y-2">
              <Label htmlFor={field(name)} className="text-stone-700">
                {label}
              </Label>
              <Input
                id={field(name)}
                type={name === 'email' ? 'email' : 'text'}
                value={links[name]}
                onChange={(event) => onLinksChange({ ...links, [name]: event.target.value })}
                placeholder={placeholder}
                className="border-stone-200 bg-white focus-visible:ring-rose-400/30"
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
