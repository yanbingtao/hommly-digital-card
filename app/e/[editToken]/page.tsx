'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { CardWithOrder, Theme } from '@/lib/types';
import { createBrowserSupabase } from '@/lib/supabase-browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Loader2, Send, Eye, Heart, Sparkles, PartyPopper, CloudRain, Lock, CalendarClock, Link2 } from 'lucide-react';
import { prepareViewPinForSave } from '@/lib/actions';
import {
  CARD_AVAILABILITY_MONTHS,
  formatCardExpiryDate,
  formatCardTimeRemaining,
  formatFirstPublishedDateTime,
  hasExpiryOverride,
  isCardExpired,
} from '@/lib/card-expiry';
import {
  buildSenderLinksFromForm,
  EMPTY_SENDER_LINK_FORM,
  parseSenderLinksFromDb,
  senderLinksToFormInputs,
  type SenderLinkFormInputs,
} from '@/lib/sender-links';

const THEMES: { id: Theme; label: string; icon: React.ReactNode; description: string }[] = [
  {
    id: 'thank_you',
    label: 'Thank You',
    icon: <Heart className="h-4 w-4" />,
    description: 'Warm, gentle, and heartfelt',
  },
  {
    id: 'birthday',
    label: 'Birthday',
    icon: <PartyPopper className="h-4 w-4" />,
    description: 'Cheerful and celebratory',
  },
  {
    id: 'farewell',
    label: 'Farewell',
    icon: <CloudRain className="h-4 w-4" />,
    description: 'Soft, emotional, and warm',
  },
];

export default function EditCardPage() {
  const params = useParams();
  const editToken = params.editToken as string;

  const [card, setCard] = useState<CardWithOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const [form, setForm] = useState({
    message: '',
    theme: 'thank_you' as Theme,
    show_sender_links: false,
    sender_links: { ...EMPTY_SENDER_LINK_FORM } as SenderLinkFormInputs,
    view_pin_enabled: false,
    view_pin: '',
    view_pin_is_set: false,
  });

  const loadCard = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createBrowserSupabase();
      const { data, error } = await supabase
        .from('digital_cards')
        .select('*, order:orders(*)')
        .eq('edit_token', editToken)
        .maybeSingle();

      if (error || !data) {
        toast.error('Card not found or invalid link');
        setCard(null);
        return;
      }

      const loaded = data as CardWithOrder;
      setCard(loaded);
      const storedLinks = parseSenderLinksFromDb(data.sender_links);
      setForm({
        message: data.message ?? '',
        theme: (data.theme as Theme) || 'thank_you',
        show_sender_links: Boolean(data.show_sender_links),
        sender_links: senderLinksToFormInputs(storedLinks),
        view_pin_enabled: Boolean(data.view_pin_enabled),
        view_pin: '',
        view_pin_is_set: Boolean(data.view_pin_hash),
      });
    } catch {
      toast.error('Failed to load card');
      setCard(null);
    } finally {
      setLoading(false);
    }
  }, [editToken]);

  useEffect(() => {
    loadCard();
  }, [loadCard]);

  const isPublished = card?.status === 'published';

  const handlePublish = async () => {
    if (card && isCardExpired(card)) {
      toast.error('This card has expired. Links are disabled until Hommly reactivates it.');
      return;
    }
    if (!form.message.trim()) {
      toast.error('Please write your message before publishing');
      return;
    }
    setPublishing(true);
    try {
      const supabase = createBrowserSupabase();
      const senderLinks = form.show_sender_links
        ? buildSenderLinksFromForm(form.sender_links)
        : null;

      if (form.show_sender_links && (!senderLinks || Object.keys(senderLinks).length === 0)) {
        toast.error('Please add at least one valid link, or turn off “Show my links on this card”.');
        setPublishing(false);
        return;
      }

      const pinResult = await prepareViewPinForSave(
        form.view_pin_enabled,
        form.view_pin,
        card?.view_pin_hash ?? null
      );
      if (pinResult.error) {
        toast.error(pinResult.error);
        setPublishing(false);
        return;
      }

      const now = new Date().toISOString();
      const publishUpdate: Record<string, unknown> = {
        message: form.message,
        theme: form.theme,
        show_sender_links: form.show_sender_links,
        sender_links: form.show_sender_links ? senderLinks : null,
        view_pin_enabled: pinResult.view_pin_enabled,
        view_pin_hash: pinResult.view_pin_hash,
        status: 'published',
        published_at: now,
        updated_at: now,
      };
      if (!card?.first_published_at) {
        publishUpdate.first_published_at = now;
      }

      const { data, error } = await supabase
        .from('digital_cards')
        .update(publishUpdate)
        .eq('edit_token', editToken)
        .select('*, order:orders(*)')
        .single();

      if (error || !data) {
        toast.error('Failed to publish: ' + (error?.message || 'Unknown error'));
        return;
      }

      setCard(data as CardWithOrder);
      const storedLinks = parseSenderLinksFromDb(data.sender_links);
      setForm({
        message: data.message ?? '',
        theme: (data.theme as Theme) || 'thank_you',
        show_sender_links: Boolean(data.show_sender_links),
        sender_links: senderLinksToFormInputs(storedLinks),
        view_pin_enabled: Boolean(data.view_pin_enabled),
        view_pin: '',
        view_pin_is_set: Boolean(data.view_pin_hash),
      });
      toast.success(
        isPublished
          ? 'Card updated! The recipient will see your latest changes.'
          : 'Card published! The recipient can now view it.'
      );
    } catch {
      toast.error('Failed to publish card');
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
      </div>
    );
  }

  if (!card) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
        <div className="text-center">
          <p className="text-lg font-medium text-stone-700">Card not found</p>
          <p className="mt-1 text-sm text-stone-500">This link may be invalid or expired.</p>
        </div>
      </div>
    );
  }

  if (isCardExpired(card)) {
    const expiredOn = formatCardExpiryDate(card);
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-400">
            <CalendarClock className="h-6 w-6" />
          </div>
          <p className="text-lg font-medium text-stone-700">This card has expired</p>
          <p className="mt-2 text-sm text-stone-500">
            The edit and viewing links are no longer active
            {expiredOn ? <> as of <span className="font-medium text-stone-600">{expiredOn}</span></> : ''}.
          </p>
          <p className="mt-3 text-sm text-stone-500">
            Please contact Hommly if you need this card reactivated.
          </p>
        </div>
      </div>
    );
  }

  const recipientUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/g/${card.public_token}`;

  const handlePreview = () => {
    window.open(recipientUrl, '_blank', 'noopener,noreferrer');
  };

  const expiryDate = formatCardExpiryDate(card);
  const firstPublishedAt = formatFirstPublishedDateTime(card);
  const timeRemaining = formatCardTimeRemaining(card);

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-rose-500" />
            <h1 className="text-base font-semibold text-stone-800">Customize Your Surprise</h1>
          </div>
          <div className="flex items-center gap-2">
            {card.status === 'published' && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                Published
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-6">
        <Card className="border-stone-200">
          <CardContent className="space-y-5 p-5">
            <div className="flex gap-3 rounded-lg border border-stone-200 bg-stone-50/60 px-3 py-3">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
              <div className="text-sm">
                <p className="font-medium text-stone-700">Link availability</p>
                {expiryDate ? (
                  <>
                    {firstPublishedAt && (
                      <p className="mt-1 text-stone-600">
                        First published{' '}
                        <span className="font-medium">{firstPublishedAt}</span>
                      </p>
                    )}
                    <p className="mt-1 text-stone-600">
                      Available until <span className="font-medium">{expiryDate}</span>
                    </p>
                    {timeRemaining && (
                      <p className="mt-0.5 text-xs text-stone-500">
                        About {timeRemaining} remaining
                        {hasExpiryOverride(card) ? ' (custom expiry)' : ''}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-1 text-stone-600">
                    After you publish, this card stays available for {CARD_AVAILABILITY_MONTHS} months.
                    Republishing does not extend the time.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Your Message</Label>
              <Textarea
                id="message"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Write something thoughtful..."
                rows={6}
              />
            </div>

            <div className="space-y-2">
              <Label>Theme</Label>
              <div className="grid grid-cols-3 gap-2">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setForm({ ...form, theme: t.id })}
                    className={`rounded-lg border px-3 py-3 text-left transition-all ${
                      form.theme === t.id
                        ? 'border-rose-300 bg-rose-50 ring-1 ring-rose-300'
                        : 'border-stone-200 bg-white hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={form.theme === t.id ? 'text-rose-500' : 'text-stone-400'}>{t.icon}</span>
                      <span className="text-xs font-medium text-stone-700">{t.label}</span>
                    </div>
                    <p className="mt-1 text-[10px] text-stone-500">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1 pt-1">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Optional</p>
              <p className="text-sm text-stone-600">Add extras only if you want them.</p>
            </div>

            <div className="overflow-hidden rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 via-sky-50/40 to-white shadow-sm">
              <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-600 ring-1 ring-sky-200/60">
                    <Link2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <Label htmlFor="show_sender_links" className="text-sm font-semibold text-sky-950">
                      Share your links
                    </Label>
                    <p className="text-xs text-sky-800/65">Social icons below your message</p>
                  </div>
                </div>
                <Switch
                  id="show_sender_links"
                  checked={form.show_sender_links}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, show_sender_links: checked })
                  }
                  className="shrink-0 data-[state=checked]:bg-sky-500"
                />
              </div>

              {form.show_sender_links && (
                <div className="space-y-3 border-t border-sky-100 bg-white/70 px-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp" className="text-stone-700">WhatsApp</Label>
                    <Input
                      id="whatsapp"
                      value={form.sender_links.whatsapp}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          sender_links: { ...form.sender_links, whatsapp: e.target.value },
                        })
                      }
                      placeholder="e.g. 6591234567"
                      className="border-sky-100 bg-white focus-visible:ring-sky-300"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="instagram" className="text-stone-700">Instagram</Label>
                    <Input
                      id="instagram"
                      value={form.sender_links.instagram}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          sender_links: { ...form.sender_links, instagram: e.target.value },
                        })
                      }
                      placeholder="e.g. @username"
                      className="border-sky-100 bg-white focus-visible:ring-sky-300"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="linkedin" className="text-stone-700">LinkedIn</Label>
                    <Input
                      id="linkedin"
                      value={form.sender_links.linkedin}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          sender_links: { ...form.sender_links, linkedin: e.target.value },
                        })
                      }
                      placeholder="https://linkedin.com/in/username"
                      className="border-sky-100 bg-white focus-visible:ring-sky-300"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tiktok" className="text-stone-700">TikTok</Label>
                    <Input
                      id="tiktok"
                      value={form.sender_links.tiktok}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          sender_links: { ...form.sender_links, tiktok: e.target.value },
                        })
                      }
                      placeholder="e.g. @username"
                      className="border-sky-100 bg-white focus-visible:ring-sky-300"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website" className="text-stone-700">Website</Label>
                    <Input
                      id="website"
                      value={form.sender_links.website}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          sender_links: { ...form.sender_links, website: e.target.value },
                        })
                      }
                      placeholder="https://example.com"
                      className="border-sky-100 bg-white focus-visible:ring-sky-300"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-stone-700">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.sender_links.email}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          sender_links: { ...form.sender_links, email: e.target.value },
                        })
                      }
                      placeholder="hello@example.com"
                      className="border-sky-100 bg-white focus-visible:ring-sky-300"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 via-violet-50/40 to-white shadow-sm">
              <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 ring-1 ring-violet-200/60">
                    <Lock className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <Label htmlFor="view_pin_enabled" className="text-sm font-semibold text-violet-950">
                      Viewing PIN
                    </Label>
                    <p className="text-xs text-violet-800/65">Recipient enters PIN before opening</p>
                  </div>
                </div>
                <Switch
                  id="view_pin_enabled"
                  checked={form.view_pin_enabled}
                  onCheckedChange={(checked) =>
                    setForm({
                      ...form,
                      view_pin_enabled: checked,
                      view_pin: checked ? form.view_pin : '',
                    })
                  }
                  className="shrink-0 data-[state=checked]:bg-violet-500"
                />
              </div>

              {form.view_pin_enabled && (
                <div className="space-y-2 border-t border-violet-100 bg-white/70 px-4 py-4">
                  <Label htmlFor="view_pin" className="text-stone-700">
                    PIN (4–6 digits)
                  </Label>
                  <Input
                    id="view_pin"
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={form.view_pin}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        view_pin: e.target.value.replace(/\D/g, ''),
                      })
                    }
                    placeholder={form.view_pin_is_set ? 'Leave blank to keep current PIN' : 'e.g. 1234'}
                    className="border-violet-100 bg-white text-center text-lg tracking-widest focus-visible:ring-violet-300"
                  />
                  {form.view_pin_is_set && !form.view_pin && (
                    <p className="text-xs text-violet-700">Current PIN is saved — enter a new one to change it.</p>
                  )}
                </div>
              )}
            </div>

            <Separator />

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handlePreview}
                disabled={!isPublished}
                title={!isPublished ? 'Publish your card first to view it' : undefined}
              >
                <Eye className="mr-2 h-4 w-4" />
                View Card
              </Button>
              <Button
                className="flex-1 bg-rose-500 hover:bg-rose-600"
                onClick={handlePublish}
                disabled={publishing}
              >
                {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {isPublished ? 'Republish Card' : 'Publish Card'}
              </Button>
            </div>

            {isPublished && (
              <div className="overflow-hidden rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                <p className="font-medium">This card is published!</p>
                <p className="mt-1 text-xs text-emerald-700">
                  You can edit and republish anytime. The recipient will see your latest version.
                </p>
                <p className="mt-2 text-xs text-emerald-700">Recipient link:</p>
                <a
                  href={recipientUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block break-all text-xs text-emerald-700 underline"
                >
                  {recipientUrl}
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
