import type { SenderLinkFormInputs } from './sender-links';
import type { Theme } from './types';

export type IndividualRecipientEditorItem = {
  id: string;
  recipient_number: number;
  message: string | null;
  theme: string;
  animation: string;
  show_sender_links: boolean;
  sender_links: Record<string, unknown> | null;
  view_pin_enabled: boolean;
  status: string;
  published_at: string | null;
  view_pin_is_set: boolean;
};

export type EditorFieldState<T> =
  | { kind: 'value'; value: T }
  | { kind: 'mixed' };

export type IndividualEditorPrefillState = {
  message: EditorFieldState<string>;
  theme: EditorFieldState<Theme>;
  show_sender_links: EditorFieldState<boolean>;
  sender_links: EditorFieldState<SenderLinkFormInputs>;
  view_pin_enabled: EditorFieldState<boolean>;
};

export type IndividualEditorWarnings = {
  has_mixed_content: boolean;
  recipients_with_existing_content: number;
  has_mixed_pin: boolean;
};

export type IndividualRecipientEditorLoadResult = {
  recipients: IndividualRecipientEditorItem[];
  total_recipient_count: number;
  prefill: IndividualEditorPrefillState;
  warnings: IndividualEditorWarnings;
};

export type IndividualRecipientEditorFormState = {
  message: string;
  theme: Theme;
  show_sender_links: boolean;
  sender_links: SenderLinkFormInputs;
  view_pin_enabled: boolean;
  view_pin: string;
  view_pin_is_set: boolean;
};

export type PublishIndividualRecipientsContent = {
  message: string;
  theme: string;
  show_sender_links: boolean;
  sender_links: Record<string, unknown> | null;
  view_pin_enabled: boolean;
  view_pin: string;
};
