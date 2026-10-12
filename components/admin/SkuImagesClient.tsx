'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { SKU_BUCKET, SKU_COLUMNS, SKU_MODELS, matchSkuImage, validateSkuInputs, type SkuInput, type SkuJob, type SkuBatch } from '@/lib/sku-images/types';
import { AdminLogoutButton } from './AdminLogoutButton';

async function api(path:string,body?:unknown){
  const response=await fetch(`/api/admin/sku-images/${path}`,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});
  const text=await response.text();let data;
  try{data=JSON.parse(text);}catch{throw new Error(`Server request failed (${response.status}). Check deployment configuration.`);}
  if(!response.ok)throw new Error(data.error || 'Request failed.');return data;
}
async function normalize(file:File):Promise<Blob>{
  if(file.size>100*1024*1024)throw new Error(`${file.name}: exceeds 100 MB.`);
  let source:Blob=file;
  if(/\.(heic|heif)$/i.test(file.name)||/hei[cf]/i.test(file.type)){
    const heic=(await import('heic2any')).default;const result=await heic({blob:file,toType:'image/png'});source=Array.isArray(result)?result[0]:result;
  }
  const url=URL.createObjectURL(source);
  try{
    const image=new Image();image.src=url;await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error(`${file.name}: cannot decode original image.`));});
    if(image.naturalWidth*image.naturalHeight>100_000_000)throw new Error(`${file.name}: image too large to decode.`);
    const scale=Math.min(1,2048/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);
    canvas.getContext('2d')!.drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Image conversion failed.')),'image/png'));
    if(blob.size>20*1024*1024)throw new Error(`${file.name}: normalized image exceeds 20 MB.`);return blob;
  }finally{URL.revokeObjectURL(url);}
}
function saveBlob(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}

export function SkuImagesClient(){
  const [rows,setRows]=useState<SkuInput[]>([]);const [files,setFiles]=useState<File[]>([]);
  const [logo,setLogo]=useState<File|null>(null);const [halalLogo,setHalalLogo]=useState<File|null>(null);
  const [model,setModel]=useState<string>(SKU_MODELS[0]);const [quality,setQuality]=useState('high');const [name,setName]=useState('Christmas listing test');
  const [error,setError]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const [running,setRunning]=useState(false);
  const [history,setHistory]=useState<SkuBatch[]>([]);const [batch,setBatch]=useState<SkuBatch|null>(null);const [jobs,setJobs]=useState<SkuJob[]>([]);const stop=useRef(false);
  const inputClass='mt-2 w-full rounded-lg border border-stone-200 bg-white p-3 text-sm';
  const buttonClass='rounded-lg bg-rose-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40';
  async function reloadHistory(){try{setHistory((await api('batches')).batches);}catch(e){setError(e instanceof Error?e.message:'Unable to load history.');}}
  useEffect(()=>{void reloadHistory();},[]);
  useEffect(()=>{if(!model.startsWith('gpt-image-2.5') && ['max','xhigh'].includes(quality))setQuality('high');},[model,quality]);
  async function refresh(id:string){const data=await api(`batches/${id}`);setBatch(data.batch);setJobs(data.jobs);return data as {batch:SkuBatch;jobs:SkuJob[]};}
  async function readExcel(file:File){
    setError('');setRows([]);
    try{
      if(file.size>5*1024*1024)throw new Error('Use an Excel file below 5 MB.');
      const {Workbook}=await import('exceljs');const workbook=new Workbook();await workbook.xlsx.load(await file.arrayBuffer());const sheet=workbook.worksheets[0];if(!sheet)throw new Error('Empty workbook.');
      const columns=new Map<string,number>();sheet.getRow(1).eachCell((cell,i)=>{const key=String(cell.value??'').trim();if(columns.has(key))throw new Error('Duplicate column names.');columns.set(key,i);});
      for(const column of SKU_COLUMNS)if(!columns.has(column))throw new Error(`Missing column: ${column}`);
      const result:SkuInput[]=[];
      sheet.eachRow((row,i)=>{if(i===1)return;const get=(key:string)=>{const v=row.getCell(columns.get(key) || 999).value;if(v && typeof v==='object')throw new Error(`Row ${i}: formulas/rich text are not supported in input cells.`);return String(v??'').trim();};if(SKU_COLUMNS.every(c=>!get(c)))return;
        if(!/^(yes|no)$/i.test(get('Halal')) || !/^(yes|no)$/i.test(get('Name Sticker')))throw new Error(`Row ${i}: Halal and Name Sticker must be Yes or No.`);
        result.push({sku:get('SKU'),imageFile:get('Image File'),productName:get('Product Name'),halal:/^yes$/i.test(get('Halal')),stickerLimit:Number(get('Sticker Limit')||20),theme:get('Theme'),notes:get('Special Notes'),itemType:columns.has('Item Type')?get('Item Type'):''});});
      const issues=validateSkuInputs(result);if(issues.length)throw new Error(issues.join('\n'));setRows(result);
    }catch(e){setError(e instanceof Error?e.message:'Cannot read workbook.');}
  }
  const matching=rows.map(row=>({row,matched:matchSkuImage(row.imageFile,files.map(f=>f.name))}));
  const ready=rows.length>0 && matching.every(m=>m.matched) && logo && (!rows.some(r=>r.halal)||halalLogo);
  async function createBatch(){
    if(!ready || !logo)return;setBusy(true);setError('');setMessage('Creating batch and uploading original images…');
    try{
      const data=await api('batches',{name,model,quality,halalLogo:!!halalLogo,rows});
      const storage=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
      for(let i=0;i<data.uploads.length;i++){
        const upload=data.uploads[i];const original=upload.kind==='logo'?logo:upload.kind==='halal'?halalLogo:files.find(f=>f.name===matching.find(m=>m.row.sku===upload.kind)?.matched);
        if(!original)throw new Error('Missing upload.');const blob=await normalize(original);
        const {error:uploadError}=await storage.storage.from(SKU_BUCKET).uploadToSignedUrl(upload.path,upload.token,blob,{contentType:'image/png'});
        if(uploadError)throw new Error(`Upload failed for ${original.name}.`);setMessage(`Uploaded ${i+1}/${data.uploads.length}`);
      }
      await api(`batches/${data.batchId}`,{action:'ready'});await refresh(data.batchId);await reloadHistory();setMessage('Uploads ready. Review the batch, then start paid generation.');
    }catch(e){setError(e instanceof Error?e.message:'Batch creation failed.');}finally{setBusy(false);}
  }
  async function runBatch(){
    if(!batch)return;const id=batch.id;setRunning(true);stop.current=false;setError('');
    try{
      while(!stop.current){
        const state=await refresh(id);if(!state.jobs.some(j=>j.status==='queued'))break;
        const response=await fetch('/api/admin/sku-images/process',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({batchId:id})});
        if(!response.ok){const data=await response.json();throw new Error(data.error || 'Generation failed.');}
        let result:any;
        if(response.headers.get('content-type')?.includes('ndjson')){
          const reader=response.body!.getReader();const decoder=new TextDecoder();let pending='';
          while(true){const {value,done}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true});let newline;
            while((newline=pending.indexOf('\n'))>=0){const line=pending.slice(0,newline);pending=pending.slice(newline+1);if(line){const event=JSON.parse(line);if(event.sku)setMessage(`Generating ${event.sku} / ${event.variant}…`);if(event.processed)result=event;}}
          }
          if(!result)throw new Error('Request ended without confirmation. Refresh status and review usage before retrying.');
        }else result=await response.json();
        await refresh(id);if(result.stop)throw new Error(result.error);if(result.done)break;
      }
      setMessage(stop.current?'Paused after the current image. Queued tasks are saved.':'Batch processing finished.');
    }catch(e){setError(e instanceof Error?e.message:'Generation interrupted.');await refresh(id).catch(()=>{});}finally{setRunning(false);void reloadHistory();}
  }
  async function downloadZip(){
    if(!batch)return;setBusy(true);setError('');
    try{const state=await refresh(batch.id);const JSZip=(await import('jszip')).default;const zip=new JSZip();
      for(const job of state.jobs){if(job.outputUrl){const response=await fetch(job.outputUrl);if(!response.ok)throw new Error('Download failed. Refresh and retry.');zip.file(`${job.sku}__${job.variant}.png`,await response.arrayBuffer());}}
      zip.file('report.json',JSON.stringify(state.jobs.map(({outputUrl,...j})=>j),null,2));saveBlob(await zip.generateAsync({type:'blob'}),`hommly-${batch.id}.zip`);
    }catch(e){setError(e instanceof Error?e.message:'Download failed.');}finally{setBusy(false);}
  }
  return <main className="min-h-screen bg-[#fdf8f3] px-5 py-8"><div className="mx-auto max-w-6xl"><header className="flex items-center justify-between"><Link href="/admin" className="text-sm text-stone-600 hover:underline">← Admin Portal</Link><AdminLogoutButton/></header><h1 className="mt-8 text-3xl font-bold">SKU Image Generator</h1><p className="mt-3 text-stone-600">Internal batch tool. One photo → two modern square listing images, with subtle hommly.sg watermarks.</p>
    {error&&<div role="alert" className="mt-5 whitespace-pre-line rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}{message&&<p role="status" className="mt-4 text-sm text-emerald-800">{message}</p>}
    <section className="mt-7 rounded-2xl border bg-white p-6"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">New batch</h2><a href="/api/admin/sku-images/template" className="text-sm underline">Download Excel template</a></div><div className="mt-5 grid gap-5 md:grid-cols-2">
      <label>Batch name<input className={inputClass} value={name} onChange={e=>setName(e.target.value)} maxLength={100}/></label>
      <label>Excel tasks<input className={inputClass} type="file" accept=".xlsx" disabled={busy||running} onChange={e=>{if(e.target.files?.[0])void readExcel(e.target.files[0]);}}/></label>
      <label>Original product photos<input className={inputClass} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.heic,.heif" disabled={busy||running} onChange={e=>setFiles(Array.from(e.target.files||[]))}/><span className="text-xs text-stone-500">iPhone originals are converted automatically. File extension and case differences are matched.</span></label>
      <label>Official brand logo<input className={inputClass} type="file" accept=".jpg,.jpeg,.png,.webp" onChange={e=>setLogo(e.target.files?.[0]||null)}/></label>
      <label>Halal mark (required only for Halal Yes)<input className={inputClass} type="file" accept=".jpg,.jpeg,.png,.webp" onChange={e=>setHalalLogo(e.target.files?.[0]||null)}/></label>
      <div className="grid grid-cols-2 gap-3"><label>Model<select className={inputClass} value={model} onChange={e=>setModel(e.target.value)}>{SKU_MODELS.map(m=><option key={m}>{m}</option>)}</select></label><label>Quality<select className={inputClass} value={quality} onChange={e=>setQuality(e.target.value)}>{(model.startsWith('gpt-image-2.5')?['low','medium','high','xhigh','max']:['low','medium','high']).map(q=><option key={q}>{q}</option>)}</select></label></div>
    </div>{rows.length>0&&<div className="mt-6 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">SKU</th><th className="p-2">Product</th><th className="p-2">Matched photo</th></tr></thead><tbody>{matching.map(({row,matched})=><tr key={row.sku} className="border-t"><td className="p-2">{row.sku}</td><td className="p-2">{row.productName}</td><td className={`p-2 ${!matched?'text-red-700':''}`}>{matched||`Missing: ${row.imageFile}`}</td></tr>)}</tbody></table></div>}<p className="mt-5 text-sm text-stone-500">{rows.length} source rows → {rows.length*2} outputs. Uploading does not call OpenAI. Maximum 100 sources per batch.</p><button className={`${buttonClass} mt-4`} disabled={!ready||busy||running||!name.trim()} onClick={()=>void createBatch()}>Create batch and upload photos</button></section>
    <section className="mt-7 rounded-2xl border bg-white p-6"><h2 className="text-xl font-semibold">Saved batches</h2><div className="mt-4 flex flex-wrap gap-3"><select aria-label="Saved batch" className="max-w-full rounded-lg border p-3 text-sm" disabled={running||busy} value={batch?.id||''} onChange={e=>{if(e.target.value)void refresh(e.target.value).catch(err=>setError(err.message));}}><option value="">Select a batch</option>{history.map(b=><option key={b.id} value={b.id}>{b.name} · {new Date(b.created_at).toLocaleString()}</option>)}</select><button className="text-sm underline" disabled={running} onClick={()=>void reloadHistory()}>Refresh history</button></div>
    {batch&&<><p className="mt-5 text-sm">{batch.model} / {batch.quality} · {jobs.filter(j=>j.status==='succeeded').length}/{jobs.length} completed</p><p className="mt-2 text-sm text-stone-500">Each queued variant makes one paid OpenAI edit. Keep this page open while processing. Pause stops after the current image; completed results and queued tasks persist. No automatic retries of timed-out paid requests.</p><div className="mt-4 flex flex-wrap gap-3"><button className={buttonClass} disabled={running||busy||!batch.uploads_ready||!jobs.some(j=>j.status==='queued')} onClick={()=>void runBatch()}>{running?'Generating…':'Start / resume paid generation'}</button>{running&&<button className="rounded-lg border px-4 py-2" onClick={()=>{stop.current=true;setMessage('Stopping after the current image…');}}>Pause after current image</button>}<button className="rounded-lg border px-4 py-2" disabled={busy||running} onClick={()=>void refresh(batch.id).catch(e=>setError(e.message))}>Refresh progress</button><button className="rounded-lg border px-4 py-2" disabled={busy||running||!jobs.some(j=>j.outputUrl)} onClick={()=>void downloadZip()}>Download ZIP + report</button></div>
    <div className="mt-6 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">SKU / variant</th><th className="p-2">Status</th><th className="p-2">Detail</th></tr></thead><tbody>{jobs.map(j=><tr key={j.id} className="border-t"><td className="p-2">{j.sku}<br/>{j.variant}</td><td className="p-2">{j.status}</td><td className="p-2">{j.error}{(['failed','needs_review'].includes(j.status)||(j.status==='running'&&j.started_at&&Date.now()-Date.parse(j.started_at)>600000))&&<button className="ml-3 underline" disabled={running||busy} onClick={()=>{if(window.confirm('Retry may create another API charge. Check OpenAI usage first if the earlier request timed out. Retry this variant?'))void api(`batches/${batch.id}`,{action:'retry',jobId:j.id}).then(()=>refresh(batch.id)).catch(e=>setError(e.message));}}>Queue explicit retry</button>}</td></tr>)}</tbody></table></div>
    <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{jobs.filter(j=>j.outputUrl).map(j=><figure key={j.id} className="overflow-hidden rounded-xl border"><img src={j.outputUrl} alt={`${j.sku} ${j.variant}`} className="aspect-square w-full object-contain"/><figcaption className="p-3 text-sm">{j.sku} · {j.variant}<button className="ml-3 underline" disabled={busy} onClick={()=>{void fetch(j.outputUrl!).then(r=>{if(!r.ok)throw new Error();return r.blob();}).then(b=>saveBlob(b,`${j.sku}__${j.variant}.png`)).catch(()=>setError('Refresh progress and retry download.'));}}>Download</button></figcaption></figure>)}</div></>}
    </section></div></main>;
}
