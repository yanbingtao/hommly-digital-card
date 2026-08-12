import { SenderLinks } from './sender-links';

export type CardMode = 'shared' | 'individual';

export interface Order {
  id: string;
  order_number: string;
  created_at: string;
}

export interface DigitalCard {
  id: string;
  order_id: string;
  card_mode: CardMode;
  platform?: string | null;
  external_order_id?: string | null;
  public_token: string;
  edit_token: string;
  message: string | null;
  theme: string;
  animation: string;
  status: string;
  show_sender_links?: boolean;
  sender_links?: SenderLinks | null;
  view_pin_enabled?: boolean;
  view_pin_hash?: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  first_published_at?: string | null;
  expires_at_override?: string | null;
  photo_path?: string | null;
  photo_original_name?: string | null;
  photo_mime_type?: string | null;
  photo_size_bytes?: number | null;
  photo_uploaded_at?: string | null;
}

export type Theme = 'thank_you' | 'birthday' | 'farewell';

/** Mirrors digital_cards.status and digital_card_recipients.status values in use today. */
export type CardContentStatus = 'draft' | 'published' | 'disabled' | 'expired';

export interface DigitalCardMedia {
  id: string;
  digital_card_id: string;
  storage_path: string;
  original_name: string | null;
  mime_type: string;
  size_bytes: number;
  media_type?: string;
  created_at: string;
  updated_at: string;
}

export interface DigitalCardRecipient {
  id: string;
  digital_card_id: string;
  recipient_number: number;
  view_token: string;

  message: string | null;

  theme: string;
  animation: string;

  show_sender_links: boolean;
  sender_links: SenderLinks | null;

  view_pin_enabled: boolean;
  view_pin_hash: string | null;

  photo_media_id: string | null;
  photo_path: string | null;
  photo_original_name: string | null;
  photo_mime_type: string | null;
  photo_size_bytes: number | null;
  photo_uploaded_at: string | null;

  status: CardContentStatus | string;
  published_at: string | null;

  created_at: string;
  updated_at: string;
}

export interface CardWithOrder extends DigitalCard {
  order: Order;
}

/** Public recipient view — message may load after PIN; no edit_token, hash, or photo_path. */
export type RecipientCardWithOrder = Omit<
  DigitalCard,
  'edit_token' | 'view_pin_hash' | 'message' | 'photo_path'
> & {
  edit_token?: string;
  message?: string | null;
  order: Order;
};
