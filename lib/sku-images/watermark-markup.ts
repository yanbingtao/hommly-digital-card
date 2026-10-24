import {
  WATERMARK_PATH_CENTER_X,
  WATERMARK_PATH_CENTER_Y,
  WATERMARK_PATH_DATA,
  WATERMARK_POSITIONS,
  WATERMARK_TEXT,
} from './watermark-glyphs';

export { WATERMARK_POSITIONS, WATERMARK_TEXT };

const PATH_STYLE =
  'fill="white" fill-opacity="0.173" stroke="#282828" stroke-opacity="0.102" stroke-width="1" paint-order="stroke"';

/** Builds a square SVG overlay using vector paths (no system fonts). */
export function buildWatermarkOverlaySvg(size = 1024): string {
  const scale = size / 1024;
  const marks = WATERMARK_POSITIONS.map(([x, y]) => {
    const cx = x * size;
    const cy = y * size;
    const centerX = WATERMARK_PATH_CENTER_X * scale;
    const centerY = WATERMARK_PATH_CENTER_Y * scale;
    return `<g transform="translate(${cx}, ${cy}) scale(${scale}) translate(${-WATERMARK_PATH_CENTER_X}, ${-WATERMARK_PATH_CENTER_Y})"><path d="${WATERMARK_PATH_DATA}" ${PATH_STYLE}/></g>`;
  }).join('');

  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">${marks}</svg>`;
}
