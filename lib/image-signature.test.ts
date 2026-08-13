import { describe, expect, it } from 'vitest';
import { assertAllowedImageBinary, detectImageMimeFromBytes } from './image-signature';

function bytes(...values: number[]) {
  return new Uint8Array(values);
}

describe('detectImageMimeFromBytes', () => {
  it('detects JPEG', () => {
    const jpeg = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0);
    expect(detectImageMimeFromBytes(jpeg)).toBe('image/jpeg');
  });

  it('detects PNG', () => {
    const png = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0);
    expect(detectImageMimeFromBytes(png)).toBe('image/png');
  });

  it('detects WebP', () => {
    const webp = bytes(
      0x52,
      0x49,
      0x46,
      0x46,
      0,
      0,
      0,
      0,
      0x57,
      0x45,
      0x42,
      0x50
    );
    expect(detectImageMimeFromBytes(webp)).toBe('image/webp');
  });

  it('rejects SVG-like payloads', () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(detectImageMimeFromBytes(svg)).toBeNull();
  });
});

describe('assertAllowedImageBinary', () => {
  it('accepts matching PNG claim', () => {
    const png = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0);
    expect(assertAllowedImageBinary(png, 'image/png')).toEqual({ ok: true, mime: 'image/png' });
  });

  it('rejects MIME mismatch', () => {
    const png = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0);
    expect(assertAllowedImageBinary(png, 'image/jpeg').ok).toBe(false);
  });
});
