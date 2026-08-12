import type { CardWithOrder, DigitalCardRecipient } from './types';

export type IndividualTestCardBundle = {
  card: CardWithOrder;
  recipients: DigitalCardRecipient[];
  editUrl: string;
  compatibilityViewUrl: string;
  recipientViews: Array<{
    id: string;
    recipient_number: number;
    label: string;
    viewUrl: string;
    status: string;
    message: string | null;
  }>;
};
