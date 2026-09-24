import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  assertProcessedImageWithinLimit,
  computeScaledDimensions,
  PHOTO_LONG_EDGE_STEPS,
  PHOTO_PROCESS_FAILED_MESSAGE,
  PHOTO_QUALITY_STEPS,
  toCustomerPhotoError,
  PHOTO_HEIC_UNSUPPORTED_MESSAGE,
} from './compress-image';
import {
  CARD_PHOTO_MAX_BYTES,
  CARD_PHOTO_PROCESSED_MAX_BYTES,
  CARD_PHOTO_TARGET_BYTES,
  validateImageFile,
  validateProcessedImageBuffer,
} from './card-photo';

describe('computeScaledDimensions', () => {
  it('scales landscape by long edge 1600', () => {
    expect(computeScaledDimensions(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it('scales portrait by long edge 1600', () => {
    expect(computeScaledDimensions(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it('does not upscale smaller images', () => {
    expect(computeScaledDimensions(1200, 900, 1600)).toEqual({ width: 1200, height: 900 });
    expect(computeScaledDimensions(900, 1200, 1600)).toEqual({ width: 900, height: 1200 });
  });

  it('supports dimension fallback ladder including ~1920 start', () => {
    expect(PHOTO_LONG_EDGE_STEPS[0]).toBe(1920);
    expect(PHOTO_LONG_EDGE_STEPS).toContain(1600);
    expect(PHOTO_LONG_EDGE_STEPS).toContain(1080);
    expect(computeScaledDimensions(4000, 3000, 1080)).toEqual({ width: 1080, height: 810 });
  });

  it('starts quality near 0.85 for adaptive compression', () => {
    expect(PHOTO_QUALITY_STEPS[0]).toBe(0.85);
  });
});

describe('assertProcessedImageWithinLimit', () => {
  it('allows files at or under the hard processed cap (~1.5MB)', () => {
    expect(() => assertProcessedImageWithinLimit(CARD_PHOTO_PROCESSED_MAX_BYTES)).not.toThrow();
    expect(() => assertProcessedImageWithinLimit(300_000)).not.toThrow();
    expect(() => assertProcessedImageWithinLimit(CARD_PHOTO_TARGET_BYTES)).not.toThrow();
  });

  it('rejects files over the hard processed cap', () => {
    expect(() => assertProcessedImageWithinLimit(CARD_PHOTO_PROCESSED_MAX_BYTES + 1)).toThrow(
      PHOTO_PROCESS_FAILED_MESSAGE
    );
  });
});

describe('validateImageFile (mobile-tolerant)', () => {
  it('allows JPEG / PNG / WebP under 20MB', () => {
    expect(validateImageFile({ type: 'image/jpeg', size: 2_000_000 })).toEqual({ valid: true });
    expect(validateImageFile({ type: 'image/png', size: 4_000_000 })).toEqual({ valid: true });
    expect(validateImageFile({ type: 'image/webp', size: 900_000 })).toEqual({ valid: true });
  });

  it('allows empty MIME (common on iOS) when size is OK', () => {
    expect(validateImageFile({ type: '', size: 1_500_000 })).toEqual({ valid: true });
  });

  it('allows HEIC/HEIF through for decode attempt', () => {
    expect(validateImageFile({ type: 'image/heic', size: 3_000_000 })).toEqual({ valid: true });
    expect(validateImageFile({ type: 'image/heif', size: 3_000_000 })).toEqual({ valid: true });
  });

  it('allows images near the 20MB original limit', () => {
    expect(validateImageFile({ type: 'image/jpeg', size: CARD_PHOTO_MAX_BYTES })).toEqual({
      valid: true,
    });
  });

  it('rejects over 20MB originals', () => {
    const result = validateImageFile({ type: 'image/jpeg', size: CARD_PHOTO_MAX_BYTES + 1 });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toMatch(/too large/i);
    }
  });

  it('rejects non-image and SVG', () => {
    expect(validateImageFile({ type: 'application/pdf', size: 1000 }).valid).toBe(false);
    expect(validateImageFile({ type: 'image/svg+xml', size: 1000 }).valid).toBe(false);
  });
});

describe('validateProcessedImageBuffer', () => {
  it('accepts optimised JPEG/PNG/WebP under hard cap', () => {
    expect(validateProcessedImageBuffer('image/jpeg', 700_000)).toEqual({ valid: true });
    expect(validateProcessedImageBuffer('image/webp', CARD_PHOTO_PROCESSED_MAX_BYTES)).toEqual({
      valid: true,
    });
  });

  it('rejects oversized processed payloads', () => {
    const result = validateProcessedImageBuffer(
      'image/jpeg',
      CARD_PHOTO_PROCESSED_MAX_BYTES + 1
    );
    expect(result.valid).toBe(false);
  });
});

describe('toCustomerPhotoError', () => {
  it('preserves known customer messages', () => {
    expect(toCustomerPhotoError(new Error(PHOTO_PROCESS_FAILED_MESSAGE))).toBe(
      PHOTO_PROCESS_FAILED_MESSAGE
    );
    expect(toCustomerPhotoError(new Error(PHOTO_HEIC_UNSUPPORTED_MESSAGE))).toBe(
      PHOTO_HEIC_UNSUPPORTED_MESSAGE
    );
  });

  it('hides technical errors', () => {
    expect(toCustomerPhotoError(new Error('MIME decoding failed'))).toBe(
      PHOTO_PROCESS_FAILED_MESSAGE
    );
    expect(toCustomerPhotoError(new Error('StorageApiError: Bucket not found'))).toBe(
      PHOTO_PROCESS_FAILED_MESSAGE
    );
  });
});

describe('compressImageBeforeUpload (browser mocks)', () => {
  type CanvasStub = {
    width: number;
    height: number;
    getContext: ReturnType<typeof vi.fn>;
    toBlob: (cb: BlobCallback, type?: string, quality?: number) => void;
  };

  let encodeImpl: (type: string, quality?: number) => { type: string; size: number } | null;
  let hasAlpha = false;

  beforeEach(() => {
    hasAlpha = false;
    encodeImpl = () => null;

    const createElement = vi.fn((tag: string) => {
      if (tag !== 'canvas') {
        return { tagName: tag.toUpperCase() };
      }
      const canvas: CanvasStub = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({
          fillStyle: '',
          fillRect: vi.fn(),
          drawImage: vi.fn(),
          getImageData: vi.fn(() => ({
            data: hasAlpha
              ? new Uint8ClampedArray([0, 0, 0, 128])
              : new Uint8ClampedArray([0, 0, 0, 255]),
          })),
        })),
        toBlob: (cb, type, quality) => {
          const result = encodeImpl(type || 'image/png', quality as number | undefined);
          if (!result) {
            cb(null);
            return;
          }
          const header =
            result.type === 'image/jpeg'
              ? new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])
              : result.type === 'image/png'
                ? new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
                : new Uint8Array([
                    0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
                  ]);
          const blob = {
            size: result.size,
            type: result.type,
            arrayBuffer: async () => header.buffer,
            slice: () => ({
              arrayBuffer: async () => header.buffer.slice(0),
            }),
            stream: () => new ReadableStream(),
            text: async () => '',
            bytes: async () => header,
          } as unknown as Blob;
          cb(blob);
        },
      };
      return canvas;
    });

    vi.stubGlobal('document', { createElement });
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({
        width: 2400,
        height: 1800,
        close: vi.fn(),
      }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  function mockEncode(
    encode: (type: string, quality?: number) => { type: string; size: number } | null,
    alpha = false
  ) {
    encodeImpl = encode;
    hasAlpha = alpha;
  }

  it('falls back to JPEG when Safari returns PNG for WebP requests (screenshot path)', async () => {
    mockEncode((type, quality) => {
      if (type === 'image/webp') {
        // Safari behaviour: WebP encode unsupported
        return null;
      }
      if (type === 'image/jpeg') {
        const q = quality ?? 0.85;
        return { type: 'image/jpeg', size: Math.round(900_000 * q) };
      }
      return { type: 'image/png', size: 2_500_000 };
    });

    const { compressImageBeforeUpload } = await import('./compress-image');
    const file = new File([new Uint8Array(100)], 'IMG_SCREENSHOT.png', { type: 'image/png' });
    const result = await compressImageBeforeUpload(file);

    expect(result.mimeType).toBe('image/jpeg');
    expect(result.blob.size).toBeLessThanOrEqual(CARD_PHOTO_PROCESSED_MAX_BYTES);
    expect(result.fileName.endsWith('.jpg')).toBe(true);
  });

  it('accepts real WebP when the browser encodes it', async () => {
    mockEncode((type, quality) => {
      if (type === 'image/webp') {
        return { type: 'image/webp', size: Math.round(400_000 * (quality ?? 0.85)) };
      }
      if (type === 'image/jpeg') {
        return { type: 'image/jpeg', size: 600_000 };
      }
      return { type: 'image/png', size: 2_000_000 };
    });

    const { compressImageBeforeUpload } = await import('./compress-image');
    const file = new File([new Uint8Array(100)], 'photo.jpg', { type: 'image/jpeg' });
    const result = await compressImageBeforeUpload(file);

    expect(result.mimeType).toBe('image/webp');
    expect(result.blob.size).toBeLessThanOrEqual(CARD_PHOTO_TARGET_BYTES);
  });

  it('does not over-shrink an already-small image past target unnecessarily', async () => {
    mockEncode((type) => {
      if (type === 'image/webp') return null;
      if (type === 'image/jpeg') return { type: 'image/jpeg', size: 220_000 };
      return { type: 'image/png', size: 400_000 };
    });

    const { compressImageBeforeUpload } = await import('./compress-image');
    const file = new File([new Uint8Array(100)], 'small.jpg', { type: 'image/jpeg' });
    const result = await compressImageBeforeUpload(file);

    expect(result.blob.size).toBe(220_000);
    expect(result.metrics.quality).toBe(0.85);
  });

  it('progressively reduces until under hard max for large images', async () => {
    mockEncode((type, quality) => {
      if (type === 'image/webp') return null;
      if (type === 'image/jpeg') {
        const q = quality ?? 1;
        const size = q <= 0.55 ? 900_000 : 2_000_000;
        return { type: 'image/jpeg', size };
      }
      return { type: 'image/png', size: 5_000_000 };
    });

    const { compressImageBeforeUpload } = await import('./compress-image');
    const file = new File([new Uint8Array(100)], 'huge.jpg', { type: 'image/jpeg' });
    const result = await compressImageBeforeUpload(file);

    expect(result.blob.size).toBeLessThanOrEqual(CARD_PHOTO_PROCESSED_MAX_BYTES);
    expect(result.mimeType).toBe('image/jpeg');
  });

  it('preserves alpha via PNG when WebP encode is unavailable', async () => {
    mockEncode((type) => {
      if (type === 'image/webp') return null;
      if (type === 'image/png') return { type: 'image/png', size: 500_000 };
      if (type === 'image/jpeg') return { type: 'image/jpeg', size: 400_000 };
      return null;
    }, true);

    const { compressImageBeforeUpload } = await import('./compress-image');
    const file = new File([new Uint8Array(100)], 'logo.png', { type: 'image/png' });
    const result = await compressImageBeforeUpload(file);

    expect(result.mimeType).toBe('image/png');
  });

  it('throws customer-friendly error when decode fails for HEIC', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new Error('unsupported');
      })
    );
    vi.stubGlobal(
      'Image',
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        naturalWidth = 0;
        naturalHeight = 0;
        set src(_v: string) {
          queueMicrotask(() => this.onerror?.());
        }
      }
    );
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:mock',
      revokeObjectURL: vi.fn(),
    });

    const { compressImageBeforeUpload } = await import('./compress-image');
    const file = new File([new Uint8Array(100)], 'IMG_0001.HEIC', { type: 'image/heic' });

    await expect(compressImageBeforeUpload(file)).rejects.toThrow(PHOTO_HEIC_UNSUPPORTED_MESSAGE);
  });

  it('throws when every encode path fails', async () => {
    mockEncode(() => null);

    const { compressImageBeforeUpload } = await import('./compress-image');
    const file = new File([new Uint8Array(100)], 'broken.png', { type: 'image/png' });

    await expect(compressImageBeforeUpload(file)).rejects.toThrow(PHOTO_PROCESS_FAILED_MESSAGE);
  });
});
