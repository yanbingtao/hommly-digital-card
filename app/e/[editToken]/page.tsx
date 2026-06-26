'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { getCardByEditToken, updateCard, publishCard } from '@/lib/actions';
import { CardWithOrder, Theme } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Loader2, Save, Send, Eye, ImageIcon, Heart, Sparkles, PartyPopper, CloudRain } from 'lucide-react';

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
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [form, setForm] = useState({
    recipient_name: '',
    sender_name: '',
    message: '',
    photo_url: '',
    theme: 'thank_you' as Theme,
  });

  const loadCard = useCallback(async () => {
    setLoading(true);
    const { card: data, error } = await getCardByEditToken(editToken);
    if (error || !data) {
      toast.error('Card not found or invalid link');
      setLoading(false);
      return;
    }
    setCard(data);
    setForm({
      recipient_name: data.recipient_name || '',
      sender_name: data.sender_name || '',
      message: data.message || '',
      photo_url: data.photo_url || '',
      theme: (data.theme as Theme) || 'thank_you',
    });
    setLoading(false);
  }, [editToken]);

  useEffect(() => {
    loadCard();
  }, [loadCard]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await updateCard(editToken, {
      recipient_name: form.recipient_name,
      sender_name: form.sender_name,
      message: form.message,
      photo_url: form.photo_url,
      theme: form.theme,
    });
    if (error) {
      toast.error('Failed to save: ' + error);
    } else {
      toast.success('Draft saved');
      await loadCard();
    }
    setSaving(false);
  };

  const handlePublish = async () => {
    if (!form.recipient_name || !form.sender_name || !form.message) {
      toast.error('Please fill in recipient name, sender name, and message before publishing');
      return;
    }
    setPublishing(true);
    const { error: updateError } = await updateCard(editToken, {
      recipient_name: form.recipient_name,
      sender_name: form.sender_name,
      message: form.message,
      photo_url: form.photo_url,
      theme: form.theme,
    });
    if (updateError) {
      toast.error('Failed to save: ' + updateError);
      setPublishing(false);
      return;
    }
    const { error: publishError } = await publishCard(editToken);
    if (publishError) {
      toast.error('Failed to publish: ' + publishError);
    } else {
      toast.success('Card published! The recipient can now view it.');
      await loadCard();
    }
    setPublishing(false);
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
              <Label htmlFor="recipient_name">Recipient Name</Label>
              <Input
                id="recipient_name"
                value={form.recipient_name}
                onChange={(e) => setForm({ ...form, recipient_name: e.target.value })}
                placeholder="Who is this gift for?"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sender_name">Sender Name</Label>
              <Input
                id="sender_name"
                value={form.sender_name}
                onChange={(e) => setForm({ ...form, sender_name: e.target.value })}
                placeholder="Your name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Your Message</Label>
              <Textarea
                id="message"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Write something thoughtful..."
                rows={5}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="photo_url">Photo URL</Label>
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-stone-400" />
                <Input
                  id="photo_url"
                  value={form.photo_url}
                  onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
                  placeholder="https://example.com/photo.jpg"
                />
              </div>
              {form.photo_url && (
                <div className="mt-2 overflow-hidden rounded-lg border border-stone-200">
                  <img src={form.photo_url} alt="Preview" className="h-40 w-full object-cover" />
                </div>
              )}
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

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Draft
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowPreview(!showPreview)}
              >
                <Eye className="mr-2 h-4 w-4" />
                {showPreview ? 'Hide Preview' : 'Preview Card'}
              </Button>
              <Button
                className="flex-1 bg-rose-500 hover:bg-rose-600"
                onClick={handlePublish}
                disabled={publishing || card.status === 'published'}
              >
                {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {card.status === 'published' ? 'Already Published' : 'Publish Card'}
              </Button>
            </div>

            {card.status === 'published' && (
              <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                <p className="font-medium">This card is published!</p>
                <p className="mt-1 text-xs text-emerald-700">
                  The recipient can view it at:{' '}
                  <a href={recipientUrl} target="_blank" rel="noreferrer" className="underline">
                    {recipientUrl}
                  </a>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {showPreview && (
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-medium text-stone-600">Preview</h3>
            <ThemePreview form={form} />
          </div>
        )}
      </main>
    </div>
  );
}

function ThemePreview({ form }: { form: { recipient_name: string; sender_name: string; message: string; photo_url: string; theme: Theme } }) {
  if (form.theme === 'birthday') {
    return (
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-amber-100 via-orange-50 to-rose-100 p-6 text-center shadow-sm">
        <div className="mb-4 text-4xl">🎉</div>
        <h2 className="text-lg font-bold text-amber-800">Happy Birthday, {form.recipient_name || 'Friend'}!</h2>
        {form.photo_url && <img src={form.photo_url} alt="" className="mx-auto mt-4 h-48 w-full rounded-xl object-cover" />}
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-amber-900">{form.message || 'Your message will appear here...'}</p>
        <p className="mt-4 text-xs font-medium text-amber-700">With love, {form.sender_name || 'Sender'}</p>
      </div>
    );
  }

  if (form.theme === 'farewell') {
    return (
      <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-slate-100 to-stone-200 p-6 text-center shadow-sm">
        <div className="mb-4 text-4xl">💌</div>
        <h2 className="text-lg font-semibold text-slate-700">For {form.recipient_name || 'You'}</h2>
        {form.photo_url && <img src={form.photo_url} alt="" className="mx-auto mt-4 h-48 w-full rounded-xl object-cover" />}
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{form.message || 'Your message will appear here...'}</p>
        <p className="mt-4 text-xs font-medium text-slate-500">From {form.sender_name || 'Sender'}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-[#fdf6e3] p-6 text-center shadow-sm">
      <div className="mb-4 text-4xl">✨</div>
      <h2 className="text-lg font-semibold text-stone-700">Dear {form.recipient_name || 'You'}</h2>
      {form.photo_url && <img src={form.photo_url} alt="" className="mx-auto mt-4 h-48 w-full rounded-xl object-cover" />}
      <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-stone-600">{form.message || 'Your message will appear here...'}</p>
      <p className="mt-4 text-xs font-medium text-stone-500">With gratitude, {form.sender_name || 'Sender'}</p>
    </div>
  );
}
