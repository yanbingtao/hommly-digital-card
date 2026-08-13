export type DetectedImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

/**
 * Detect JPEG / PNG / WebP from magic bytes. SVG and other types return null.
 */
export function detectImageMimeFromBytes(bytes: ArrayBuffer | Uint8Array): DetectedImageMime | null {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (view.length < 12) return null;

  // JPEG: FF D8 FF
  if (view[0] === 0xff && view[1] === 0xd8 && view[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    view[0] === 0x89 &&
    view[1] === 0x50 &&
    view[2] === 0x4e &&
    view[3] === 0x47 &&
    view[4] === 0x0d &&
    view[5] === 0x0a &&
    view[6] === 0x1a &&
    view[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: RIFF....WEBP
  const riff =
    view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46;
  const webp =
    view[8] === 0x57 && view[9] === 0x45 && view[10] === 0x42 && view[11] === 0x50;
  if (riff && webp) {
    return 'image/webp';
  }

  return null;
}

export function assertAllowedImageBinary(
  bytes: ArrayBuffer | Uint8Array,
  claimedMime?: string | null
): { ok: true; mime: DetectedImageMime } | { ok: false; error: string } {
  const detected = detectImageMimeFromBytes(bytes);
  if (!detected) {
    return { ok: false, error: 'Please upload a JPG, PNG, or WebP image.' };
  }

  if (claimedMime && claimedMime !== detected) {
    // Allow jpeg/jpg alias mismatch only when both are jpeg family.
    const claimedIsJpeg = claimedMime === 'image/jpeg' || claimedMime === 'image/jpg';
    if (!(claimedIsJpeg && detected === 'image/jpeg')) {
      return { ok: false, error: 'Please upload a JPG, PNG, or WebP image.' };
    }
  }

  return { ok: true, mime: detected };
}
