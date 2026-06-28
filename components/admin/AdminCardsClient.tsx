'use client';

import { useState, useCallback, useEffect } from 'react';
import { createCard, deleteCard, getCards } from '@/lib/actions';
import { generateQRCodeDataURL } from '@/lib/qr';
import { copyToClipboard } from '@/lib/copy';
import { CardWithOrder } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Gift, Copy, Eye, QrCode, Loader2, Plus, Check, Trash2 } from 'lucide-react';
import { AdminLogoutButton } from '@/components/admin/AdminLogoutButton';
import { getConfiguredSiteOrigin } from '@/lib/site-origin';

interface AdminCardsClientProps {
  initialCards: CardWithOrder[];
  initialError: string | null;
}

export function AdminCardsClient({ initialCards, initialError }: AdminCardsClientProps) {
  const [cards, setCards] = useState<CardWithOrder[]>(initialCards);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardWithOrder | null>(null);
  const [editQrCode, setEditQrCode] = useState('');
  const [recipientQrCode, setRecipientQrCode] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [origin, setOrigin] = useState(getConfiguredSiteOrigin);
  const [cardToDelete, setCardToDelete] = useState<CardWithOrder | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    order_number: '',
  });

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (initialError) {
      toast.error('Failed to load cards: ' + initialError);
    }
  }, [initialError]);

  useEffect(() => {
    if (!selectedCard) {
      setEditQrCode('');
      setRecipientQrCode('');
      return;
    }

    let cancelled = false;
    setEditQrCode('');
    setRecipientQrCode('');

    const loadQRCodes = async () => {
      const siteOrigin = origin || window.location.origin;
      const editUrl = `${siteOrigin}/e/${selectedCard.edit_token}`;
      const recipientUrl = `${siteOrigin}/g/${selectedCard.public_token}`;
      const [editQr, recipientQr] = await Promise.all([
        generateQRCodeDataURL(editUrl),
        generateQRCodeDataURL(recipientUrl),
      ]);

      if (!cancelled) {
        setEditQrCode(editQr);
        setRecipientQrCode(recipientQr);
      }
    };

    void loadQRCodes();

    return () => {
      cancelled = true;
    };
  }, [selectedCard, origin]);

  const loadCards = useCallback(async () => {
    setLoading(true);
    try {
      const { cards: data, error } = await getCards();
      if (error) {
        toast.error('Failed to load cards: ' + error);
      } else {
        setCards(data || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.order_number) {
      toast.error('Please enter an order number');
      return;
    }
    setCreating(true);
    const { card, error } = await createCard({ order_number: form.order_number });
    if (error || !card) {
      toast.error('Failed to create card: ' + (error || 'Unknown error'));
      setCreating(false);
      return;
    }
    setForm({ order_number: '' });
    setShowCreateForm(false);
    await loadCards();
    setSelectedCard(card);
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

  const openCardDetails = (card: CardWithOrder) => {
    setSelectedCard(card);
  };

  const handleDelete = async () => {
    if (!cardToDelete) return;

    setDeleting(true);
    const { success, error } = await deleteCard(cardToDelete.id);
    if (!success) {
      toast.error('Failed to delete card: ' + (error || 'Unknown error'));
      setDeleting(false);
      return;
    }

    if (selectedCard?.id === cardToDelete.id) {
      setSelectedCard(null);
    }

    setCards((current) => current.filter((card) => card.id !== cardToDelete.id));
    setCardToDelete(null);
    setDeleting(false);
    toast.success('Card deleted');
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
          <div className="flex items-center gap-2">
            <AdminLogoutButton />
            <Button onClick={() => setShowCreateForm(true)} size="sm" className="bg-rose-500 hover:bg-rose-600">
              <Plus className="mr-1 h-4 w-4" />
              New Card
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {showCreateForm && (
          <Card className="mb-8 border-stone-200">
            <CardHeader>
              <CardTitle className="text-base text-stone-800">Create New Digital Card</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="order_number">Order Number</Label>
                  <Input
                    id="order_number"
                    value={form.order_number}
                    onChange={(e) => setForm({ order_number: e.target.value })}
                    placeholder="e.g. HM-2024-001"
                    required
                  />
                </div>
                <div className="flex gap-2">
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
                const editUrl = `${origin}/e/${card.edit_token}`;
                const recipientUrl = `${origin}/g/${card.public_token}`;
                return (
                  <Card key={card.id} className="border-stone-200 transition-shadow hover:shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-stone-800">{card.order.order_number}</p>
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
                      <div className="mt-3 flex flex-wrap gap-2">
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
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => setCardToDelete(card)}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Delete
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

      <Dialog
        open={!!selectedCard}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedCard(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Card Details</DialogTitle>
          </DialogHeader>
          {selectedCard && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-stone-800">{selectedCard.order.order_number}</p>
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
                      value={`${origin}/e/${selectedCard.edit_token}`}
                      className="h-8 text-xs"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() =>
                        handleCopy(
                          `${origin}/e/${selectedCard.edit_token}`,
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
                      value={`${origin}/g/${selectedCard.public_token}`}
                      className="h-8 text-xs"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() =>
                        handleCopy(
                          `${origin}/g/${selectedCard.public_token}`,
                          'detail-recipient'
                        )
                      }
                    >
                      {copiedField === 'detail-recipient' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col items-center">
                  {editQrCode ? (
                    <img
                      src={editQrCode}
                      alt="Buyer edit QR code"
                      className="h-36 w-36 rounded-lg border border-stone-200"
                    />
                  ) : (
                    <div className="flex h-36 w-36 items-center justify-center rounded-lg border border-stone-200 bg-stone-50">
                      <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
                    </div>
                  )}
                  <p className="mt-2 text-center text-xs text-stone-500">Scan for buyer edit page</p>
                </div>
                <div className="flex flex-col items-center">
                  {recipientQrCode ? (
                    <img
                      src={recipientQrCode}
                      alt="Recipient view QR code"
                      className="h-36 w-36 rounded-lg border border-stone-200"
                    />
                  ) : (
                    <div className="flex h-36 w-36 items-center justify-center rounded-lg border border-stone-200 bg-stone-50">
                      <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
                    </div>
                  )}
                  <p className="mt-2 text-center text-xs text-stone-500">Scan for recipient view</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-rose-500 hover:bg-rose-600"
                  onClick={() =>
                    window.open(`${origin}/e/${selectedCard.edit_token}`, '_blank')
                  }
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Open Edit Page
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() =>
                    window.open(`${origin}/g/${selectedCard.public_token}`, '_blank')
                  }
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Preview Recipient
                </Button>
              </div>

              <Button
                variant="outline"
                className="w-full text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => setCardToDelete(selectedCard)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Card
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!cardToDelete}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setCardToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this card?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete order{' '}
              <span className="font-medium text-stone-700">{cardToDelete?.order.order_number}</span>{' '}
              and its digital card. The edit and recipient links will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
