import { describe, expect, it } from 'vitest';
import {
  generatePublicToken,
  generateRecipientViewToken,
  isLegacyHexToken,
  isShortPublicToken,
  isValidPublicToken,
} from './card-tokens';

describe('isValidPublicToken', () => {
  it('accepts short base62 slugs', () => {
    expect(isValidPublicToken('hoTcjo5thQLY')).toBe(true);
    expect(isValidPublicToken('pubToken12ab')).toBe(true);
    expect(isShortPublicToken('hoTcjo5thQLY')).toBe(true);
  });

  it('accepts legacy 64-char hex tokens', () => {
    const legacy = 'a'.repeat(64);
    expect(isValidPublicToken(legacy)).toBe(true);
    expect(isLegacyHexToken(legacy)).toBe(true);
  });

  it('rejects invalid tokens', () => {
    expect(isValidPublicToken('')).toBe(false);
    expect(isValidPublicToken('too-short')).toBe(false);
    expect(isValidPublicToken('a'.repeat(63))).toBe(false);
  });

  it('generatePublicToken produces valid slugs', () => {
    const token = generatePublicToken();
    expect(token).toHaveLength(12);
    expect(isValidPublicToken(token)).toBe(true);
  });

  it('generateRecipientViewToken matches public token format', () => {
    const token = generateRecipientViewToken();
    expect(token).toHaveLength(12);
    expect(isValidPublicToken(token)).toBe(true);
    expect(isShortPublicToken(token)).toBe(true);
  });
});
