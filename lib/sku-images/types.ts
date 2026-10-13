export const SKU_BUCKET = 'sku-images';
export const SKU_MODELS = ['gpt-image-2.5-sunburst', 'gpt-image-2.5-flare', 'gpt-image-2', 'gpt-image-1.5'] as const;
export const SKU_COLUMNS = ['Image File', 'Product Name', 'Item Type', 'Halal', 'Name Sticker', 'Sticker Limit', 'Special Notes'] as const;
export type SkuInput = { sku: string; nameSticker?: boolean; imageFile: string; productName: string; halal: boolean; stickerLimit: number; theme: string; notes: string; itemType: string };
export type SkuStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'needs_review';
export type SkuJob = { id: string; batch_id: string; source_id: string; sku: string; variant: 'with-sticker' | 'without-sticker'; status: SkuStatus; input: SkuInput; source_path: string; base_path: string | null; output_path: string | null; error: string | null; request_id: string | null; started_at: string | null; completed_at: string | null; outputUrl?: string };
export type SkuBatch = { id: string; name: string; model: string; quality: string; logo_path: string; halal_path: string | null; logo_asset_id?: string|null; halal_asset_id?: string|null; uploads_ready: boolean; created_at: string };

export function matchSkuImage(expected: string, files: string[]): string | null {
  if (files.includes(expected)) return expected;
  let matches = files.filter(n => n.toLowerCase() === expected.toLowerCase());
  if (!matches.length) matches = files.filter(n => n.replace(/\.[^.]+$/, '').toLowerCase() === expected.replace(/\.[^.]+$/, '').toLowerCase());
  return matches.length === 1 ? matches[0] : null;
}

export function validateSkuInputs(rows: SkuInput[]): string[] {
  const errors: string[] = []; const seen = new Set<string>();
  if (!rows.length || rows.length > 100) errors.push('Use 1–100 source rows per batch. Each produces two images.');
  rows.forEach((r, i) => {
    const prefix = `Row ${i + 2}`;
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(r.sku)) errors.push(`${prefix}: invalid SKU.`);
    if (seen.has(r.sku.toLowerCase())) errors.push(`${prefix}: duplicate SKU.`);
    seen.add(r.sku.toLowerCase());
    if (!(r.productName.trim() || r.itemType.trim()) || !r.theme.trim() || !r.imageFile.trim()) errors.push(`${prefix}: image filename, item type (or product name) and theme are required.`);
    if (!Number.isInteger(r.stickerLimit) || r.stickerLimit < 1 || r.stickerLimit > 100) errors.push(`${prefix}: Sticker Limit must be 1–100.`);
    if (r.productName.length > 200 || r.theme.length > 200 || r.notes.length > 3000 || r.itemType.length > 200 || r.imageFile.length > 200) errors.push(`${prefix}: text too long.`);
  });
  return errors;
}

export function skuVariants(row:SkuInput):Array<'with-sticker'|'without-sticker'>{return row.nameSticker===false?['without-sticker']:['with-sticker','without-sticker'];}
