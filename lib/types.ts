import { SenderLinks } from './sender-links';

export interface Order {
  id: string;
  order_number: string;
  created_at: string;
}

export interface DigitalCard {
  id: string;
  order_id: string;
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
}

export type Theme = 'thank_you' | 'birthday' | 'farewell';

export interface CardWithOrder extends DigitalCard {
  order: Order;
}

/** Public recipient view — message may load after PIN; no edit_token or hash. */
export type RecipientCardWithOrder = Omit<DigitalCard, 'edit_token' | 'view_pin_hash' | 'message'> & {
  edit_token?: string;
  message?: string | null;
  order: Order;
};
