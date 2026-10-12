import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { skuAccess } from '@/lib/sku-images/auth';
import { readBatch, readJobs, saveAsset, skuStore, uuidPattern } from '@/lib/sku-images/store';
import { generateSkuImage } from '@/lib/sku-images/generate';
import type { SkuJob, SkuBatch } from '@/lib/sku-images/types';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;
export async function POST(request:Request){
  const denied=await skuAccess(request);if(denied)return denied;
  let batchId:string;
  try{batchId=(await request.json()).batchId;if(!uuidPattern.test(batchId))throw new Error();}catch{return NextResponse.json({error:'Invalid batch ID.'},{status:400});}
  if(!process.env.OPENAI_API_KEY)return NextResponse.json({error:'OPENAI_API_KEY is not configured.'},{status:503});
  let batch:SkuBatch,jobs:SkuJob[];
  try{batch=await readBatch(batchId);jobs=await readJobs(batchId);}catch{return NextResponse.json({error:'Batch not found.'},{status:404});}
  if(!batch.uploads_ready)return NextResponse.json({error:'Uploads have not completed.'},{status:409});
  const running=jobs.find(j=>j.status==='running');
  if(running)return NextResponse.json({error:'A task is already running. Wait; if interrupted for over 10 minutes, review usage before explicitly retrying.'},{status:409});
  const job=jobs.find(j=>j.status==='queued');
  if(!job)return NextResponse.json({done:true});
  let source=job.source_path;
  if(job.variant==='without-sticker'){
    const first=jobs.find(j=>j.source_id===job.source_id && j.variant==='with-sticker');
    if(first?.status!=='succeeded' || !first.base_path){
      await skuStore().from('sku_image_jobs').update({status:'failed',error:'The with-sticker variant must succeed first; no API call was made.',completed_at:new Date().toISOString()}).eq('id',job.id).eq('status','queued');
      return NextResponse.json({processed:true,status:'failed'});
    }
    source=first.base_path;
  }
  const {data:claimed,error:claimError}=await skuStore().from('sku_image_jobs').update({status:'running',started_at:new Date().toISOString()}).eq('id',job.id).eq('status','queued').select('id');
  if(claimError || !claimed?.length)return NextResponse.json({error:'Another browser claimed a task. Refresh progress.'},{status:409});
  const encoder=new TextEncoder();let disconnected=false;
  const stream=new ReadableStream({
    async start(controller){
      const send=(value:unknown)=>{if(!disconnected){try{controller.enqueue(encoder.encode(JSON.stringify(value)+'\n'));}catch{disconnected=true;}}};
      send({working:true,sku:job.sku,variant:job.variant});
      const heartbeat=setInterval(()=>send({working:true}),15_000);
      try{
        const result=await generateSkuImage(batch,job,source);
        const basePath=`${batchId}/base/${job.id}-${Date.now()}.png`;const outputPath=`${batchId}/outputs/${job.id}-${Date.now()}.png`;
        await saveAsset(basePath,result.base);await saveAsset(outputPath,result.output);
        const {error}=await skuStore().from('sku_image_jobs').update({status:'succeeded',base_path:basePath,output_path:outputPath,error:null,completed_at:new Date().toISOString()}).eq('id',job.id).eq('status','running');
        if(error)throw new Error('Image saved but task status could not be recorded. Review before retrying.');
        send({processed:true,status:'succeeded'});
      }catch(error){
        const code=error instanceof OpenAI.APIError ? error.code || error.type || 'unknown' : 'processing_error';
        const stop=error instanceof OpenAI.APIError && [401,403,429].includes(error.status || 0);
        const message=error instanceof OpenAI.APIConnectionError ? 'Connection interrupted; review API usage before explicitly retrying.' : error instanceof OpenAI.APIError ? `OpenAI HTTP ${error.status}: ${code}. Check billing, model access and limits before retrying.` : error instanceof Error ? error.message : 'Image generation failed.';
        const uncertain=error instanceof OpenAI.APIConnectionError;
        await skuStore().from('sku_image_jobs').update({status:uncertain?'needs_review':'failed',error:message.slice(0,500),request_id:error instanceof OpenAI.APIError?error.requestID:null,completed_at:new Date().toISOString()}).eq('id',job.id).eq('status','running');
        send({processed:true,status:'failed',error:message,stop});
      }finally{clearInterval(heartbeat);if(!disconnected){try{controller.close();}catch{/* browser closed; persisted status remains */}}}
    },
    cancel(){disconnected=true;},
  });
  return new Response(stream,{headers:{'Content-Type':'application/x-ndjson','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
