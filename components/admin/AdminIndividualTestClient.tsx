'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  adminCreateIndividualTestCard,
  adminDeleteIndividualTestCard,
  adminPublishIndividualTestRecipient,
} from '@/lib/admin-individual-test-actions';
import { ADMIN_INDIVIDUAL_TEST_MAX_RECIPIENTS } from '@/lib/admin-individual-test-config';
import type { IndividualTestCardBundle } from '@/lib/admin-individual-test-types';
import { copyToClipboard } from '@/lib/copy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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
import { toast } from 'sonner';
import { BrandLogo } from '@/components/BrandLogo';
import { AdminLogoutButton } from '@/components/admin/AdminLogoutButton';
import { Copy, ExternalLink, Loader2, Trash2, Check, ArrowLeft } from 'lucide-react';

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        const ok = await copyToClipboard(value);
        if (ok) {
          setCopied(true);
          toast.success(label ? `${label} copied` : 'Copied');
          setTimeout(() => setCopied(false), 1500);
        } else {
          toast.error('Copy failed');
        }
      }}
    >
      {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
      Copy
    </Button>
  );
}

export function AdminIndividualTestClient() {
  const [orderNumber, setOrderNumber] = useState('TEST-INDIVIDUAL-001');
  const [recipientCount, setRecipientCount] = useState('3');
  const [bundle, setBundle] = useState<IndividualTestCardBundle | null>(null);
  const [draftMessages, setDraftMessages] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleCreate = () => {
    setError(null);
    const count = Number.parseInt(recipientCount, 10);
    startTransition(async () => {
      const result = await adminCreateIndividualTestCard({
        order_number: orderNumber,
        recipient_count: count,
      });
      if (result.error || !result.bundle) {
        setError(result.error ?? 'Failed to create test card.');
        setBundle(null);
        return;
      }
      setBundle(result.bundle);
      setDraftMessages(
        Object.fromEntries(result.bundle.recipientViews.map((view) => [view.id, view.message ?? '']))
      );
      toast.success(result.existing ? 'Loaded existing test card' : 'Individual test card created');
    });
  };

  const handlePublish = (recipientId: string) => {
    if (!bundle) return;
    const message = (draftMessages[recipientId] ?? '').trim();
    if (!message) {
      toast.error('Message is required before publishing.');
      return;
    }
    startTransition(async () => {
      const result = await adminPublishIndividualTestRecipient({
        card_id: bundle.card.id,
        recipient_id: recipientId,
        message,
      });
      if (result.error || !result.bundle) {
        toast.error(result.error ?? 'Failed to publish recipient.');
        return;
      }
      setBundle(result.bundle);
      setDraftMessages((prev) => {
        const next = { ...prev };
        for (const view of result.bundle!.recipientViews) {
          if (view.message) next[view.id] = view.message;
        }
        return next;
      });
      toast.success('Recipient published');
    });
  };

  const handleDelete = () => {
    if (!bundle) return;
    startTransition(async () => {
      const result = await adminDeleteIndividualTestCard(bundle.card.id);
      if (!result.success) {
        toast.error(result.error ?? 'Failed to delete test card.');
        return;
      }
      setBundle(null);
      setDraftMessages({});
      setDeleteOpen(false);
      toast.success('Test card deleted');
    });
  };

  const hasPublishedRecipient = bundle?.recipientViews.some((view) => view.status === 'published');

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50/80 to-white">
      <header className="border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <BrandLogo className="h-8 w-auto" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Admin</p>
              <h1 className="text-lg font-semibold">Individual E-Card Test Tool</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/cards">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back to Cards
              </Link>
            </Button>
            <AdminLogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <Card className="border-amber-200 bg-amber-50/70">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-amber-900">
              Testing only — not connected to Shopee automation
            </p>
            <p className="mt-1 text-sm text-amber-800/90">
              Creates Individual-mode cards with null platform identity for manual validation. Normal
              Admin Create Card and the internal automation API are unchanged.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create Individual Test Card</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="order-number">Order Number</Label>
                <Input
                  id="order-number"
                  value={orderNumber}
                  onChange={(event) => setOrderNumber(event.target.value)}
                  placeholder="TEST-INDIVIDUAL-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recipient-count">Recipient Quantity</Label>
                <Input
                  id="recipient-count"
                  type="number"
                  min={1}
                  max={ADMIN_INDIVIDUAL_TEST_MAX_RECIPIENTS}
                  step={1}
                  value={recipientCount}
                  onChange={(event) => setRecipientCount(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Positive integer only, max {ADMIN_INDIVIDUAL_TEST_MAX_RECIPIENTS} for this test tool.
                </p>
              </div>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="button" onClick={handleCreate} disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Individual Test Card
            </Button>
          </CardContent>
        </Card>

        {bundle ? (
          <>
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <CardTitle>Parent Card</CardTitle>
                <Button type="button" variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="mr-1 h-4 w-4" />
                  Delete Test Card
                </Button>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground">Card name</p>
                    <p className="font-medium">{bundle.card.order.order_number}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Mode</p>
                    <p className="font-medium capitalize">{bundle.card.card_mode}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Parent status</p>
                    <p className="font-medium capitalize">{bundle.card.status}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">first_published_at</p>
                    <p className="font-medium">{bundle.card.first_published_at ?? '—'}</p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-muted-foreground">Edit URL</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded bg-muted px-2 py-1 text-xs">{bundle.editUrl}</code>
                    <CopyButton value={bundle.editUrl} label="Edit URL" />
                    <Button asChild variant="outline" size="sm">
                      <a href={bundle.editUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-1 h-4 w-4" />
                        Open
                      </a>
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 rounded-md border border-dashed border-amber-300 bg-amber-50/60 p-3">
                  <p className="font-medium text-amber-900">
                    Compatibility token — NOT a recipient URL
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded bg-white px-2 py-1 text-xs">{bundle.compatibilityViewUrl}</code>
                    <CopyButton value={bundle.compatibilityViewUrl} label="Compatibility URL" />
                  </div>
                  <p className="text-xs text-amber-800">
                    Expected after publish: unavailable (Individual parent token is not a gift link).
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recipients</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {bundle.recipientViews.map((view) => (
                  <div key={view.id} className="space-y-3 rounded-lg border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold">{view.label}</h3>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">
                        Status: {view.status}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">View URL</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="rounded bg-muted px-2 py-1 text-xs">{view.viewUrl}</code>
                        <CopyButton value={view.viewUrl} label={`${view.label} URL`} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`message-${view.id}`}>Message</Label>
                      <Textarea
                        id={`message-${view.id}`}
                        value={draftMessages[view.id] ?? ''}
                        onChange={(event) =>
                          setDraftMessages((prev) => ({ ...prev, [view.id]: event.target.value }))
                        }
                        placeholder={`Message for ${view.label}`}
                        rows={3}
                      />
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handlePublish(view.id)}
                      disabled={isPending || view.status === 'published'}
                    >
                      {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Publish Recipient
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {hasPublishedRecipient ? (
              <Card>
                <CardHeader>
                  <CardTitle>Test Verification</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {bundle.recipientViews.map((view) => (
                    <div key={`verify-${view.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                      <div>
                        <p className="font-medium">{view.label}</p>
                        <p className="text-sm text-muted-foreground">
                          Expected: {view.message?.trim() ? view.message : '(not published yet)'}
                        </p>
                      </div>
                      <Button asChild variant="outline" size="sm" disabled={view.status !== 'published'}>
                        <a href={view.viewUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-1 h-4 w-4" />
                          Open Recipient View
                        </a>
                      </Button>
                    </div>
                  ))}

                  <Separator />

                  <div className="space-y-2 rounded-md border border-dashed border-amber-300 bg-amber-50/60 p-3">
                    <p className="font-medium">Parent compatibility view</p>
                    <code className="block rounded bg-white px-2 py-1 text-xs">{bundle.compatibilityViewUrl}</code>
                    <p className="text-sm text-amber-900">Expected: unavailable</p>
                    <Button asChild variant="outline" size="sm">
                      <a href={bundle.compatibilityViewUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-1 h-4 w-4" />
                        Open Compatibility View
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </>
        ) : null}
      </main>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Individual test card?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the parent order and cascades all recipient rows using existing admin deletion
              semantics.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isPending}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
