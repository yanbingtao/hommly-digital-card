import { skuStore,uuidPattern } from './store';
import { SKU_BUCKET } from './types';
/** Only the exact UUID batch namespace is eligible; global brand-assets is never traversed. */
export async function deleteTemporaryBatchFiles(id:string){
 if(!uuidPattern.test(id))throw new Error('Invalid temporary batch namespace.');
 const storage=skuStore().storage.from(SKU_BUCKET);
 const directories=[id];let removed=0;
 while(directories.length){const prefix=directories.shift()!;let offset=0;const paths:string[]=[];
  // List everything before deleting so offset pagination cannot skip shifted objects.
  while(true){const {data,error}=await storage.list(prefix,{limit:1000,offset,sortBy:{column:'name',order:'asc'}});if(error)throw new Error('Cannot list temporary images.');
   for(const item of data || []){if(!item.name || item.name.includes('/') || item.name==='.' || item.name==='..')throw new Error('Invalid storage object name.');const path=`${prefix}/${item.name}`;if(item.id)paths.push(path);else directories.push(path);}
   if((data || []).length<1000)break;offset+=1000;
  }
  for(let i=0;i<paths.length;i+=100){const slice=paths.slice(i,i+100);const {error}=await storage.remove(slice);if(error)throw new Error('Cannot remove temporary images.');removed+=slice.length;}
 }
 return removed;
}
export async function cleanupExpiredSkuTasks(){
 const result={batchesDeleted:0,filesDeleted:0,skipped:0,errors:[] as string[]};
 if(process.env.SKU_IMAGES_ENABLED!=='true')return result;
 // Bound each cron invocation. Failed deletions retain records for safe retry.
 const {data,error}=await skuStore().from('sku_image_batches').select('id').lte('expires_at',new Date().toISOString()).order('expires_at').limit(100);
 if(error)throw new Error('Cannot read temporary SKU expiry.');
 for(const batch of data || []){try{
  const {data:claimed,error:claimError}=await skuStore().rpc('begin_sku_image_cleanup',{p_batch_id:batch.id});if(claimError)throw new Error('Cannot claim expired task.');if(!claimed){result.skipped++;continue;}
  result.filesDeleted+=await deleteTemporaryBatchFiles(batch.id);
  const {error:deleteError}=await skuStore().from('sku_image_batches').delete().eq('id',batch.id).not('cleanup_started_at','is',null);
  if(deleteError)throw new Error('Cannot remove expired task records.');result.batchesDeleted++;
 }catch{result.errors.push(batch.id);}}
 return result;
}
