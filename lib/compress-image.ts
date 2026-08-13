import { CARD_PHOTO_PROCESSED_MAX_BYTES } from './card-photo';

export const PHOTO_LONG_EDGE_STEPS = [1600, 1440, 1280, 1080] as const;
export const PHOTO_QUALITY_STEPS = [0.82, 0.76, 0.7, 0.64, 0.58] as const;

export const PHOTO_PROCESS_FAILED_MESSAGE =
  "We couldn't prepare this photo. Please try another image.";

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

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error(PHOTO_PROCESS_FAILED_MESSAGE));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });
}

async function decodeImageBitmap(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap === 'function') {
    // Modern browsers apply EXIF orientation when decoding from Blob/File.
    return createImageBitmap(file);
  }
  throw new Error(PHOTO_PROCESS_FAILED_MESSAGE);
}

function sampleHasTransparency(
  context: CanvasRenderingContext2D,
  width: number,
  height: number
): boolean {
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

/**
 * Client-side resize + adaptive WebP compression with a hard 1MB cap.
 * Never returns the original file on failure.
 */
export async function compressImageBeforeUpload(file: File): Promise<CompressImageResult> {
  if (typeof document === 'undefined') {
    throw new Error(PHOTO_PROCESS_FAILED_MESSAGE);
  }

  if (!file?.type?.startsWith('image/')) {
    throw new Error(PHOTO_PROCESS_FAILED_MESSAGE);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await decodeImageBitmap(file);
  } catch {
    throw new Error(PHOTO_PROCESS_FAILED_MESSAGE);
  }

  try {
    const originalWidth = bitmap.width;
    const originalHeight = bitmap.height;

    const probe = document.createElement('canvas');
    const probeSize = computeScaledDimensions(originalWidth, originalHeight, PHOTO_LONG_EDGE_STEPS[0]);
    probe.width = probeSize.width;
    probe.height = probeSize.height;
    const probeCtx = probe.getContext('2d', { alpha: true });
    if (!probeCtx) {
      throw new Error(PHOTO_PROCESS_FAILED_MESSAGE);
    }
    probeCtx.drawImage(bitmap, 0, 0, probe.width, probe.height);
    const hasAlpha = sampleHasTransparency(probeCtx, probe.width, probe.height);

    // Prefer WebP for photos and transparent PNGs (alpha-preserving).
    const outputType = 'image/webp';
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
    const fileName = `${baseName}.webp`;

    let bestAttempt: {
      blob: Blob;
      width: number;
      height: number;
      quality: number;
      longEdge: number;
    } | null = null;

    for (const longEdge of PHOTO_LONG_EDGE_STEPS) {
      const dims = computeScaledDimensions(originalWidth, originalHeight, longEdge);
      const canvas = document.createElement('canvas');
      canvas.width = dims.width;
      canvas.height = dims.height;
      const context = canvas.getContext('2d', { alpha: hasAlpha });
      if (!context) {
        throw new Error(PHOTO_PROCESS_FAILED_MESSAGE);
      }
      if (!hasAlpha) {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of PHOTO_QUALITY_STEPS) {
        const blob = await canvasToBlob(canvas, outputType, quality);
        if (!bestAttempt || blob.size < bestAttempt.blob.size) {
          bestAttempt = {
            blob,
            width: dims.width,
            height: dims.height,
            quality,
            longEdge,
          };
        }
        if (blob.size <= CARD_PHOTO_PROCESSED_MAX_BYTES) {
          const metrics: CompressImageMetrics = {
            originalWidth,
            originalHeight,
            originalBytes: file.size,
            processedWidth: dims.width,
            processedHeight: dims.height,
            processedBytes: blob.size,
            mimeType: outputType,
            quality,
            longEdge,
            reductionPercent:
              file.size > 0
                ? Math.max(0, Math.round((1 - blob.size / file.size) * 100))
                : 0,
          };
          logCompressionMetrics(metrics);
          return {
            blob,
            mimeType: outputType,
            fileName,
            metrics,
          };
        }
      }
    }

    if (bestAttempt && bestAttempt.blob.size <= CARD_PHOTO_PROCESSED_MAX_BYTES) {
      const metrics: CompressImageMetrics = {
        originalWidth,
        originalHeight,
        originalBytes: file.size,
        processedWidth: bestAttempt.width,
        processedHeight: bestAttempt.height,
        processedBytes: bestAttempt.blob.size,
        mimeType: outputType,
        quality: bestAttempt.quality,
        longEdge: bestAttempt.longEdge,
        reductionPercent:
          file.size > 0
            ? Math.max(0, Math.round((1 - bestAttempt.blob.size / file.size) * 100))
            : 0,
      };
      logCompressionMetrics(metrics);
      return {
        blob: bestAttempt.blob,
        mimeType: outputType,
        fileName,
        metrics,
      };
    }

    throw new Error(PHOTO_PROCESS_FAILED_MESSAGE);
  } finally {
    bitmap.close();
  }
}

/** Hard gate used immediately before Storage upload. */
export function assertProcessedImageWithinLimit(sizeBytes: number): void {
  if (sizeBytes > CARD_PHOTO_PROCESSED_MAX_BYTES) {
    throw new Error(PHOTO_PROCESS_FAILED_MESSAGE);
  }
}
