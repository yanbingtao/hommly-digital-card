import { it,expect,vi } from 'vitest';
import sharp from 'sharp';
const calls=vi.hoisted(()=>({edit:vi.fn(),read:vi.fn()}));
vi.mock('openai',()=>({default:class{images={edit:calls.edit};},toFile:async(body:Buffer,name:string)=>({body,name})}));
vi.mock('./store',()=>({readAsset:calls.read}));
import { generateSkuImage } from './generate';
it('reads historical logo paths and attaches Halal reference only for Yes rows',async()=>{
 process.env.OPENAI_API_KEY='test-only';const png=await sharp({create:{width:1024,height:1024,channels:4,background:'white'}}).png().toBuffer();calls.read.mockResolvedValue(png);calls.edit.mockResolvedValue({data:[{b64_json:png.toString('base64')}]});
 const batch:any={model:'gpt-image-2',quality:'high',logo_path:'brand-assets/logo/historical.png',halal_path:'brand-assets/halal/historical.png'};
 const job:any={variant:'with-sticker',input:{productName:'Badge',itemType:'Badge',theme:'Christmas',notes:'',halal:false,stickerLimit:20}};
 await generateSkuImage(batch,job,'source.png');expect(calls.edit.mock.calls[0][0].image.map((f:any)=>f.name)).toEqual(['source.png','brand-logo.png']);expect(calls.read).toHaveBeenCalledWith(batch.logo_path);
 await generateSkuImage(batch,{...job,input:{...job.input,halal:true}},'source.png');expect(calls.edit.mock.calls[1][0].image.map((f:any)=>f.name)).toEqual(['source.png','brand-logo.png','halal-logo.png']);
});
