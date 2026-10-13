import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { skuAccess } from '@/lib/sku-images/auth';
import { skuStore } from '@/lib/sku-images/store';
import { batchBrandSnapshot } from '@/lib/sku-images/brand-assets';
import { SKU_BUCKET, SKU_MODELS, validateSkuInputs } from '@/lib/sku-images/types';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const input = z.object({ sku:z.string().max(100), imageFile:z.string().max(200), productName:z.string().max(200), halal:z.boolean(), stickerLimit:z.number().int().min(1).max(100), theme:z.string().max(200), notes:z.string().max(3000), itemType:z.string().max(200) });
const schema = z.object({ name:z.string().trim().min(1).max(100), model:z.enum(SKU_MODELS), quality:z.enum(['low','medium','high','xhigh','max']), rows:z.array(input).min(1).max(100) });
export async function GET() {
  const denied=await skuAccess(); if(denied)return denied;
  try {
    const { data,error }=await skuStore().from('sku_image_batches').select('*').order('created_at',{ascending:false}).limit(50);
    return error ? NextResponse.json({error:'SKU storage is not ready. Apply the isolated SKU migration.'},{status:503}) : NextResponse.json({batches:data},{headers:{'Cache-Control':'no-store'}});
  } catch { return NextResponse.json({error:'SKU storage is not configured. Configure server-side Supabase access before generating.'},{status:503}); }
}
export async function POST(request:Request) {
  const denied=await skuAccess(request); if(denied)return denied;
  try {
    const body=schema.parse(await request.json()); const issues=validateSkuInputs(body.rows);
    if(issues.length)return NextResponse.json({error:issues.join('\n')},{status:400});
    if(!body.model.startsWith('gpt-image-2.5') && ['xhigh','max'].includes(body.quality))return NextResponse.json({error:'This quality is only supported with GPT Image 2.5.'},{status:400});
    const brand=await batchBrandSnapshot(body.rows);
    const id=randomUUID(); const sources=body.rows.map(row=>({id:randomUUID(),row}));
    const paths=sources.map(s=>({kind:s.row.sku,path:`${id}/sources/${s.id}.png`}));
    const batch={id,name:body.name,model:body.model,quality:body.quality,...brand};
    const {error:batchError}=await skuStore().from('sku_image_batches').insert(batch);
    if(batchError)throw new Error('SKU storage is not ready. Apply the isolated SKU migration.');
    const jobs=sources.flatMap(s=>['with-sticker','without-sticker'].map(variant=>({batch_id:id,source_id:s.id,sku:s.row.sku,variant,input:s.row,source_path:`${id}/sources/${s.id}.png`,status:'queued'})));
    const {error:jobError}=await skuStore().from('sku_image_jobs').insert(jobs);
    if(jobError)throw new Error('Unable to create SKU tasks.');
    const uploads=[];
    for(const entry of paths){
      const {data,error}=await skuStore().storage.from(SKU_BUCKET).createSignedUploadUrl(entry.path);
      if(error || !data)throw new Error('Unable to issue private upload URLs.');
      uploads.push({...entry,token:data.token});
    }
    return NextResponse.json({batchId:id,uploads});
  }catch(error){return NextResponse.json({error:error instanceof z.ZodError?'Invalid batch input.':error instanceof Error?error.message:'Unable to create batch.'},{status:400});}
}
