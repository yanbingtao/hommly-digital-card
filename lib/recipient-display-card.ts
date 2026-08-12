import { hasCardPhoto, hasRecipientPhoto } from './card-photo';
import type { ResolvedRecipientView } from './recipient-view-resolver';
import type { SenderLinks } from './sender-links';
import type { CardMode, Theme } from './types';

/** Normalized recipient-facing view model for Shared and Individual modes. */
export type RecipientDisplayCard = {
  mode: CardMode;
  viewToken: string;
  theme: Theme;
  animation: string;
  status: string;
  view_pin_enabled: boolean;
  show_sender_links: boolean;
  photo_available: boolean;
  recipient_number?: number;
  message?: string | null;
  sender_links?: SenderLinks | null;
};

export function toRecipientDisplayMeta(
  resolved: ResolvedRecipientView,
  viewToken: string
): RecipientDisplayCard {
  if (resolved.mode === 'individual') {
    const { recipient } = resolved;
    return {
      mode: 'individual',
      viewToken,
      theme: (recipient.theme as Theme) || 'thank_you',
      animation: recipient.animation || 'soft_reveal',
      status: recipient.status,
      view_pin_enabled: Boolean(recipient.view_pin_enabled),
      show_sender_links: Boolean(recipient.show_sender_links),
      photo_available: hasRecipientPhoto(recipient),
      recipient_number: recipient.recipient_number,
    };
  }

  const { card } = resolved;
  return {
    mode: 'shared',
    viewToken,
    theme: (card.theme as Theme) || 'thank_you',
    animation: card.animation || 'soft_reveal',
    status: card.status,
    view_pin_enabled: Boolean(card.view_pin_enabled),
    show_sender_links: Boolean(card.show_sender_links),
    photo_available: hasCardPhoto(card),
  };
}

export function toRecipientDisplayContent(
  resolved: ResolvedRecipientView,
  viewToken: string
): RecipientDisplayCard {
  const meta = toRecipientDisplayMeta(resolved, viewToken);

  if (resolved.mode === 'individual') {
    return {
      ...meta,
      message: resolved.recipient.message,
      sender_links: resolved.recipient.sender_links ?? null,
    };
  }

  return {
    ...meta,
    message: resolved.card.message,
    sender_links: resolved.card.sender_links ?? null,
  };
}
