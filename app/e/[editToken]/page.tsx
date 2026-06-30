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
import { Loader2, Send, Eye, Heart, Sparkles, PartyPopper, CloudRain, Lock } from 'lucide-react';
import { prepareViewPinForSave } from '@/lib/actions';
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

      const { data, error } = await supabase
        .from('digital_cards')
        .update({
          message: form.message,
          theme: form.theme,
          show_sender_links: form.show_sender_links,
          sender_links: form.show_sender_links ? senderLinks : null,
          view_pin_enabled: pinResult.view_pin_enabled,
          view_pin_hash: pinResult.view_pin_hash,
          status: 'published',
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
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

  const recipientUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/g/${card.public_token}`;

  const handlePreview = () => {
    window.open(recipientUrl, '_blank', 'noopener,noreferrer');
  };

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

            <Separator />

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-stone-800">Share your links, optional</h3>
                <p className="mt-1 text-xs text-stone-500">
                  Add links you are comfortable sharing with the recipient.
                </p>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-lg border border-stone-200 bg-stone-50/50 px-3 py-3">
                <div>
                  <Label htmlFor="show_sender_links" className="text-sm text-stone-700">
                    Show my links on this card
                  </Label>
                  <p className="mt-1 text-xs text-stone-500">
                    These links will appear quietly below your message if you choose to share them.
                  </p>
                </div>
                <Switch
                  id="show_sender_links"
                  checked={form.show_sender_links}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, show_sender_links: checked })
                  }
                  className="data-[state=checked]:bg-rose-500"
                />
              </div>

              {form.show_sender_links && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp">WhatsApp number</Label>
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
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="instagram">Instagram username or URL</Label>
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
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="linkedin">LinkedIn URL</Label>
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
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tiktok">TikTok username or URL</Label>
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
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Website URL</Label>
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
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
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
                    />
                  </div>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-stone-800">Viewing PIN, optional</h3>
                <p className="mt-1 text-xs text-stone-500">
                  Require a PIN so only your recipient can open the message.
                </p>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-lg border border-stone-200 bg-stone-50/50 px-3 py-3">
                <div>
                  <Label htmlFor="view_pin_enabled" className="text-sm text-stone-700">
                    Require PIN to view
                  </Label>
                  <p className="mt-1 text-xs text-stone-500">
                    Your recipient will need the PIN you set before they can read your message.
                  </p>
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
                  className="data-[state=checked]:bg-rose-500"
                />
              </div>

              {form.view_pin_enabled && (
                <div className="space-y-2">
                  <Label htmlFor="view_pin" className="flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-stone-400" />
                    Viewing PIN (4–6 digits)
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
                  />
                  {form.view_pin_is_set && !form.view_pin && (
                    <p className="text-xs text-emerald-700">A PIN is already set for this card.</p>
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
              >
                <Eye className="mr-2 h-4 w-4" />
                Preview Card
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
