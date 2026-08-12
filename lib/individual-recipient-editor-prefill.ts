import { formatRecipientNumber } from './card-recipients';
import {
  EMPTY_SENDER_LINK_FORM,
  parseSenderLinksFromDb,
  senderLinksToFormInputs,
  type SenderLinkFormInputs,
} from './sender-links';
import { recipientHasMeaningfulContent, toIndividualRecipientManagerItem } from './individual-recipient-manager';
import type { DigitalCardRecipient } from './types';
import type {
  IndividualEditorPrefillState,
  IndividualEditorWarnings,
  IndividualRecipientEditorFormState,
  IndividualRecipientEditorItem,
  IndividualRecipientEditorLoadResult,
} from './individual-recipient-editor-types';
import type { Theme } from './types';

function fieldValue<T>(values: T[], emptyValue: T): { kind: 'value'; value: T } | { kind: 'mixed' } {
  if (values.length === 0) {
    return { kind: 'value', value: emptyValue };
  }
  const first = values[0];
  for (const value of values) {
    if (JSON.stringify(value) !== JSON.stringify(first)) {
      return { kind: 'mixed' };
    }
  }
  return { kind: 'value', value: first as T };
}

export function toIndividualRecipientEditorItem(row: DigitalCardRecipient): IndividualRecipientEditorItem {
  return {
    id: row.id,
    recipient_number: row.recipient_number,
    message: row.message,
    theme: row.theme,
    animation: row.animation,
    show_sender_links: Boolean(row.show_sender_links),
    sender_links: (row.sender_links as Record<string, unknown> | null) ?? null,
    view_pin_enabled: Boolean(row.view_pin_enabled),
    status: row.status,
    published_at: row.published_at,
    view_pin_is_set: Boolean(row.view_pin_hash),
  };
}

export function buildIndividualEditorPrefill(
  recipients: IndividualRecipientEditorItem[]
): IndividualEditorPrefillState {
  const messages = recipients.map((row) => row.message ?? '');
  const themes = recipients.map((row) => (row.theme as Theme) || 'thank_you');
  const showLinks = recipients.map((row) => row.show_sender_links);
  const linkForms = recipients.map((row) =>
    senderLinksToFormInputs(parseSenderLinksFromDb(row.sender_links))
  );
  const pinEnabled = recipients.map((row) => row.view_pin_enabled);

  return {
    message: fieldValue(messages, ''),
    theme: fieldValue(themes, 'thank_you' as Theme),
    show_sender_links: fieldValue(showLinks, false),
    sender_links: fieldValue(linkForms, { ...EMPTY_SENDER_LINK_FORM }),
    view_pin_enabled: fieldValue(pinEnabled, false),
  };
}

export function buildIndividualEditorWarnings(
  recipients: IndividualRecipientEditorItem[],
  prefill: IndividualEditorPrefillState
): IndividualEditorWarnings {
  const managerItems = recipients.map((row) =>
    toIndividualRecipientManagerItem({
      id: row.id,
      digital_card_id: 'internal',
      recipient_number: row.recipient_number,
      view_token: 'internal',
      message: row.message,
      theme: row.theme,
      animation: row.animation,
      show_sender_links: row.show_sender_links,
      sender_links: row.sender_links,
      view_pin_enabled: row.view_pin_enabled,
      view_pin_hash: row.view_pin_is_set ? 'set' : null,
      photo_media_id: null,
      photo_path: null,
      photo_original_name: null,
      photo_mime_type: null,
      photo_size_bytes: null,
      photo_uploaded_at: null,
      status: row.status,
      published_at: row.published_at,
      created_at: '',
      updated_at: '',
    })
  );

  return {
    has_mixed_content:
      prefill.message.kind === 'mixed' ||
      prefill.theme.kind === 'mixed' ||
      prefill.show_sender_links.kind === 'mixed' ||
      prefill.sender_links.kind === 'mixed',
    recipients_with_existing_content: managerItems.filter((item) =>
      recipientHasMeaningfulContent(item)
    ).length,
    has_mixed_pin: prefill.view_pin_enabled.kind === 'mixed',
  };
}

export function buildIndividualEditorLoadResult(
  selected: IndividualRecipientEditorItem[],
  totalRecipientCount: number
): IndividualRecipientEditorLoadResult {
  const prefill = buildIndividualEditorPrefill(selected);
  return {
    recipients: [...selected].sort((a, b) => a.recipient_number - b.recipient_number),
    total_recipient_count: totalRecipientCount,
    prefill,
    warnings: buildIndividualEditorWarnings(selected, prefill),
  };
}

export function prefillToFormState(
  prefill: IndividualEditorPrefillState,
  recipients: IndividualRecipientEditorItem[]
): IndividualRecipientEditorFormState {
  return {
    message: prefill.message.kind === 'value' ? prefill.message.value : '',
    theme: prefill.theme.kind === 'value' ? prefill.theme.value : 'thank_you',
    show_sender_links:
      prefill.show_sender_links.kind === 'value' ? prefill.show_sender_links.value : false,
    sender_links:
      prefill.sender_links.kind === 'value'
        ? { ...prefill.sender_links.value }
        : { ...EMPTY_SENDER_LINK_FORM },
    view_pin_enabled:
      prefill.view_pin_enabled.kind === 'value' ? prefill.view_pin_enabled.value : false,
    view_pin: '',
    view_pin_is_set:
      prefill.view_pin_enabled.kind === 'value' &&
      prefill.view_pin_enabled.value &&
      recipients.some((row) => row.view_pin_is_set),
  };
}

export function getIndividualEditorHeading(
  selectedNumbers: number[],
  totalRecipientCount: number
): string {
  const count = selectedNumbers.length;
  if (count === 1) {
    return `Personalise ${formatRecipientNumber(selectedNumbers[0]!)}`;
  }
  if (count === totalRecipientCount) {
    return `Personalise All ${count} Gift${count === 1 ? '' : 's'}`;
  }
  return `Personalise ${count} Gift${count === 1 ? '' : 's'}`;
}

export function getIndividualPublishLabel(
  selectedNumbers: number[],
  totalRecipientCount: number
): string {
  const count = selectedNumbers.length;
  if (count === 1) {
    return `Publish ${formatRecipientNumber(selectedNumbers[0]!)}`;
  }
  if (count === totalRecipientCount) {
    return `Publish to All ${count} Gift${count === 1 ? '' : 's'}`;
  }
  return `Publish to ${count} Gift${count === 1 ? '' : 's'}`;
}

export function formatSelectedRecipientsSummary(selectedNumbers: number[]): string {
  if (selectedNumbers.length === 0) return '';
  if (selectedNumbers.length <= 4) {
    return selectedNumbers.map((number) => formatRecipientNumber(number)).join(', ');
  }
  const visible = selectedNumbers.slice(0, 4).map((number) => formatRecipientNumber(number));
  const remaining = selectedNumbers.length - 4;
  return `${visible.join(', ')} + ${remaining} more`;
}

export function assertSafeEditorItem(item: unknown): void {
  if (!item || typeof item !== 'object') return;
  const forbidden = ['view_token', 'view_pin_hash', 'photo_path', 'digital_card_id'];
  for (const key of forbidden) {
    if (key in (item as Record<string, unknown>)) {
      throw new Error(`Unsafe editor item field: ${key}`);
    }
  }
}

export function assertSafeEditorItems(items: IndividualRecipientEditorItem[]): void {
  for (const item of items) {
    assertSafeEditorItem(item);
  }
}

export function normalizeUniqueRecipientIds(recipientIds: string[]): string[] {
  return Array.from(new Set(recipientIds.map((id) => id.trim()).filter(Boolean)));
}

export function formHasUnsavedChanges(
  form: IndividualRecipientEditorFormState,
  initial: IndividualRecipientEditorFormState
): boolean {
  return JSON.stringify(form) !== JSON.stringify(initial);
}
