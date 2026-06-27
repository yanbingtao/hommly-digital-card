'use client';

import { useState, useEffect, useCallback } from 'react';
import { createCard, getCards } from '@/lib/actions';
import { generateQRCodeDataURL } from '@/lib/qr';
import { copyToClipboard } from '@/lib/copy';
import { CardWithOrder } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Gift, Copy, Eye, QrCode, Loader2, Plus, Check } from 'lucide-react';

export default function AdminCardsPage() {
  const [cards, setCards] = useState<CardWithOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardWithOrder | null>(null);
  const [qrCode, setQrCode] = useState<string>('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [form, setForm] = useState({
    order_number: '',
    buyer_name: '',
  });

  const loadCards = useCallback(async () => {
    setLoading(true);
    const { cards: data, error } = await getCards();
    if (error) {
      toast.error('Failed to load cards: ' + error);
    } else {
      setCards(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.order_number || !form.buyer_name) {
      toast.error('Please fill in order number and buyer name');
      return;
    }
    setCreating(true);
    const { card, error } = await createCard(form);
    if (error || !card) {
      toast.error('Failed to create card: ' + (error || 'Unknown error'));
      setCreating(false);
      return;
    }
    setForm({ order_number: '', buyer_name: '' });
    setShowCreateForm(false);
    await loadCards();
    setSelectedCard(card);
    const recipientUrl = `${window.location.origin}/g/${card.public_token}`;
    const qr = await generateQRCodeDataURL(recipientUrl);
    setQrCode(qr);
    setCreating(false);
    toast.success('Card created successfully!');
  };

  const handleCopy = async (text: string, field: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
      toast.success('Copied to clipboard');
    } else {
      toast.error('Failed to copy');
    }
  };

  const openCardDetails = async (card: CardWithOrder) => {
    setSelectedCard(card);
    const recipientUrl = `${window.location.origin}/g/${card.public_token}`;
    const qr = await generateQRCodeDataURL(recipientUrl);
    setQrCode(qr);
  };

  const getStatusBadge = (status: string) => {
    if (status === 'published') {
      return <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">Published</span>;
    }
    return <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">Draft</span>;
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Gift className="h-6 w-6 text-rose-500" />
            <h1 className="text-lg font-semibold text-stone-800">Hommly Admin</h1>
          </div>
          <Button onClick={() => setShowCreateForm(true)} size="sm" className="bg-rose-500 hover:bg-rose-600">
            <Plus className="mr-1 h-4 w-4" />
            New Card
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {showCreateForm && (
          <Card className="mb-8 border-stone-200">
            <CardHeader>
              <CardTitle className="text-base text-stone-800">Create New Digital Card</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="order_number">Order Number</Label>
                  <Input
                    id="order_number"
                    value={form.order_number}
                    onChange={(e) => setForm({ ...form, order_number: e.target.value })}
                    placeholder="e.g. HM-2024-001"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="buyer_name">Buyer Name</Label>
                  <Input
                    id="buyer_name"
                    value={form.buyer_name}
                    onChange={(e) => setForm({ ...form, buyer_name: e.target.value })}
                    placeholder="Full name"
                    required
                  />
                </div>
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="submit" disabled={creating} className="bg-rose-500 hover:bg-rose-600">
                    {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Create Card
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500">All Cards</h2>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
            </div>
          ) : cards.length === 0 ? (
            <div className="rounded-lg border border-dashed border-stone-300 py-12 text-center">
              <Gift className="mx-auto h-8 w-8 text-stone-300" />
              <p className="mt-2 text-sm text-stone-500">No cards yet. Create your first one above.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((card) => {
                const editUrl = typeof window !== 'undefined' ? `${window.location.origin}/e/${card.edit_token}` : '';
                const recipientUrl = typeof window !== 'undefined' ? `${window.location.origin}/g/${card.public_token}` : '';
                return (
                  <Card key={card.id} className="border-stone-200 transition-shadow hover:shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-stone-800">{card.order.order_number}</p>
                          <p className="text-xs text-stone-500">{card.order.buyer_name}</p>
                        </div>
                        {getStatusBadge(card.status)}
                      </div>
                      <Separator className="my-3" />
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            readOnly
                            value={editUrl}
                            className="h-8 text-xs"
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0"
                            onClick={() => handleCopy(editUrl, `edit-${card.id}`)}
                          >
                            {copiedField === `edit-${card.id}` ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            readOnly
                            value={recipientUrl}
                            className="h-8 text-xs"
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0"
                            onClick={() => handleCopy(recipientUrl, `recipient-${card.id}`)}
                          >
                            {copiedField === `recipient-${card.id}` ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => openCardDetails(card)}
                        >
                          <QrCode className="mr-1 h-3.5 w-3.5" />
                          QR & Links
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => window.open(editUrl, '_blank')}
                        >
                          <Eye className="mr-1 h-3.5 w-3.5" />
                          Edit Page
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Dialog open={!!selectedCard} onOpenChange={(open) => !open && setSelectedCard(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Card Details</DialogTitle>
          </DialogHeader>
          {selectedCard && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-stone-800">{selectedCard.order.order_number}</p>
                  <p className="text-xs text-stone-500">{selectedCard.order.buyer_name}</p>
                </div>
                {getStatusBadge(selectedCard.status)}
              </div>

              <Separator />

              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-stone-500">Buyer Edit Link</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      readOnly
                      value={`${typeof window !== 'undefined' ? window.location.origin : ''}/e/${selectedCard.edit_token}`}
                      className="h-8 text-xs"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() =>
                        handleCopy(
                          `${typeof window !== 'undefined' ? window.location.origin : ''}/e/${selectedCard.edit_token}`,
                          'detail-edit'
                        )
                      }
                    >
                      {copiedField === 'detail-edit' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-stone-500">Recipient QR Link</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      readOnly
                      value={`${typeof window !== 'undefined' ? window.location.origin : ''}/g/${selectedCard.public_token}`}
                      className="h-8 text-xs"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() =>
                        handleCopy(
                          `${typeof window !== 'undefined' ? window.location.origin : ''}/g/${selectedCard.public_token}`,
                          'detail-recipient'
                        )
                      }
                    >
                      {copiedField === 'detail-recipient' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>

              {qrCode && (
                <div className="flex flex-col items-center">
                  <img src={qrCode} alt="QR Code" className="h-48 w-48 rounded-lg border border-stone-200" />
                  <p className="mt-2 text-xs text-stone-500">Scan to open recipient view</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-rose-500 hover:bg-rose-600"
                  onClick={() =>
                    window.open(`${typeof window !== 'undefined' ? window.location.origin : ''}/e/${selectedCard.edit_token}`, '_blank')
                  }
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Open Edit Page
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() =>
                    window.open(`${typeof window !== 'undefined' ? window.location.origin : ''}/g/${selectedCard.public_token}`, '_blank')
                  }
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Preview Recipient
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
