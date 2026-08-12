import type { CardWithOrder } from './types';
import type { RecipientPersonalisationStatus } from './individual-recipient-manager';

export type AdminIndividualRecipientItem = {
  recipient_number: number;
  label: string;
  viewUrl: string;
  status: RecipientPersonalisationStatus;
  statusLabel: string;
};

export type AdminCreateSharedCardResult =
  | { ok: true; mode: 'shared'; card: CardWithOrder }
  | { ok: false; error: string };

export type AdminCreateIndividualCardResult =
  | {
      ok: true;
      mode: 'individual';
      card: CardWithOrder;
      recipients: AdminIndividualRecipientItem[];
      editUrl: string;
      quantity: number;
    }
  | { ok: false; error: string };

export type AdminCreateCardResult = AdminCreateSharedCardResult | AdminCreateIndividualCardResult;
