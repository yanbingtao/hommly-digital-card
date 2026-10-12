import { NextResponse } from 'next/server';
import { skuAccess } from '@/lib/sku-images/auth';
import { readBatch, readJobs, skuStore, uuidPattern } from '@/lib/sku-images/store';
import { SKU_BUCKET } from '@/lib/sku-images/types';
export const dynamic='force-dynamic';
export async function GET(_:Request,{params}:{params:{id:string}}){
  const denied=await skuAccess();if(denied)return denied;
  try{
    const batch=await readBatch(params.id);const jobs=await readJobs(batch.id);
    for(const job of jobs){if(job.output_path){const {data}=await skuStore().storage.from(SKU_BUCKET).createSignedUrl(job.output_path,3600);job.outputUrl=data?.signedUrl;}}
    return NextResponse.json({batch,jobs},{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({error:'Batch not found.'},{status:404});}
}
export async function POST(request:Request,{params}:{params:{id:string}}){
  const denied=await skuAccess(request);if(denied)return denied;
  try{
    const batch=await readBatch(params.id);const body=await request.json();
    if(body.action==='ready'){
      const jobs=await readJobs(batch.id);
      const expected=Array.from(new Set(jobs.map(j=>j.source_path.split('/').pop())));
      const {data:sources,error}=await skuStore().storage.from(SKU_BUCKET).list(`${batch.id}/sources`,{limit:100});
      const {data:assets,error:assetError}=await skuStore().storage.from(SKU_BUCKET).list(`${batch.id}/assets`,{limit:10});
      if(error || assetError || !expected.every(n=>sources?.some(f=>f.name===n)) || !assets?.some(f=>f.name==='logo.png') || (batch.halal_path && !assets.some(f=>f.name==='halal.png')))return NextResponse.json({error:'Complete the image/logo uploads first.'},{status:400});
      const {error:updateError}=await skuStore().from('sku_image_batches').update({uploads_ready:true}).eq('id',batch.id);
      if(updateError)throw updateError;
    }else if(body.action==='retry' && typeof body.jobId==='string' && uuidPattern.test(body.jobId)){
      // Explicit retry only. Never automatically repeat an uncertain paid request.
      const {data:job}=await skuStore().from('sku_image_jobs').select('*').eq('id',body.jobId).eq('batch_id',batch.id).single();
      if(!job)return NextResponse.json({error:'Task not found.'},{status:404});
      const stale=job.status==='running' && Date.now()-Date.parse(job.started_at)>10*60*1000;
      if(!['failed','needs_review'].includes(job.status) && !stale)return NextResponse.json({error:'Task cannot be retried in its current state.'},{status:409});
      const {error}=await skuStore().from('sku_image_jobs').update({status:'queued',error:null,started_at:null}).eq('id',job.id).eq('status',job.status);
      if(error)throw error;
    }else return NextResponse.json({error:'Invalid action.'},{status:400});
    return NextResponse.json({ok:true});
  }catch{return NextResponse.json({error:'Could not update batch.'},{status:400});}
}
