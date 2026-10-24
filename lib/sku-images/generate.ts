import OpenAI, { toFile } from 'openai';
import sharp from 'sharp';
import { skuPrompt } from './prompt';
import { readAsset } from './store';
import type { SkuJob, SkuBatch } from './types';
import { buildWatermarkOverlaySvg } from './watermark-markup';

export async function watermarkSkuImage(image: Buffer): Promise<Buffer> {
  const meta = await sharp(image).metadata();
  if (meta.width !== meta.height || !meta.width) throw new Error('AI returned a non-square image.');
  const normalized = await sharp(image).resize(1024, 1024).png().toBuffer();
  return sharp(normalized)
    .composite([{ input: Buffer.from(buildWatermarkOverlaySvg(1024)) }])
    .png()
    .toBuffer();
}

/** Renders the watermark overlay alone (for tests). */
export async function renderWatermarkOverlayPng(size = 1024): Promise<Buffer> {
  return sharp(Buffer.from(buildWatermarkOverlaySvg(size))).png().toBuffer();
}

export async function generateSkuImage(batch: SkuBatch, job: SkuJob, sourcePath: string): Promise<{ base: Buffer; output: Buffer }> {
  const key = process.env.OPENAI_API_KEY?.trim(); if (!key) throw new Error('OPENAI_API_KEY is not configured.');
  const client = new OpenAI({ apiKey: key, maxRetries: 0, timeout: 240_000 });
  const inputs = [await toFile(await readAsset(sourcePath),'source.png',{ type:'image/png' }), await toFile(await readAsset(batch.logo_path),'brand-logo.png',{ type:'image/png' })];
  if (job.input.halal && batch.halal_path) inputs.push(await toFile(await readAsset(batch.halal_path),'halal-logo.png',{ type:'image/png' }));
  const response = await client.images.edit({ model: batch.model, image: inputs, prompt: skuPrompt(job.input, job.variant, !!batch.halal_path), n:1, size:'1024x1024', quality: batch.quality as 'high', output_format:'png', ...(batch.model==='gpt-image-1.5' ? { input_fidelity:'high' as const } : {}) });
  if (!response.data?.[0]?.b64_json) throw new Error('OpenAI returned no image.');
  const raw = Buffer.from(response.data[0].b64_json,'base64');
  const meta=await sharp(raw).metadata(); if (meta.width !== meta.height) throw new Error('AI returned a non-square image.');
  const base=await sharp(raw).resize(1024,1024).png().toBuffer();
  return { base, output:await watermarkSkuImage(base) };
}
