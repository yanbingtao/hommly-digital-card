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
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export type Theme = 'thank_you' | 'birthday' | 'farewell';

export interface CardWithOrder extends DigitalCard {
  order: Order;
}
