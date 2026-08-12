'use server';

import { getSupabaseAdmin } from './supabase-admin';
import { getConnectionErrorMessage } from './supabase';
import {
  isResolvedRecipientViewAvailable,
  resolveRecipientViewToken,
} from './recipient-view-resolver';
import {
  toRecipientDisplayContent,
  toRecipientDisplayMeta,
  type RecipientDisplayCard,
} from './recipient-display-card';

export type RecipientViewMetaResponse = {
  available: boolean;
  display: RecipientDisplayCard | null;
  error: string | null;
};

export type RecipientViewContentResponse = {
  available: boolean;
  display: RecipientDisplayCard | null;
  error: string | null;
};

export async function fetchRecipientViewMeta(viewToken: string): Promise<RecipientViewMetaResponse> {
  try {
    const supabase = getSupabaseAdmin();
    const result = await resolveRecipientViewToken(supabase, viewToken);

    if (!result.ok) {
      return { available: false, display: null, error: null };
    }

    if (!isResolvedRecipientViewAvailable(result.resolved)) {
      return { available: false, display: null, error: null };
    }

    return {
      available: true,
      display: toRecipientDisplayMeta(result.resolved, viewToken.trim()),
      error: null,
    };
  } catch (err: unknown) {
    return {
      available: false,
      display: null,
      error: getConnectionErrorMessage(err),
    };
  }
}

export async function fetchRecipientViewContent(
  viewToken: string
): Promise<RecipientViewContentResponse> {
  try {
    const supabase = getSupabaseAdmin();
    const result = await resolveRecipientViewToken(supabase, viewToken);

    if (!result.ok) {
      return { available: false, display: null, error: null };
    }

    if (!isResolvedRecipientViewAvailable(result.resolved)) {
      return { available: false, display: null, error: null };
    }

    return {
      available: true,
      display: toRecipientDisplayContent(result.resolved, viewToken.trim()),
      error: null,
    };
  } catch (err: unknown) {
    return {
      available: false,
      display: null,
      error: getConnectionErrorMessage(err),
    };
  }
}
