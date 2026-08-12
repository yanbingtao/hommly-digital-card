'use client';

import { useState, useEffect, useCallback } from 'react';
import { CardWithOrder, Theme } from '@/lib/types';
import { createBrowserSupabase } from '@/lib/supabase-browser';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Loader2, Send, Eye, Sparkles, CalendarClock } from 'lucide-react';
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
import { CardPhotoUpload } from '@/components/card/CardPhotoUpload';
import { CardMessageField } from '@/components/card/CardMessageField';
import { CardThemePicker } from '@/components/card/CardThemePicker';
import { CardSenderLinksSection } from '@/components/card/CardSenderLinksSection';
import { CardViewPinSection } from '@/components/card/CardViewPinSection';
import { hasCardPhoto } from '@/lib/card-photo';

export function SharedCardEditor({ editToken }: { editToken: string }) {
  const [card, setCard] = useState<CardWithOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const [form, setForm] = useState({
    message: '',
    theme: 'thank_you' as Theme,
    add_photo: false,
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
        add_photo: hasCardPhoto(loaded),
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
  const cardExpired = Boolean(card && isCardExpired(card));

  const handleCardPhotoUpdated = (updates: Partial<CardWithOrder>) => {
    setCard((current) => (current ? { ...current, ...updates } : current));
  };

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
        add_photo: hasCardPhoto(data as CardWithOrder),
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

            <CardMessageField
              value={form.message}
              onChange={(message) => setForm({ ...form, message })}
            />

            <CardThemePicker
              value={form.theme}
              onChange={(theme) => setForm({ ...form, theme })}
            />

            <div className="space-y-1 pt-1">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Optional</p>
              <p className="text-sm text-stone-600">Add extras only if you want them.</p>
            </div>

            <CardPhotoUpload
              editToken={editToken}
              card={card}
              enabled={form.add_photo}
              onEnabledChange={(checked) => setForm({ ...form, add_photo: checked })}
              disabled={cardExpired}
              onCardUpdated={handleCardPhotoUpdated}
            />

            <CardSenderLinksSection
              enabled={form.show_sender_links}
              links={form.sender_links}
              onEnabledChange={(show_sender_links) => setForm({ ...form, show_sender_links })}
              onLinksChange={(sender_links) => setForm({ ...form, sender_links })}
            />

            <CardViewPinSection
              enabled={form.view_pin_enabled}
              pin={form.view_pin}
              pinIsSet={form.view_pin_is_set}
              onEnabledChange={(view_pin_enabled) =>
                setForm({
                  ...form,
                  view_pin_enabled,
                  view_pin: view_pin_enabled ? form.view_pin : '',
                })
              }
              onPinChange={(view_pin) => setForm({ ...form, view_pin })}
            />

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
