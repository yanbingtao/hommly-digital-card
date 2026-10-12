import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SKU_BUCKET, type SkuBatch, type SkuJob } from './types';
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function skuStore() { return getSupabaseAdmin(); }
export async function readBatch(id: string): Promise<SkuBatch> {
  if (!uuidPattern.test(id)) throw new Error('Invalid batch ID.');
  const { data, error } = await skuStore().from('sku_image_batches').select('*').eq('id', id).single();
  if (error || !data) throw new Error('Batch not found.'); return data as SkuBatch;
}
export async function readJobs(id: string): Promise<SkuJob[]> {
  const { data, error } = await skuStore().from('sku_image_jobs').select('*').eq('batch_id', id).order('created_at').order('sku').order('variant', { ascending: true });
  if (error) throw new Error('Unable to read SKU tasks.'); return (data || []) as SkuJob[];
}
export async function readAsset(path: string): Promise<Buffer> {
  const { data, error } = await skuStore().storage.from(SKU_BUCKET).download(path);
  if (error || !data) throw new Error('Required image was not uploaded or could not be read.');
  return Buffer.from(await data.arrayBuffer());
}
export async function saveAsset(path: string, body: Buffer): Promise<void> {
  const { error } = await skuStore().storage.from(SKU_BUCKET).upload(path, body, { upsert: false, contentType: 'image/png' });
  if (error) throw new Error('Unable to save generated image.');
}
