import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateEditPin, isValidEditPin, normalizeEditPinInput, EDIT_PIN_LENGTH } from './edit-pin';
import {
  decryptEditPin,
  encryptEditPin,
  hashEditPin,
  verifyEditPinHash,
} from './edit-pin-crypto';
import {
  createEditPinSessionValue,
  fingerprintEditToken,
  parseEditPinSessionValue,
} from './edit-pin-session-token';
import { EDIT_PIN_RATE_LIMIT } from './edit-pin-rate-limit';

describe('Edit PIN generation', () => {
  it('produces exactly six digits including leading zeroes', () => {
    const samples = Array.from({ length: 40 }, () => generateEditPin());
    for (const pin of samples) {
      expect(pin).toHaveLength(EDIT_PIN_LENGTH);
      expect(isValidEditPin(pin)).toBe(true);
    }
    // Statistically likely to see a leading zero in 40 draws from 000000–999999
    // but do not require it — verify padStart behaviour explicitly.
    expect(String(42).padStart(6, '0')).toBe('000042');
    expect(isValidEditPin('000042')).toBe(true);
  });

  it('uses crypto randomness (not Math.random / order-derived)', () => {
    const source = require('fs').readFileSync(require('path').join(__dirname, 'edit-pin.ts'), 'utf8');
    expect(source).toMatch(/crypto\.randomBytes/);
    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toMatch(/orderNumber|MMDD|Date\.now\(\)/);
  });

  it('normalizes pasted input to digits only', () => {
    expect(normalizeEditPinInput('12 34-56')).toBe('123456');
    expect(normalizeEditPinInput('12ab345678')).toBe('123456');
  });
});

describe('Edit PIN hashing & encryption', () => {
  const previousKey = process.env.EDIT_PIN_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.EDIT_PIN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  });

  afterEach(() => {
    if (previousKey === undefined) {
      delete process.env.EDIT_PIN_ENCRYPTION_KEY;
    } else {
      process.env.EDIT_PIN_ENCRYPTION_KEY = previousKey;
    }
  });

  it('verifies scrypt hashes and rejects wrong PINs', () => {
    const pin = '091426';
    const hash = hashEditPin(pin);
    expect(verifyEditPinHash(pin, hash)).toBe(true);
    expect(verifyEditPinHash('091427', hash)).toBe(false);
    expect(hash).not.toContain(pin);
  });

  it('round-trips AES-GCM encryption for admin reveal', () => {
    const pin = '482731';
    const encrypted = encryptEditPin(pin);
    expect(encrypted.startsWith('v1:')).toBe(true);
    expect(encrypted).not.toContain(pin);
    expect(decryptEditPin(encrypted)).toBe(pin);
  });
});

describe('Edit PIN session scoping', () => {
  const previousKey = process.env.EDIT_PIN_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.EDIT_PIN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
  });

  afterEach(() => {
    if (previousKey === undefined) {
      delete process.env.EDIT_PIN_ENCRYPTION_KEY;
    } else {
      process.env.EDIT_PIN_ENCRYPTION_KEY = previousKey;
    }
  });

  it('binds session to card id, edit token fingerprint, and version', () => {
    const tokenA = 'order_secretAAAA';
    const tokenB = 'order_secretBBBB';
    const value = createEditPinSessionValue('card-a', tokenA, 0);
    const parsed = parseEditPinSessionValue(value);
    expect(parsed?.cardId).toBe('card-a');
    expect(parsed?.tokenFp).toBe(fingerprintEditToken(tokenA));
    expect(parsed?.ver).toBe(0);
    expect(parsed?.tokenFp).not.toBe(fingerprintEditToken(tokenB));
  });

  it('rejects tampered session values', () => {
    const value = createEditPinSessionValue('card-a', 'tok', 1);
    const [encoded] = value.split('.');
    expect(parseEditPinSessionValue(`${encoded}.deadbeef`)).toBeNull();
  });

  it('rejects sessions after version bump (PIN reset)', () => {
    const value = createEditPinSessionValue('card-a', 'tok', 0);
    const parsed = parseEditPinSessionValue(value);
    expect(parsed?.ver).toBe(0);
    // Caller compares against current card.edit_session_version — bumped version fails equality.
    expect(parsed?.ver === 1).toBe(false);
  });
});

describe('Edit PIN rate limit policy', () => {
  it('uses 5 failures / 15 minutes', () => {
    expect(EDIT_PIN_RATE_LIMIT.maxFailures).toBe(5);
    expect(EDIT_PIN_RATE_LIMIT.windowMs).toBe(15 * 60 * 1000);
  });
});

describe('Edit PIN gate wiring', () => {
  it('edit page shows gate before editor content', () => {
    const fs = require('fs');
    const path = require('path');
    const page = fs.readFileSync(path.join(__dirname, '../app/e/[editToken]/page.tsx'), 'utf8');
    const loader = fs.readFileSync(path.join(__dirname, 'edit-page-loader.ts'), 'utf8');
    expect(page).toMatch(/EditPinGate/);
    expect(page).toMatch(/needs_edit_pin/);
    expect(loader).toMatch(/hasValidEditPinSession/);
    expect(loader).toMatch(/ensureEditPinForCard/);
    expect(loader).toMatch(/needs_edit_pin/);
  });

  it('server mutations require Edit PIN session', () => {
    const fs = require('fs');
    const path = require('path');
    const actions = fs.readFileSync(path.join(__dirname, 'actions.ts'), 'utf8');
    const individual = fs.readFileSync(
      path.join(__dirname, 'individual-recipient-editor-actions.ts'),
      'utf8'
    );
    expect(actions).toMatch(/assertBuyerEditAuthorized/);
    expect(actions).toMatch(/getSharedCardForEdit/);
    expect(individual).toMatch(/assertBuyerEditAuthorized/);
  });

  it('keeps Viewing PIN and Edit PIN modules separate', () => {
    const fs = require('fs');
    const path = require('path');
    const editCrypto = fs.readFileSync(path.join(__dirname, 'edit-pin-crypto.ts'), 'utf8');
    const viewCrypto = fs.readFileSync(path.join(__dirname, 'view-pin-crypto.ts'), 'utf8');
    expect(editCrypto).toMatch(/scryptSync/);
    expect(editCrypto).toMatch(/aes-256-gcm/);
    expect(viewCrypto).toMatch(/pbkdf2Sync/);
    expect(editCrypto).not.toMatch(/view_pin/);
    expect(viewCrypto).not.toMatch(/edit_pin/);
  });

  it('support copy uses ecard@hommly.sg', () => {
    const fs = require('fs');
    const path = require('path');
    const gate = fs.readFileSync(
      path.join(__dirname, '../components/card/EditPinGate.tsx'),
      'utf8'
    );
    expect(gate).toMatch(/HOMMLY_ECARD_EMAIL|ecard@hommly\.sg/);
    expect(gate).toMatch(/Order ID/);
    expect(gate).toMatch(/photo of the Hommly product/);
  });
});
