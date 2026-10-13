import sharp from 'sharp';
import { randomUUID, createHash } from 'crypto';
import { skuStore, readAsset } from './store';
import { SKU_BUCKET, type SkuInput } from './types';
export type BrandKind = 'logo' | 'halal';
export type BrandAsset = { id:string; kind:BrandKind; path:string|null; filename:string|null; sha256:string|null; bytes:number|null; width:number|null; height:number|null; created_at:string; removed:boolean; previewUrl?:string };
export const BRAND_MAX_BYTES=3*1024*1024;
export async function validateBrandImage(body:Buffer,mime:string) {
  if(!['image/png','image/jpeg','image/webp'].includes(mime))throw new Error('Use PNG, JPEG or WebP.');
  if(!body.length || body.length>BRAND_MAX_BYTES)throw new Error('Brand assets must be below 3 MB.');
  try {
    const image=sharp(body,{limitInputPixels:25_000_000,failOn:'warning'});const m=await image.metadata();
    const expected={ 'image/png':'png','image/jpeg':'jpeg','image/webp':'webp' }[mime];
    if(m.format!==expected || !m.width || !m.height || (m.pages || 1)>1)throw new Error();
    const png=await image.rotate().png().toBuffer();
    if(png.length>20*1024*1024)throw new Error();
    const normalized=await sharp(png).metadata();
    return {png,width:normalized.width!,height:normalized.height!};
  }catch{throw new Error('Invalid, damaged, animated or oversized image.');}
}
export async function currentBrandAssets():Promise<{logo:BrandAsset|null;halal:BrandAsset|null}> {
  const {data,error}=await skuStore().from('sku_brand_asset_current').select('kind,asset:sku_brand_asset_versions(*)');
  if(error)throw new Error('Brand Assets storage is not ready. Apply the Brand Assets migration.');
  const result:{logo:BrandAsset|null;halal:BrandAsset|null}={logo:null,halal:null};
  for(const item of data || []){const asset=(Array.isArray(item.asset)?item.asset[0]:item.asset) as unknown as BrandAsset;if(asset && !asset.removed)result[item.kind as BrandKind]=asset;}
  return result;
}
export async function replaceBrandAsset(kind:BrandKind,file:{body:Buffer;mime:string;filename:string}|null) {
  const id=randomUUID();let path:string|null=null;let metadata={};
  if(file){const image=await validateBrandImage(file.body,file.mime);path=`brand-assets/${kind}/${id}.png`;
    const {error}=await skuStore().storage.from(SKU_BUCKET).upload(path,image.png,{upsert:false,contentType:'image/png'});
    if(error)throw new Error('Could not persist brand asset.');
    metadata={filename:file.filename.slice(0,200),sha256:createHash('sha256').update(image.png).digest('hex'),bytes:image.png.length,width:image.width,height:image.height};
  }
  // Publishing the version and switching the current pointer is one DB transaction.
  const {error}=await skuStore().rpc('publish_sku_brand_asset',{asset_id:id,asset_kind:kind,asset_path:path,asset_metadata:metadata});
  if(error){if(path)await skuStore().storage.from(SKU_BUCKET).remove([path]);throw new Error('Could not save brand asset version.');}
  return id;
}
export function resolveBatchBrandAssets(assets:{logo:BrandAsset|null;halal:BrandAsset|null},rows:SkuInput[]) {
  if(!assets.logo?.path)throw new Error('Official Hommly Logo is missing. Ask an administrator to configure Brand Assets.');
  const affected=rows.filter(r=>r.halal);
  if(affected.length && !assets.halal?.path)throw new Error(`Authorized Halal Mark is missing. Blocked Halal Yes rows: ${affected.map(r=>r.sku).join(', ')}. Ask an administrator to configure Brand Assets.`);
  return {logo_path:assets.logo.path,logo_asset_id:assets.logo.id,halal_path:affected.length?assets.halal!.path:null,halal_asset_id:affected.length?assets.halal!.id:null};
}
export async function batchBrandSnapshot(rows:SkuInput[]) {
  const resolved=resolveBatchBrandAssets(await currentBrandAssets(),rows);
  // Detect missing/corrupt persisted assets before accepting a batch.
  await readAsset(resolved.logo_path);if(resolved.halal_path)await readAsset(resolved.halal_path);
  return resolved;
}
