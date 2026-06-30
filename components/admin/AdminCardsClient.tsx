'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { createCard, deleteCard, getCards, reactivateCard, setCardExpiryOverride } from '@/lib/actions';
import {
  CARD_AVAILABILITY_MONTHS,
  formatCardExpiryDateTime,
  formatStoredExpiryOverride,
  getCardExpiresAt,
  hasExpiryOverride,
  isCardExpired,
  toDatetimeLocalInputValue,
} from '@/lib/card-expiry';
import { generateQRCodeDataURL, downloadDataUrl, orderQrFilename } from '@/lib/qr';
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
import { Gift, Copy, Eye, QrCode, Loader2, Plus, Check, Trash2, Search, Download, CalendarClock, RotateCcw, type LucideIcon } from 'lucide-react';
import { AdminLogoutButton } from '@/components/admin/AdminLogoutButton';
import { getConfiguredSiteOrigin } from '@/lib/site-origin';
import { cn } from '@/lib/utils';

interface AdminCardsClientProps {
  initialCards: CardWithOrder[];
  initialError: string | null;
}

function getLocalDateKey(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatSectionDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-SG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function groupCardsByDay(cards: CardWithOrder[]) {
  const sorted = [...cards].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const groups = new Map<string, CardWithOrder[]>();
  for (const card of sorted) {
    const dateKey = getLocalDateKey(card.created_at);
    const existing = groups.get(dateKey);
    if (existing) {
      existing.push(card);
    } else {
      groups.set(dateKey, [card]);
    }
  }

  return Array.from(groups.entries()).map(([dateKey, dayCards]) => ({
    dateKey,
    label: formatSectionDate(dayCards[0].created_at),
    cards: dayCards,
  }));
}

function CardLinkRow({
  label,
  url,
  copyKey,
  copied,
  onCopy,
}: {
  label: string;
  url: string;
  copyKey: string;
  copied: boolean;
  onCopy: (text: string, field: string) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400">{label}</p>
      <div className="flex items-center gap-1 rounded-lg bg-white/80 py-1 pl-2.5 pr-1 ring-1 ring-stone-200/70">
        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left font-mono text-[11px] text-stone-600 transition-colors hover:text-stone-900"
          title={url}
          onClick={() => void onCopy(url, copyKey)}
        >
          {url}
        </button>
        <button
          type="button"
          aria-label={`Copy ${label}`}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
          onClick={() => void onCopy(url, copyKey)}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

function CardQuickAction({
  label,
  icon: Icon,
  onClick,
  variant = 'default',
  indicator,
  disabled = false,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'success';
  indicator?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-center justify-center gap-1 rounded-lg py-2.5 text-[10px] font-medium transition-all active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40',
        variant === 'danger'
          ? 'text-stone-400 hover:bg-red-50 hover:text-red-600'
          : variant === 'success'
          ? 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'
          : 'text-stone-500 hover:bg-white hover:text-stone-800 hover:shadow-sm'
      )}
    >
      {indicator && (
        <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-violet-500 ring-2 ring-stone-50" />
      )}
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
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
  const [cardForExpiry, setCardForExpiry] = useState<CardWithOrder | null>(null);
  const [expiryInput, setExpiryInput] = useState('');
  const [savingExpiry, setSavingExpiry] = useState(false);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  const openExpiryDialog = (card: CardWithOrder) => {
    const effectiveExpiry = getCardExpiresAt(card);
    const initialValue = card.expires_at_override
      ? toDatetimeLocalInputValue(card.expires_at_override)
      : effectiveExpiry
      ? toDatetimeLocalInputValue(effectiveExpiry.toISOString())
      : '';
    setExpiryInput(initialValue);
    setCardForExpiry(card);
  };

  const updateCardInState = (updated: CardWithOrder) => {
    setCards((current) => current.map((card) => (card.id === updated.id ? updated : card)));
    if (selectedCard?.id === updated.id) {
      setSelectedCard(updated);
    }
    if (cardForExpiry?.id === updated.id) {
      setCardForExpiry(updated);
    }
  };

  const handleSaveExpiry = async () => {
    if (!cardForExpiry) return;
    if (!expiryInput) {
      toast.error('Please choose a validation date and time');
      return;
    }

    setSavingExpiry(true);
    const { card, error } = await setCardExpiryOverride(cardForExpiry.id, expiryInput);
    if (error || !card) {
      toast.error('Failed to save expiry: ' + (error || 'Unknown error'));
      setSavingExpiry(false);
      return;
    }

    updateCardInState(card);
    setSavingExpiry(false);
    setCardForExpiry(null);
    toast.success('Validation date updated');
  };

  const handleClearExpiryOverride = async () => {
    if (!cardForExpiry) return;

    setSavingExpiry(true);
    const { card, error } = await setCardExpiryOverride(cardForExpiry.id, null);
    if (error || !card) {
      toast.error('Failed to reset expiry: ' + (error || 'Unknown error'));
      setSavingExpiry(false);
      return;
    }

    updateCardInState(card);
    setSavingExpiry(false);
    setCardForExpiry(null);
    toast.success('Using default 6-month validation again');
  };

  const handleReactivate = async (card: CardWithOrder) => {
    setReactivatingId(card.id);
    const { card: updated, error } = await reactivateCard(card.id);
    if (error || !updated) {
      toast.error('Failed to reactivate: ' + (error || 'Unknown error'));
      setReactivatingId(null);
      return;
    }

    updateCardInState(updated);
    setReactivatingId(null);
    toast.success(`Card reactivated for ${CARD_AVAILABILITY_MONTHS} more months`);
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

  const handleDownloadQrCodes = () => {
    if (!selectedCard || !editQrCode || !recipientQrCode) {
      toast.error('QR codes are still loading');
      return;
    }

    const orderNumber = selectedCard.order.order_number;
    downloadDataUrl(editQrCode, orderQrFilename(orderNumber, 'edit_page_qr'));
    setTimeout(() => {
      downloadDataUrl(recipientQrCode, orderQrFilename(orderNumber, 'view_page_qr'));
    }, 150);
    toast.success('QR codes downloaded');
  };

  const getStatusBadge = (card: CardWithOrder) => {
    if (isCardExpired(card)) {
      return (
        <span className="inline-flex items-center rounded-full bg-stone-200 px-2.5 py-0.5 text-xs font-medium text-stone-700">
          Expired
        </span>
      );
    }
    if (card.status === 'published') {
      return <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">Published</span>;
    }
    return <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">Draft</span>;
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredCards = normalizedSearch
    ? cards.filter((card) => card.order.order_number.toLowerCase().includes(normalizedSearch))
    : cards;
  const cardsByDay = useMemo(() => groupCardsByDay(filteredCards), [filteredCards]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-100/80 to-stone-50">
      <header className="border-b border-stone-200/80 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 ring-1 ring-rose-100">
              <Gift className="h-5 w-5 text-rose-500" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-stone-800">Hommly Admin</h1>
          </div>
          <div className="flex items-center gap-2">
            <AdminLogoutButton />
            <Button onClick={() => setShowCreateForm(true)} size="sm" className="rounded-lg bg-rose-500 shadow-sm hover:bg-rose-600">
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">All Cards</h2>
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by order number..."
                className="rounded-lg border-stone-200 bg-white pl-9 shadow-sm"
              />
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
            </div>
          ) : cards.length === 0 ? (
            <div className="rounded-lg border border-dashed border-stone-300 py-12 text-center">
              <Gift className="mx-auto h-8 w-8 text-stone-300" />
              <p className="mt-2 text-sm text-stone-500">No cards yet. Create your first one above.</p>
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="rounded-lg border border-dashed border-stone-300 py-12 text-center">
              <Search className="mx-auto h-8 w-8 text-stone-300" />
              <p className="mt-2 text-sm text-stone-500">No cards match &ldquo;{searchQuery}&rdquo;</p>
            </div>
          ) : (
            <div className="space-y-8">
              {cardsByDay.map((section) => (
                <section key={section.dateKey} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-medium text-stone-700">{section.label}</h3>
                    <div className="h-px flex-1 bg-stone-200/80" />
                    <span className="text-xs text-stone-400">{section.cards.length} cards</span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {section.cards.map((card) => {
                const editUrl = `${origin}/e/${card.edit_token}`;
                const recipientUrl = `${origin}/g/${card.public_token}`;
                const expired = isCardExpired(card);
                return (
                  <Card
                    key={card.id}
                    className={cn(
                      'overflow-hidden rounded-2xl border-0 bg-white shadow-sm ring-1 ring-stone-200/70 transition-all',
                      expired ? 'opacity-75' : 'hover:-translate-y-0.5 hover:shadow-md'
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold tracking-tight text-stone-900">
                            {card.order.order_number}
                          </p>
                          <p className="mt-0.5 text-[11px] text-stone-400">
                            {expired
                              ? 'Links disabled'
                              : card.status === 'published'
                              ? 'Live card'
                              : 'Awaiting publish'}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          {getStatusBadge(card)}
                          {hasExpiryOverride(card) && (
                            <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-violet-100">
                              Custom expiry
                            </span>
                          )}
                        </div>
                      </div>

                      <div className={cn('mt-4 space-y-2.5 rounded-xl bg-stone-50/90 p-2.5 ring-1 ring-stone-100', expired && 'opacity-60')}>
                        <CardLinkRow
                          label="Buyer edit"
                          url={editUrl}
                          copyKey={`edit-${card.id}`}
                          copied={copiedField === `edit-${card.id}`}
                          onCopy={handleCopy}
                        />
                        <CardLinkRow
                          label="Recipient view"
                          url={recipientUrl}
                          copyKey={`recipient-${card.id}`}
                          copied={copiedField === `recipient-${card.id}`}
                          onCopy={handleCopy}
                        />
                      </div>

                      <div className="mt-3 grid grid-cols-4 gap-0.5 rounded-xl bg-stone-50 p-1 ring-1 ring-stone-100">
                        <CardQuickAction
                          label="QR"
                          icon={QrCode}
                          onClick={() => openCardDetails(card)}
                          disabled={expired}
                        />
                        <CardQuickAction
                          label="Edit"
                          icon={Eye}
                          onClick={() => window.open(editUrl, '_blank')}
                          disabled={expired}
                        />
                        {expired ? (
                          <CardQuickAction
                            label={reactivatingId === card.id ? '…' : 'Renew'}
                            icon={reactivatingId === card.id ? Loader2 : RotateCcw}
                            variant="success"
                            onClick={() => void handleReactivate(card)}
                            disabled={reactivatingId === card.id}
                          />
                        ) : (
                          <CardQuickAction
                            label="Expiry"
                            icon={CalendarClock}
                            onClick={() => openExpiryDialog(card)}
                            indicator={hasExpiryOverride(card)}
                          />
                        )}
                        <CardQuickAction
                          label="Delete"
                          icon={Trash2}
                          variant="danger"
                          onClick={() => setCardToDelete(card)}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
                    })}
                  </div>
                </section>
              ))}
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
                {getStatusBadge(selectedCard)}
              </div>

              <Separator />

              {isCardExpired(selectedCard) && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                  This card has expired. Public links are disabled until you reactivate it.
                </div>
              )}

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

              <Button
                variant="outline"
                className="w-full"
                disabled={!editQrCode || !recipientQrCode}
                onClick={handleDownloadQrCodes}
              >
                <Download className="mr-2 h-4 w-4" />
                Download QR Codes
              </Button>

              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-rose-500 hover:bg-rose-600"
                  disabled={isCardExpired(selectedCard)}
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
                  disabled={isCardExpired(selectedCard)}
                  onClick={() =>
                    window.open(`${origin}/g/${selectedCard.public_token}`, '_blank')
                  }
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Preview Recipient
                </Button>
              </div>

              {isCardExpired(selectedCard) && (
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  disabled={reactivatingId === selectedCard.id}
                  onClick={() => void handleReactivate(selectedCard)}
                >
                  {reactivatingId === selectedCard.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="mr-2 h-4 w-4" />
                  )}
                  Reactivate for {CARD_AVAILABILITY_MONTHS} months
                </Button>
              )}

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

      <Dialog
        open={!!cardForExpiry}
        onOpenChange={(open) => {
          if (!open && !savingExpiry) {
            setCardForExpiry(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Set validation date</DialogTitle>
          </DialogHeader>
          {cardForExpiry && (
            <div className="space-y-4">
              <p className="text-sm text-stone-600">
                Order <span className="font-medium text-stone-800">{cardForExpiry.order.order_number}</span>
              </p>

              <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Currently</p>
                {isCardExpired(cardForExpiry) ? (
                  <p className="mt-1 text-stone-700">
                    Expired on{' '}
                    <span className="font-medium">{formatCardExpiryDateTime(cardForExpiry)}</span>
                    <span className="text-stone-500"> — links are disabled</span>
                  </p>
                ) : hasExpiryOverride(cardForExpiry) ? (
                  <p className="mt-1 text-stone-700">
                    Custom until{' '}
                    <span className="font-medium">{formatStoredExpiryOverride(cardForExpiry)}</span>
                  </p>
                ) : cardForExpiry.status === 'published' ? (
                  <p className="mt-1 text-stone-700">
                    Default rule — until{' '}
                    <span className="font-medium">{formatCardExpiryDateTime(cardForExpiry)}</span>
                    <span className="text-stone-500"> (6 months from first publish)</span>
                  </p>
                ) : (
                  <p className="mt-1 text-stone-700">
                    Not published yet — default is 6 months from first publish.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiry-override">Validation date & time</Label>
                <Input
                  id="expiry-override"
                  type="datetime-local"
                  value={expiryInput}
                  onChange={(e) => setExpiryInput(e.target.value)}
                />
                <p className="text-xs text-stone-500">
                  Overrides the default 6-month period. The card is removed after this date.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                {isCardExpired(cardForExpiry) && (
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    disabled={savingExpiry || reactivatingId === cardForExpiry.id}
                    onClick={() => void handleReactivate(cardForExpiry)}
                  >
                    {reactivatingId === cardForExpiry.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="mr-2 h-4 w-4" />
                    )}
                    Reactivate ({CARD_AVAILABILITY_MONTHS} mo)
                  </Button>
                )}
                <Button
                  className="flex-1 bg-rose-500 hover:bg-rose-600"
                  disabled={savingExpiry}
                  onClick={() => void handleSaveExpiry()}
                >
                  {savingExpiry ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save custom expiry
                </Button>
                {hasExpiryOverride(cardForExpiry) && (
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    disabled={savingExpiry}
                    onClick={() => void handleClearExpiryOverride()}
                  >
                    Use default
                  </Button>
                )}
              </div>
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
