'use server';

import { assertAdminAuthenticated } from './admin-auth';
import { adminPublishIndividualRecipientCore } from './admin-individual-recipient-publish';
import { ADMIN_INDIVIDUAL_TEST_MAX_RECIPIENTS } from './admin-individual-test-config';
import type { IndividualTestCardBundle } from './admin-individual-test-types';
import { createIndividualCardCore } from './create-individual-card-core';
import { getRecipientsForCard, formatRecipientNumber } from './card-recipients';
import { buildBuyerEditUrl, buildRecipientViewUrl } from './individual-card-urls';
import { getCanonicalSiteOrigin } from './internal-card-response';
import { getSupabaseAdmin } from './supabase-admin';
import { getConnectionErrorMessage } from './supabase';
import { deleteCard } from './actions';
import type { DigitalCardRecipient } from './types';

function buildRecipientViews(
  recipients: DigitalCardRecipient[],
  siteOrigin: string
): IndividualTestCardBundle['recipientViews'] {
  return recipients.map((recipient) => ({
    id: recipient.id,
    recipient_number: recipient.recipient_number,
    label: formatRecipientNumber(recipient.recipient_number),
    viewUrl: buildRecipientViewUrl(recipient, siteOrigin),
    status: recipient.status,
    message: recipient.message,
  }));
}

export async function adminCreateIndividualTestCard(input: {
  order_number: string;
  recipient_count: number;
}): Promise<{ bundle: IndividualTestCardBundle | null; error: string | null; existing: boolean }> {
  try {
    await assertAdminAuthenticated();

    const orderNumber = input.order_number.trim();
    if (!orderNumber) {
      return { bundle: null, error: 'Order number is required.', existing: false };
    }

    const count = input.recipient_count;
    if (!Number.isInteger(count) || count <= 0 || count > ADMIN_INDIVIDUAL_TEST_MAX_RECIPIENTS) {
      return {
        bundle: null,
        error: `Recipient quantity must be a positive integer up to ${ADMIN_INDIVIDUAL_TEST_MAX_RECIPIENTS}.`,
        existing: false,
      };
    }

    const supabase = getSupabaseAdmin();
    const result = await createIndividualCardCore(supabase, {
      orderNumberInput: orderNumber,
      recipientCount: count,
      platform: null,
      externalOrderId: null,
    });

    if (!result.ok) {
      return { bundle: null, error: result.message, existing: false };
    }

    const siteOrigin = getCanonicalSiteOrigin();
    const bundle: IndividualTestCardBundle = {
      card: result.card,
      recipients: result.recipients,
      editUrl: buildBuyerEditUrl(result.card, siteOrigin),
      compatibilityViewUrl: `${siteOrigin.replace(/\/$/, '')}/g/${result.card.public_token}`,
      recipientViews: buildRecipientViews(result.recipients, siteOrigin),
    };

    return { bundle, error: null, existing: result.existing };
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return { bundle: null, error: 'Unauthorized. Please sign in again.', existing: false };
    }
    return { bundle: null, error: getConnectionErrorMessage(err), existing: false };
  }
}

export async function adminPublishIndividualTestRecipient(input: {
  card_id: string;
  recipient_id: string;
  message: string;
  theme?: string;
}): Promise<{ bundle: IndividualTestCardBundle | null; error: string | null }> {
  try {
    await assertAdminAuthenticated();

    const supabase = getSupabaseAdmin();
    const publishResult = await adminPublishIndividualRecipientCore(supabase, {
      cardId: input.card_id,
      recipientId: input.recipient_id,
      message: input.message,
      theme: input.theme,
    });

    if (publishResult.error || !publishResult.card) {
      return { bundle: null, error: publishResult.error ?? 'Failed to publish recipient.' };
    }

    const { recipients, error: listError } = await getRecipientsForCard(supabase, input.card_id);
    if (listError) {
      return { bundle: null, error: listError };
    }

    const siteOrigin = getCanonicalSiteOrigin();
    const bundle: IndividualTestCardBundle = {
      card: publishResult.card,
      recipients,
      editUrl: buildBuyerEditUrl(publishResult.card, siteOrigin),
      compatibilityViewUrl: `${siteOrigin.replace(/\/$/, '')}/g/${publishResult.card.public_token}`,
      recipientViews: buildRecipientViews(recipients, siteOrigin),
    };

    return { bundle, error: null };
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return { bundle: null, error: 'Unauthorized. Please sign in again.' };
    }
    return { bundle: null, error: getConnectionErrorMessage(err) };
  }
}

export async function adminDeleteIndividualTestCard(
  cardId: string
): Promise<{ success: boolean; error: string | null }> {
  return deleteCard(cardId);
}
