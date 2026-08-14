import type { SupabaseClient } from '@supabase/supabase-js';
import { getRecipientsForCard } from './card-recipients';
import {
  ADMIN_AUTOMATION_PLATFORM,
  automationClaimStaleCutoff,
  isEligibleForMacAutomationPendingQueue,
  isStaleAutomationClaim,
  resolveAutomationOrderId,
  resolveAutomationPlatformForCard,
  sanitizeAutomationErrorMessage,
} from './card-automation';
import {
  buildIndividualInternalCardResponse,
  type IndividualInternalCardResponse,
} from './internal-card-response';
import type { CardWithOrder } from './types';

export type PendingAutomationQueueStatus = 'pending' | 'failed' | 'claimed';

export type PendingAutomationCardPayload = IndividualInternalCardResponse & {
  card_id: string;
  automation_sync_status: PendingAutomationQueueStatus;
  /** Present only for stale claimed rows returned by the pending queue. */
  claim_stale?: true;
};

export type PendingAutomationListResponse = {
  cards: PendingAutomationCardPayload[];
};

export type AutomationMutationResponse = {
  ok: true;
  card_id: string;
  automation_sync_status: string;
};

export type InternalAutomationApiFailure = {
  ok: false;
  httpStatus: 400 | 404 | 409 | 500;
  body: Record<string, unknown>;
};

export type InternalAutomationApiSuccess<T> = {
  ok: true;
  httpStatus: 200;
  body: T;
};

export type InternalAutomationApiResult<T> =
  | InternalAutomationApiSuccess<T>
  | InternalAutomationApiFailure;

function isAdminIndividualCard(card: CardWithOrder | null): boolean {
  return Boolean(card) && card!.creation_source === 'admin' && (card!.card_mode ?? 'shared') === 'individual';
}

function quotePostgrestTimestamp(iso: string): string {
  return `"${iso.replace(/"/g, '')}"`;
}

function pendingAutomationOrFilter(now: Date): string {
  const cutoff = quotePostgrestTimestamp(automationClaimStaleCutoff(now).toISOString());
  return [
    'automation_sync_status.in.(pending,failed)',
    `and(automation_sync_status.eq.claimed,automation_claimed_at.lt.${cutoff})`,
    'and(automation_sync_status.eq.claimed,automation_claimed_at.is.null)',
  ].join(',');
}

function staleClaimedOrFilter(now: Date): string {
  const cutoff = quotePostgrestTimestamp(automationClaimStaleCutoff(now).toISOString());
  return `automation_claimed_at.lt.${cutoff},automation_claimed_at.is.null`;
}

function mutationOk(
  cardId: string,
  status: string
): InternalAutomationApiSuccess<AutomationMutationResponse> {
  return {
    ok: true,
    httpStatus: 200,
    body: { ok: true, card_id: cardId, automation_sync_status: status },
  };
}

function buildPendingCardPayload(
  card: CardWithOrder,
  recipients: Awaited<ReturnType<typeof getRecipientsForCard>>['recipients'],
  siteOrigin?: string,
  now: Date = new Date()
): PendingAutomationCardPayload | null {
  const platform = resolveAutomationPlatformForCard(card);
  const orderId = resolveAutomationOrderId(card);
  const queueStatus = card.automation_sync_status ?? 'not_required';

  if (!isAdminIndividualCard(card)) {
    return null;
  }
  if (!isEligibleForMacAutomationPendingQueue(card, now)) {
    return null;
  }
  if (queueStatus !== 'pending' && queueStatus !== 'failed' && queueStatus !== 'claimed') {
    return null;
  }

  const payload: PendingAutomationCardPayload = {
    ...buildIndividualInternalCardResponse({
      status: 'existing',
      platform,
      orderId,
      card,
      recipients,
      siteOrigin,
    }),
    card_id: card.id,
    automation_sync_status: queueStatus,
  };

  if (queueStatus === 'claimed') {
    payload.claim_stale = true;
  }

  return payload;
}

export async function listPendingAdminAutomationCards(
  supabase: SupabaseClient,
  siteOrigin?: string,
  now: Date = new Date()
): Promise<InternalAutomationApiResult<PendingAutomationListResponse>> {
  const { data, error } = await supabase
    .from('digital_cards')
    .select('*, order:orders(*)')
    .eq('creation_source', 'admin')
    .or(pendingAutomationOrFilter(now))
    .order('created_at', { ascending: true });

  if (error) {
    return { ok: false, httpStatus: 500, body: { error: error.message } };
  }

  const cards = (data ?? []) as CardWithOrder[];
  const payloads: PendingAutomationCardPayload[] = [];

  for (const card of cards) {
    if (!isAdminIndividualCard(card)) {
      continue;
    }
    if (!isEligibleForMacAutomationPendingQueue(card, now)) {
      continue;
    }

    const loaded = await getRecipientsForCard(supabase, card.id);
    if (loaded.error) {
      return { ok: false, httpStatus: 500, body: { error: loaded.error } };
    }

    const payload = buildPendingCardPayload(card, loaded.recipients, siteOrigin, now);
    if (payload) {
      payloads.push(payload);
    }
  }

  return { ok: true, httpStatus: 200, body: { cards: payloads } };
}

async function loadAdminAutomationCard(
  supabase: SupabaseClient,
  cardId: string
): Promise<{ card: CardWithOrder | null; error: string | null }> {
  const { data, error } = await supabase
    .from('digital_cards')
    .select('*, order:orders(*)')
    .eq('id', cardId)
    .maybeSingle();

  if (error) {
    return { card: null, error: error.message };
  }
  return { card: (data as CardWithOrder | null) ?? null, error: null };
}

function invalidAdminAutomationCard(card: CardWithOrder | null): boolean {
  return !isAdminIndividualCard(card);
}

async function claimPendingOrFailedCard(
  supabase: SupabaseClient,
  cardId: string,
  nowIso: string
): Promise<InternalAutomationApiResult<AutomationMutationResponse>> {
  const { data, error } = await supabase
    .from('digital_cards')
    .update({
      automation_sync_status: 'claimed',
      automation_claimed_at: nowIso,
      automation_last_error: null,
    })
    .eq('id', cardId)
    .eq('creation_source', 'admin')
    .in('automation_sync_status', ['pending', 'failed'])
    .select('id, automation_sync_status')
    .maybeSingle();

  if (error) {
    return { ok: false, httpStatus: 500, body: { error: error.message } };
  }

  if (data) {
    return mutationOk(data.id as string, data.automation_sync_status as string);
  }

  const { card: raced } = await loadAdminAutomationCard(supabase, cardId);
  if (raced && (raced.automation_sync_status === 'claimed' || raced.automation_sync_status === 'ready')) {
    return mutationOk(raced.id, raced.automation_sync_status ?? 'claimed');
  }

  return { ok: false, httpStatus: 409, body: { error: 'claim conflict' } };
}

async function reclaimStaleClaimedCard(
  supabase: SupabaseClient,
  cardId: string,
  now: Date
): Promise<InternalAutomationApiResult<AutomationMutationResponse>> {
  const { data, error } = await supabase
    .from('digital_cards')
    .update({
      automation_sync_status: 'claimed',
      automation_claimed_at: now.toISOString(),
      automation_last_error: null,
    })
    .eq('id', cardId)
    .eq('creation_source', 'admin')
    .eq('automation_sync_status', 'claimed')
    .or(staleClaimedOrFilter(now))
    .select('id, automation_sync_status, automation_claimed_at')
    .maybeSingle();

  if (error) {
    return { ok: false, httpStatus: 500, body: { error: error.message } };
  }

  if (data) {
    return mutationOk(data.id as string, data.automation_sync_status as string);
  }

  const { card: raced } = await loadAdminAutomationCard(supabase, cardId);
  if (raced?.automation_sync_status === 'claimed' || raced?.automation_sync_status === 'ready') {
    return mutationOk(raced.id, raced.automation_sync_status ?? 'claimed');
  }

  return { ok: false, httpStatus: 409, body: { error: 'claim conflict' } };
}

export async function claimAdminAutomationCard(
  supabase: SupabaseClient,
  cardId: string,
  now: Date = new Date()
): Promise<InternalAutomationApiResult<AutomationMutationResponse>> {
  const trimmedId = cardId.trim();
  if (!trimmedId) {
    return { ok: false, httpStatus: 400, body: { error: 'card_id is required' } };
  }

  const { card, error: loadError } = await loadAdminAutomationCard(supabase, trimmedId);
  if (loadError) {
    return { ok: false, httpStatus: 500, body: { error: loadError } };
  }
  if (invalidAdminAutomationCard(card)) {
    return { ok: false, httpStatus: 404, body: { error: 'card not found' } };
  }

  const status = card!.automation_sync_status ?? 'not_required';

  if (status === 'ready') {
    return mutationOk(card!.id, 'ready');
  }

  if (status === 'claimed') {
    if (!isStaleAutomationClaim(card!, now)) {
      return mutationOk(card!.id, 'claimed');
    }
    return reclaimStaleClaimedCard(supabase, trimmedId, now);
  }

  if (status !== 'pending' && status !== 'failed') {
    return { ok: false, httpStatus: 404, body: { error: 'card is not in the automation queue' } };
  }

  return claimPendingOrFailedCard(supabase, trimmedId, now.toISOString());
}

export async function markAdminAutomationReady(
  supabase: SupabaseClient,
  cardId: string
): Promise<InternalAutomationApiResult<AutomationMutationResponse>> {
  const trimmedId = cardId.trim();
  if (!trimmedId) {
    return { ok: false, httpStatus: 400, body: { error: 'card_id is required' } };
  }

  const { card, error: loadError } = await loadAdminAutomationCard(supabase, trimmedId);
  if (loadError) {
    return { ok: false, httpStatus: 500, body: { error: loadError } };
  }
  if (invalidAdminAutomationCard(card)) {
    return { ok: false, httpStatus: 404, body: { error: 'card not found' } };
  }

  if (card!.automation_sync_status === 'ready') {
    return {
      ok: true,
      httpStatus: 200,
      body: { ok: true, card_id: card!.id, automation_sync_status: 'ready' },
    };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('digital_cards')
    .update({
      automation_sync_status: 'ready',
      automation_ready_at: now,
      automation_last_error: null,
    })
    .eq('id', trimmedId)
    .eq('creation_source', 'admin')
    .eq('automation_sync_status', 'claimed')
    .select('id, automation_sync_status')
    .maybeSingle();

  if (error) {
    return { ok: false, httpStatus: 500, body: { error: error.message } };
  }

  if (data) {
    return {
      ok: true,
      httpStatus: 200,
      body: {
        ok: true,
        card_id: data.id as string,
        automation_sync_status: data.automation_sync_status as string,
      },
    };
  }

  const { card: raced } = await loadAdminAutomationCard(supabase, trimmedId);
  if (raced?.automation_sync_status === 'ready') {
    return {
      ok: true,
      httpStatus: 200,
      body: { ok: true, card_id: raced.id, automation_sync_status: 'ready' },
    };
  }

  return {
    ok: false,
    httpStatus: 409,
    body: { error: 'card must be claimed before marking ready' },
  };
}

export async function markAdminAutomationFailed(
  supabase: SupabaseClient,
  cardId: string,
  errorMessage?: unknown
): Promise<InternalAutomationApiResult<AutomationMutationResponse>> {
  const trimmedId = cardId.trim();
  if (!trimmedId) {
    return { ok: false, httpStatus: 400, body: { error: 'card_id is required' } };
  }

  const { card, error: loadError } = await loadAdminAutomationCard(supabase, trimmedId);
  if (loadError) {
    return { ok: false, httpStatus: 500, body: { error: loadError } };
  }
  if (invalidAdminAutomationCard(card)) {
    return { ok: false, httpStatus: 404, body: { error: 'card not found' } };
  }

  const safeError = sanitizeAutomationErrorMessage(errorMessage);

  if (card!.automation_sync_status === 'failed') {
    return {
      ok: true,
      httpStatus: 200,
      body: { ok: true, card_id: card!.id, automation_sync_status: 'failed' },
    };
  }

  const { data, error } = await supabase
    .from('digital_cards')
    .update({
      automation_sync_status: 'failed',
      automation_last_error: safeError,
    })
    .eq('id', trimmedId)
    .eq('creation_source', 'admin')
    .eq('automation_sync_status', 'claimed')
    .select('id, automation_sync_status')
    .maybeSingle();

  if (error) {
    return { ok: false, httpStatus: 500, body: { error: error.message } };
  }

  if (data) {
    return {
      ok: true,
      httpStatus: 200,
      body: {
        ok: true,
        card_id: data.id as string,
        automation_sync_status: data.automation_sync_status as string,
      },
    };
  }

  const { card: raced } = await loadAdminAutomationCard(supabase, trimmedId);
  if (raced?.automation_sync_status === 'failed') {
    return {
      ok: true,
      httpStatus: 200,
      body: { ok: true, card_id: raced.id, automation_sync_status: 'failed' },
    };
  }

  return {
    ok: false,
    httpStatus: 409,
    body: { error: 'card must be claimed before marking failed' },
  };
}

export function parseAutomationCardIdBody(body: unknown): { ok: true; cardId: string } | { ok: false; error: string } {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'request body must be a JSON object' };
  }
  const record = body as Record<string, unknown>;
  const extraKeys = Object.keys(record).filter((key) => key !== 'card_id' && key !== 'error');
  if (extraKeys.length > 0) {
    return { ok: false, error: 'unexpected fields in request body' };
  }
  const cardId = record.card_id;
  if (typeof cardId !== 'string' || !cardId.trim()) {
    return { ok: false, error: 'card_id is required' };
  }
  return { ok: true, cardId: cardId.trim() };
}

export { ADMIN_AUTOMATION_PLATFORM };
