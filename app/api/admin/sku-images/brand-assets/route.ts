import { NextResponse } from 'next/server';
import { skuAccess } from '@/lib/sku-images/auth';
import { currentBrandAssets,replaceBrandAsset,BRAND_MAX_BYTES } from '@/lib/sku-images/brand-assets';
import { skuStore } from '@/lib/sku-images/store';
import { SKU_BUCKET } from '@/lib/sku-images/types';
import { isAdminAuthenticated } from '@/lib/admin-auth';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(){
 const denied=await skuAccess();if(denied)return denied;
 try{const assets=await currentBrandAssets();for(const asset of Object.values(assets)){if(asset?.path){const {data,error}=await skuStore().storage.from(SKU_BUCKET).createSignedUrl(asset.path,600);if(error)throw new Error('Cannot preview brand asset.');asset.previewUrl=data?.signedUrl;}}
 return NextResponse.json({assets,canManage:await isAdminAuthenticated()},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Cannot load Brand Assets.'},{status:503});}
}
export async function POST(request:Request){
 const denied=await skuAccess(request,true);if(denied)return denied;
 try{
 if(Number(request.headers.get('content-length'))>BRAND_MAX_BYTES+100_000)return NextResponse.json({error:'Brand assets must be below 3 MB.'},{status:413});
 const reader=request.body?.getReader();if(!reader)throw new Error('Missing upload.');let size=0;const parts:Uint8Array[]=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>BRAND_MAX_BYTES+100_000){await reader.cancel();return NextResponse.json({error:'Brand assets must be below 3 MB.'},{status:413});}parts.push(value);}
 const form=await new Request(request.url,{method:'POST',headers:{'Content-Type':request.headers.get('content-type') || ''},body:Buffer.concat(parts)}).formData();
 const kind=form.get('kind');if(kind!=='logo'&&kind!=='halal')throw new Error('Invalid asset kind.');
 const action=form.get('action');if(action!=='replace'&&action!=='remove')throw new Error('Invalid action.');
 const file=form.get('file');if(action==='replace' && (!file || typeof file==='string'))throw new Error('Select an image.');
 if(kind==='halal' && action==='replace' && form.get('authorized')!=='true')throw new Error('Confirm you are authorized to use this Halal Mark.');
 const id=await replaceBrandAsset(kind,action==='remove'?null:{body:Buffer.from(await (file as File).arrayBuffer()),mime:(file as File).type,filename:(file as File).name});
 return NextResponse.json({ok:true,id});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Cannot save Brand Asset.'},{status:400});}
}
