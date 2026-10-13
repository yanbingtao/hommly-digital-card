 'use client';
import { useEffect,useState } from 'react';
import Link from 'next/link';
import type { BrandAsset,BrandKind } from '@/lib/sku-images/brand-assets';
export function BrandAssetsClient(){
 const [assets,setAssets]=useState<{logo:BrandAsset|null;halal:BrandAsset|null}>({logo:null,halal:null});const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 async function load(){const r=await fetch('/api/admin/sku-images/brand-assets',{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error);setAssets(d.assets);}
 useEffect(()=>{void load().catch(e=>setError(e.message));},[]);
 async function change(kind:BrandKind,file:File|null){
 if(!file && !window.confirm('Remove this global asset for future batches? Historical batches keep their original version.'))return;
 if(file && kind==='halal' && !window.confirm('Confirm this is an authorized Halal Mark that Hommly has permission to use.'))return;
 setBusy(true);setError('');setMessage('');try{const form=new FormData();form.set('kind',kind);form.set('action',file?'replace':'remove');if(file){form.set('file',file);form.set('authorized','true');}
 const r=await fetch('/api/admin/sku-images/brand-assets',{method:'POST',body:form});const d=await r.json();if(!r.ok)throw new Error(d.error);await load();setMessage('Saved. Future batches use this setting; existing batches retain their original versions.');
 }catch(e){setError(e instanceof Error?e.message:'Unable to save.');}finally{setBusy(false);}}
 return <main className="mx-auto max-w-4xl p-8"><Link href="/admin/sku-images" className="underline">← SKU Image Generator</Link><h1 className="mt-6 text-3xl font-bold">Brand Assets</h1><p className="mt-3 text-stone-600">Configure reusable assets once. PNG, JPEG or WebP, below 3 MB. Historical batch versions are retained.</p>{error&&<p role="alert" className="mt-4 text-red-700">{error}</p>}{message&&<p role="status" className="mt-4 text-green-700">{message}</p>}<div className="mt-6 grid gap-6 sm:grid-cols-2">{(['logo','halal'] as const).map(kind=><section key={kind} className="rounded-xl border bg-white p-5"><h2 className="text-xl font-semibold">{kind==='logo'?'Official Hommly Logo':'Authorized Halal Mark'}</h2>{assets[kind]?<><img className="mt-4 h-40 w-full object-contain" alt={kind==='logo'?'Saved Hommly Logo':'Saved Halal Mark'} src={assets[kind]!.previewUrl}/><p className="mt-3 break-all text-sm">{assets[kind]!.filename}</p><p className="text-xs text-stone-500">Version {assets[kind]!.id} · {new Date(assets[kind]!.created_at).toLocaleString()}</p><button className="mt-3 text-rose-700 underline" disabled={busy} onClick={()=>void change(kind,null)}>Remove {kind==='logo'?'Logo':'Halal Mark'}</button></>:<p className="mt-4 text-stone-500">Not configured</p>}<label className="mt-5 block text-sm">{assets[kind]?'Replace':'Upload'} {kind==='logo'?'Logo':'Halal Mark'}<input className="mt-2 block w-full" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void change(kind,f);}}/></label></section>)}</div></main>;
}
