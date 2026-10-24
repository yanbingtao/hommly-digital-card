import sharp from 'sharp';
import { WATERMARK_POSITIONS } from './watermark-glyphs';

/** Horizontal projection peak count — distinguishes letter strokes from a single tofu row. */
export function countHorizontalAlphaPeaks(
  rgba: Buffer,
  width: number,
  height: number,
  centerY: number,
  bandHalfHeight = 14,
  minPeakValue = 8
): number {
  const y0 = Math.max(0, Math.floor(centerY - bandHalfHeight));
  const y1 = Math.min(height, Math.ceil(centerY + bandHalfHeight));
  const columnSums: number[] = new Array(width).fill(0);

  for (let y = y0; y < y1; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = rgba[(y * width + x) * 4 + 3];
      if (alpha > 10) columnSums[x] += 1;
    }
  }

  let peaks = 0;
  for (let x = 1; x < width - 1; x += 1) {
    const value = columnSums[x];
    if (value < minPeakValue) continue;
    if (value >= columnSums[x - 1] && value > columnSums[x + 1]) peaks += 1;
    else if (value > columnSums[x - 1] && value >= columnSums[x + 1]) peaks += 1;
  }
  return peaks;
}

export async function analyzeWatermarkOverlayPng(png: Buffer): Promise<{
  width: number;
  height: number;
  peaksAtBottomMark: number;
  peakSumAtMarkCenters: number;
  alphaPixelCount: number;
}> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const markPeaks = WATERMARK_POSITIONS.map(([, y]) =>
    countHorizontalAlphaPeaks(data, info.width, info.height, Math.round(y * info.height), 18, 6)
  );
  const peaksAtBottomMark = markPeaks.at(-1) ?? 0;
  const peakSumAtMarkCenters = markPeaks.reduce((sum, value) => sum + value, 0);

  let alphaPixelCount = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 10) alphaPixelCount += 1;
  }

  return {
    width: info.width,
    height: info.height,
    peaksAtBottomMark,
    peakSumAtMarkCenters,
    alphaPixelCount,
  };
}
