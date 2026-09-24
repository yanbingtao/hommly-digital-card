import {
  CARD_PHOTO_PROCESSED_MAX_BYTES,
  CARD_PHOTO_TARGET_BYTES,
} from './card-photo';

/** Long-edge ladder: start near 1920, step down if still too large. */
export const PHOTO_LONG_EDGE_STEPS = [1920, 1600, 1440, 1280, 1080, 960] as const;

/** Adaptive JPEG/WebP quality ladder (high → lower). */
export const PHOTO_QUALITY_STEPS = [0.85, 0.78, 0.7, 0.62, 0.55, 0.48] as const;

export const PHOTO_PROCESS_FAILED_MESSAGE =
  "We couldn't prepare this photo. Please try another image.";

export const PHOTO_HEIC_UNSUPPORTED_MESSAGE =
  "This photo format isn't supported in your browser. Try a screenshot, or choose a JPG or PNG photo.";

export type CompressImageMetrics = {
  originalWidth: number;
  originalHeight: number;
  originalBytes: number;
  processedWidth: number;
  processedHeight: number;
  processedBytes: number;
  mimeType: string;
  quality: number | null;
  longEdge: number;
  reductionPercent: number;
};

export type CompressImageResult = {
  blob: Blob;
  mimeType: string;
  fileName: string;
  metrics: CompressImageMetrics;
};

type DecodedImage = {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, dw: number, dh: number) => void;
  close: () => void;
};

export function computeScaledDimensions(
  width: number,
  height: number,
  maxLongEdge: number
): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(PHOTO_PROCESS_FAILED_MESSAGE);
  }
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const scale = maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function isHeicLike(file: File): boolean {
  const mime = (file.type || '').toLowerCase();
  if (mime === 'image/heic' || mime === 'image/heif' || mime === 'image/heic-sequence') {
    return true;
  }
  const name = (file.name || '').toLowerCase();
  return name.endsWith('.heic') || name.endsWith('.heif');
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), type, quality);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Encode canvas to a real output type. Safari often ignores `image/webp` and
 * returns PNG (or null) — callers must verify `blob.type` before accepting.
 */
async function encodeCanvas(
  canvas: HTMLCanvasElement,
  requestedType: 'image/webp' | 'image/jpeg' | 'image/png',
  quality?: number
): Promise<{ blob: Blob; mimeType: 'image/webp' | 'image/jpeg' | 'image/png' } | null> {
  const blob = await canvasToBlob(
    canvas,
    requestedType,
    requestedType === 'image/png' ? undefined : quality
  );
  if (!blob || blob.size <= 0) return null;

  const actual = (blob.type || '').toLowerCase();
  const sniffed = await sniffBlobMime(blob);

  if (requestedType === 'image/webp') {
    // Safari/iOS: WebP encode unsupported — may return PNG bytes (sometimes with empty type).
    if (sniffed && sniffed !== 'image/webp') return null;
    if (actual && actual !== 'image/webp') return null;
    if (!sniffed && !actual) return null;
    return { blob, mimeType: 'image/webp' };
  }

  if (requestedType === 'image/jpeg') {
    if (sniffed && sniffed !== 'image/jpeg') return null;
    if (actual && actual !== 'image/jpeg' && actual !== 'image/jpg') return null;
    if (!sniffed && !actual) return null;
    return { blob, mimeType: 'image/jpeg' };
  }

  if (sniffed && sniffed !== 'image/png') return null;
  if (actual && actual !== 'image/png') return null;
  if (!sniffed && !actual) return null;
  return { blob, mimeType: 'image/png' };
}

async function sniffBlobMime(
  blob: Blob
): Promise<'image/jpeg' | 'image/png' | 'image/webp' | null> {
  try {
    const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    if (header.length < 3) return null;
    if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return 'image/jpeg';
    if (
      header.length >= 8 &&
      header[0] === 0x89 &&
      header[1] === 0x50 &&
      header[2] === 0x4e &&
      header[3] === 0x47
    ) {
      return 'image/png';
    }
    if (
      header.length >= 12 &&
      header[0] === 0x52 &&
      header[1] === 0x49 &&
      header[2] === 0x46 &&
      header[3] === 0x46 &&
      header[8] === 0x57 &&
      header[9] === 0x45 &&
      header[10] === 0x42 &&
      header[11] === 0x50
    ) {
      return 'image/webp';
    }
  } catch {
    return null;
  }
  return null;
}

async function decodeWithCreateImageBitmap(file: File): Promise<DecodedImage | null> {
  if (typeof createImageBitmap !== 'function') return null;

  const tryDecode = async (options?: ImageBitmapOptions): Promise<ImageBitmap | null> => {
    try {
      return options ? await createImageBitmap(file, options) : await createImageBitmap(file);
    } catch {
      return null;
    }
  };

  // Prefer EXIF-aware decode when the engine supports it.
  let bitmap =
    (await tryDecode({ imageOrientation: 'from-image' })) ?? (await tryDecode());

  if (!bitmap || bitmap.width <= 0 || bitmap.height <= 0) {
    return null;
  }

  return {
    width: bitmap.width,
    height: bitmap.height,
    draw: (ctx, dw, dh) => {
      ctx.drawImage(bitmap!, 0, 0, dw, dh);
    },
    close: () => {
      try {
        bitmap!.close();
      } catch {
        // ignore
      }
    },
  };
}

async function decodeWithHtmlImage(file: File): Promise<DecodedImage | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null;

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('decode failed'));
      image.src = objectUrl;
    });

    if (!img.naturalWidth || !img.naturalHeight) {
      URL.revokeObjectURL(objectUrl);
      return null;
    }

    let revoked = false;
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      draw: (ctx, dw, dh) => {
        ctx.drawImage(img, 0, 0, dw, dh);
      },
      close: () => {
        if (!revoked) {
          revoked = true;
          URL.revokeObjectURL(objectUrl);
        }
      },
    };
  } catch {
    URL.revokeObjectURL(objectUrl);
    return null;
  }
}

async function decodeImage(file: File): Promise<DecodedImage> {
  const fromBitmap = await decodeWithCreateImageBitmap(file);
  if (fromBitmap) return fromBitmap;

  const fromImg = await decodeWithHtmlImage(file);
  if (fromImg) return fromImg;

  if (isHeicLike(file)) {
    throw new Error(PHOTO_HEIC_UNSUPPORTED_MESSAGE);
  }

  throw new Error(PHOTO_PROCESS_FAILED_MESSAGE);
}

function sampleHasTransparency(
  context: CanvasRenderingContext2D,
  width: number,
  height: number
): boolean {
  try {
    const stepX = Math.max(1, Math.floor(width / 24));
    const stepY = Math.max(1, Math.floor(height / 24));
    for (let y = 0; y < height; y += stepY) {
      for (let x = 0; x < width; x += stepX) {
        const alpha = context.getImageData(x, y, 1, 1).data[3];
        if (alpha !== undefined && alpha < 255) {
          return true;
        }
      }
    }
  } catch {
    // Some engines restrict getImageData; treat as opaque.
    return false;
  }
  return false;
}

function logCompressionMetrics(metrics: CompressImageMetrics): void {
  if (process.env.NODE_ENV === 'production') return;
  const reduction = Number.isFinite(metrics.reductionPercent)
    ? `${metrics.reductionPercent}%`
    : 'n/a';
  console.info('[photo-compress]', {
    original: `${metrics.originalWidth}×${metrics.originalHeight} ${metrics.originalBytes}B`,
    processed: `${metrics.processedWidth}×${metrics.processedHeight} ${metrics.processedBytes}B`,
    mimeType: metrics.mimeType,
    quality: metrics.quality,
    longEdge: metrics.longEdge,
    reduction,
  });
}

function buildResult(
  file: File,
  encoded: { blob: Blob; mimeType: 'image/webp' | 'image/jpeg' | 'image/png' },
  dims: { width: number; height: number },
  originalWidth: number,
  originalHeight: number,
  quality: number | null,
  longEdge: number
): CompressImageResult {
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
  const extension =
    encoded.mimeType === 'image/jpeg'
      ? 'jpg'
      : encoded.mimeType === 'image/png'
        ? 'png'
        : 'webp';
  const metrics: CompressImageMetrics = {
    originalWidth,
    originalHeight,
    originalBytes: file.size,
    processedWidth: dims.width,
    processedHeight: dims.height,
    processedBytes: encoded.blob.size,
    mimeType: encoded.mimeType,
    quality,
    longEdge,
    reductionPercent:
      file.size > 0
        ? Math.max(0, Math.round((1 - encoded.blob.size / file.size) * 100))
        : 0,
  };
  logCompressionMetrics(metrics);
  return {
    blob: encoded.blob,
    mimeType: encoded.mimeType,
    fileName: `${baseName}.${extension}`,
    metrics,
  };
}

function drawToCanvas(
  decoded: DecodedImage,
  width: number,
  height: number,
  hasAlpha: boolean,
  flattenToOpaque: boolean
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: hasAlpha && !flattenToOpaque });
  if (!context) {
    throw new Error(PHOTO_PROCESS_FAILED_MESSAGE);
  }
  if (flattenToOpaque || !hasAlpha) {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  decoded.draw(context, canvas.width, canvas.height);
  return canvas;
}

/**
 * Client-side resize + adaptive compression.
 * Prefer WebP when the browser truly encodes it; otherwise JPEG (Safari/iOS).
 * Never returns the original file on failure.
 */
export async function compressImageBeforeUpload(file: File): Promise<CompressImageResult> {
  if (typeof document === 'undefined') {
    throw new Error(PHOTO_PROCESS_FAILED_MESSAGE);
  }

  if (!file || file.size <= 0) {
    throw new Error(PHOTO_PROCESS_FAILED_MESSAGE);
  }

  const mime = (file.type || '').toLowerCase();
  if (mime === 'image/svg+xml' || mime === 'image/svg') {
    throw new Error(PHOTO_PROCESS_FAILED_MESSAGE);
  }
  if (mime && !mime.startsWith('image/')) {
    throw new Error(PHOTO_PROCESS_FAILED_MESSAGE);
  }

  const decoded = await decodeImage(file);

  try {
    const originalWidth = decoded.width;
    const originalHeight = decoded.height;

    const probeSize = computeScaledDimensions(
      originalWidth,
      originalHeight,
      PHOTO_LONG_EDGE_STEPS[0]
    );
    const probe = drawToCanvas(
      decoded,
      probeSize.width,
      probeSize.height,
      true,
      false
    );
    const probeCtx = probe.getContext('2d', { alpha: true });
    if (!probeCtx) {
      throw new Error(PHOTO_PROCESS_FAILED_MESSAGE);
    }
    const hasAlpha = sampleHasTransparency(probeCtx, probe.width, probe.height);

    let bestUnderHard: CompressImageResult | null = null;

    for (const longEdge of PHOTO_LONG_EDGE_STEPS) {
      const dims = computeScaledDimensions(originalWidth, originalHeight, longEdge);

      // Transparent: try WebP (alpha), then PNG; if still too large, flatten → JPEG.
      if (hasAlpha) {
        const alphaCanvas = drawToCanvas(decoded, dims.width, dims.height, true, false);

        for (const quality of PHOTO_QUALITY_STEPS) {
          const webp = await encodeCanvas(alphaCanvas, 'image/webp', quality);
          if (webp && webp.blob.size <= CARD_PHOTO_PROCESSED_MAX_BYTES) {
            const result = buildResult(
              file,
              webp,
              dims,
              originalWidth,
              originalHeight,
              quality,
              longEdge
            );
            if (webp.blob.size <= CARD_PHOTO_TARGET_BYTES) return result;
            if (!bestUnderHard || webp.blob.size < bestUnderHard.blob.size) {
              bestUnderHard = result;
            }
          }
        }

        const png = await encodeCanvas(alphaCanvas, 'image/png');
        if (png && png.blob.size <= CARD_PHOTO_PROCESSED_MAX_BYTES) {
          const result = buildResult(
            file,
            png,
            dims,
            originalWidth,
            originalHeight,
            null,
            longEdge
          );
          if (png.blob.size <= CARD_PHOTO_TARGET_BYTES) return result;
          if (!bestUnderHard || png.blob.size < bestUnderHard.blob.size) {
            bestUnderHard = result;
          }
        }
      }

      // Opaque path (also used as flatten fallback for large transparent images).
      const opaqueCanvas = drawToCanvas(decoded, dims.width, dims.height, hasAlpha, true);

      for (const quality of PHOTO_QUALITY_STEPS) {
        // Try WebP first when supported (smaller); verify real mime.
        const webp = await encodeCanvas(opaqueCanvas, 'image/webp', quality);
        if (webp && webp.blob.size <= CARD_PHOTO_PROCESSED_MAX_BYTES) {
          const result = buildResult(
            file,
            webp,
            dims,
            originalWidth,
            originalHeight,
            quality,
            longEdge
          );
          if (webp.blob.size <= CARD_PHOTO_TARGET_BYTES) return result;
          if (!bestUnderHard || webp.blob.size < bestUnderHard.blob.size) {
            bestUnderHard = result;
          }
        }

        const jpeg = await encodeCanvas(opaqueCanvas, 'image/jpeg', quality);
        if (jpeg && jpeg.blob.size <= CARD_PHOTO_PROCESSED_MAX_BYTES) {
          const result = buildResult(
            file,
            jpeg,
            dims,
            originalWidth,
            originalHeight,
            quality,
            longEdge
          );
          if (jpeg.blob.size <= CARD_PHOTO_TARGET_BYTES) return result;
          if (!bestUnderHard || jpeg.blob.size < bestUnderHard.blob.size) {
            bestUnderHard = result;
          }
        }
      }
    }

    if (bestUnderHard) {
      return bestUnderHard;
    }

    throw new Error(PHOTO_PROCESS_FAILED_MESSAGE);
  } finally {
    decoded.close();
  }
}

/** Hard gate used immediately before Storage upload. */
export function assertProcessedImageWithinLimit(sizeBytes: number): void {
  if (sizeBytes > CARD_PHOTO_PROCESSED_MAX_BYTES) {
    throw new Error(PHOTO_PROCESS_FAILED_MESSAGE);
  }
}

/** Map unknown/technical errors to customer-safe copy. */
export function toCustomerPhotoError(err: unknown): string {
  if (err instanceof Error && err.message) {
    if (
      err.message === PHOTO_PROCESS_FAILED_MESSAGE ||
      err.message === PHOTO_HEIC_UNSUPPORTED_MESSAGE
    ) {
      return err.message;
    }
  }
  return PHOTO_PROCESS_FAILED_MESSAGE;
}
