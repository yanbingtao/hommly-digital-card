import { describe, expect, it } from 'vitest';
import {
  assertProcessedImageWithinLimit,
  computeScaledDimensions,
  PHOTO_LONG_EDGE_STEPS,
  PHOTO_PROCESS_FAILED_MESSAGE,
} from './compress-image';
import { CARD_PHOTO_PROCESSED_MAX_BYTES } from './card-photo';

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

  it('supports dimension fallback ladder', () => {
    expect(PHOTO_LONG_EDGE_STEPS).toEqual([1600, 1440, 1280, 1080]);
    expect(computeScaledDimensions(4000, 3000, 1080)).toEqual({ width: 1080, height: 810 });
  });
});

describe('assertProcessedImageWithinLimit', () => {
  it('allows files at or under 1MB', () => {
    expect(() => assertProcessedImageWithinLimit(CARD_PHOTO_PROCESSED_MAX_BYTES)).not.toThrow();
    expect(() => assertProcessedImageWithinLimit(300_000)).not.toThrow();
  });

  it('rejects files over 1MB', () => {
    expect(() => assertProcessedImageWithinLimit(CARD_PHOTO_PROCESSED_MAX_BYTES + 1)).toThrow(
      PHOTO_PROCESS_FAILED_MESSAGE
    );
  });
});
