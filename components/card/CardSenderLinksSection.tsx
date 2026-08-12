'use client';

import { Link2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { SenderLinkFormInputs } from '@/lib/sender-links';

type CardSenderLinksSectionProps = {
  enabled: boolean;
  links: SenderLinkFormInputs;
  onEnabledChange: (enabled: boolean) => void;
  onLinksChange: (links: SenderLinkFormInputs) => void;
  mixed?: boolean;
  idPrefix?: string;
};

export function CardSenderLinksSection({
  enabled,
  links,
  onEnabledChange,
  onLinksChange,
  mixed = false,
  idPrefix = '',
}: CardSenderLinksSectionProps) {
  const enabledId = `${idPrefix}show_sender_links`;
  const field = (name: keyof SenderLinkFormInputs) => `${idPrefix}${name}`;

  return (
    <div className="overflow-hidden rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 via-sky-50/40 to-white shadow-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-600 ring-1 ring-sky-200/60">
            <Link2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <Label htmlFor={enabledId} className="text-sm font-semibold text-sky-950">
              Share your links
            </Label>
            <p className="text-xs text-sky-800/65">Social icons below your message</p>
          </div>
        </div>
        <Switch
          id={enabledId}
          checked={enabled}
          onCheckedChange={onEnabledChange}
          className="shrink-0 data-[state=checked]:bg-sky-500"
        />
      </div>

      {mixed ? (
        <p className="border-t border-sky-100 px-4 py-2 text-xs text-amber-700">
          Selected gifts currently have different link settings.
        </p>
      ) : null}

      {enabled && (
        <div className="space-y-3 border-t border-sky-100 bg-white/70 px-4 py-4">
          <div className="space-y-2">
            <Label htmlFor={field('whatsapp')} className="text-stone-700">WhatsApp</Label>
            <Input
              id={field('whatsapp')}
              value={links.whatsapp}
              onChange={(event) => onLinksChange({ ...links, whatsapp: event.target.value })}
              placeholder="e.g. 6591234567"
              className="border-sky-100 bg-white focus-visible:ring-sky-300"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={field('instagram')} className="text-stone-700">Instagram</Label>
            <Input
              id={field('instagram')}
              value={links.instagram}
              onChange={(event) => onLinksChange({ ...links, instagram: event.target.value })}
              placeholder="e.g. @username"
              className="border-sky-100 bg-white focus-visible:ring-sky-300"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={field('linkedin')} className="text-stone-700">LinkedIn</Label>
            <Input
              id={field('linkedin')}
              value={links.linkedin}
              onChange={(event) => onLinksChange({ ...links, linkedin: event.target.value })}
              placeholder="https://linkedin.com/in/username"
              className="border-sky-100 bg-white focus-visible:ring-sky-300"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={field('tiktok')} className="text-stone-700">TikTok</Label>
            <Input
              id={field('tiktok')}
              value={links.tiktok}
              onChange={(event) => onLinksChange({ ...links, tiktok: event.target.value })}
              placeholder="e.g. @username"
              className="border-sky-100 bg-white focus-visible:ring-sky-300"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={field('website')} className="text-stone-700">Website</Label>
            <Input
              id={field('website')}
              value={links.website}
              onChange={(event) => onLinksChange({ ...links, website: event.target.value })}
              placeholder="https://example.com"
              className="border-sky-100 bg-white focus-visible:ring-sky-300"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={field('email')} className="text-stone-700">Email</Label>
            <Input
              id={field('email')}
              type="email"
              value={links.email}
              onChange={(event) => onLinksChange({ ...links, email: event.target.value })}
              placeholder="hello@example.com"
              className="border-sky-100 bg-white focus-visible:ring-sky-300"
            />
          </div>
        </div>
      )}
    </div>
  );
}
