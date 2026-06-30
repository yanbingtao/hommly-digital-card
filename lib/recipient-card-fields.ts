/** Meta fields for the public recipient view (no message until PIN verified). */
export const RECIPIENT_CARD_META_SELECT =
  'id, order_id, public_token, theme, animation, status, view_pin_enabled, show_sender_links, created_at, updated_at, published_at, first_published_at, expires_at_override, order:orders(*)';

/** Message content loaded after PIN gate (or when PIN is off). */
export const RECIPIENT_CARD_CONTENT_SELECT = 'message, sender_links, show_sender_links';
