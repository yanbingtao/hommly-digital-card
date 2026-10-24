import { describe, it, expect, vi, beforeEach } from 'vitest';
import sharp from 'sharp';
import { validateSkuInputs, matchSkuImage, type SkuInput } from './types';
import { skuPrompt } from './prompt';
import { renderWatermarkOverlayPng, watermarkSkuImage } from './generate';
import { analyzeWatermarkOverlayPng } from './watermark-analysis';
import {
  buildWatermarkOverlaySvg,
  WATERMARK_POSITIONS,
  WATERMARK_TEXT,
} from './watermark-markup';
const { auth }=vi.hoisted(()=>({auth:vi.fn()}));
vi.mock('@/lib/admin-auth',()=>({isAdminAuthenticated:auth}));
import { skuAccess } from './auth';
const row:SkuInput={sku:'CHRISTMAS-001',imageFile:'IMG_3418.jpeg',productName:'Star Badge',halal:false,stickerLimit:20,theme:'Christmas',notes:'Keep card and product design.',itemType:'Enamel Badge with Christmas Gift Card'};
describe('internal SKU validation and approved design',()=>{
  it('supports 100 source photos and rejects duplicate SKUs',()=>{expect(validateSkuInputs(Array.from({length:100},(_,i)=>({...row,sku:`SKU-${i}`})))).toEqual([]);expect(validateSkuInputs([row,{...row,sku:'christmas-001'}])).toContain('Row 3: duplicate SKU.');});
  it('rejects path-like output SKUs and invalid limits',()=>{expect(validateSkuInputs([{...row,sku:'../outside',stickerLimit:101}]).length).toBe(2);});
  it('matches iPhone case and extensions without guessing ambiguous names',()=>{expect(matchSkuImage('IMG_3418.jpeg',['img_3418.HEIC'])).toBe('img_3418.HEIC');expect(matchSkuImage('IMG_3418.jpeg',['IMG_3418.jpg','IMG_3418.heic'])).toBeNull();});
  it('generates a unified modern scene with badge caption and original logo reference',()=>{const prompt=skuPrompt(row,'with-sticker',false);expect(prompt).toContain('ONE unified image');expect(prompt).toContain('Enamel Badge with Christmas Gift Card');expect(prompt).toContain('Maximum 20 characters');expect(prompt).toContain('18–22%');expect(prompt).toContain('Do not add halal');});
  it('removes the physical sticker, not just its lettering',()=>{const prompt=skuPrompt(row,'without-sticker',false);expect(prompt).toContain('entire physical adhesive name sticker');expect(prompt).toContain('paper, edges');expect(prompt).toContain('Remove customization callouts');});
  it('adds subtle watermark pixels without changing dimensions or corners',async()=>{const source=await sharp({create:{width:1024,height:1024,channels:3,background:'#646464'}}).png().toBuffer();const output=await watermarkSkuImage(source);const meta=await sharp(output).metadata();expect(meta.width).toBe(1024);expect(meta.height).toBe(1024);expect(output.equals(source)).toBe(false);const pixels=await sharp(output).raw().toBuffer();expect(Array.from(pixels.subarray(0,3))).toEqual([100,100,100]);});
  it('uses path-based watermark markup without runtime font text',()=>{const svg=buildWatermarkOverlaySvg(1024);expect(WATERMARK_TEXT).toBe('hommly.sg');expect(WATERMARK_POSITIONS).toEqual([[0.46,0.30],[0.56,0.55],[0.46,0.77]]);expect(svg).not.toMatch(/<text[^>]*font-family/i);expect(svg.match(/<path /g)?.length).toBe(3);});
  it('sharp-rendered watermark has letter-like horizontal stroke peaks',async()=>{const overlay=await renderWatermarkOverlayPng(1024);const analysis=await analyzeWatermarkOverlayPng(overlay);expect(analysis.width).toBe(1024);expect(analysis.height).toBe(1024);expect(analysis.alphaPixelCount).toBeGreaterThan(400);expect(analysis.peakSumAtMarkCenters).toBeGreaterThan(60);expect(analysis.peaksAtBottomMark).toBeGreaterThan(14);const legacyMarks=[[0.46,0.30],[0.56,0.55],[0.46,0.77]].map(([x,y])=>`<text x="${Math.round(x*1024)}" y="${Math.round(y*1024)}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="26" fill="white" fill-opacity="0.173" stroke="#282828" stroke-opacity="0.102" stroke-width="1" paint-order="stroke">hommly.sg</text>`).join('');const legacySvg=`<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">${legacyMarks}</svg>`;const legacyPng=await sharp(Buffer.from(legacySvg)).png().toBuffer();const legacy=await analyzeWatermarkOverlayPng(legacyPng);expect(analysis.peakSumAtMarkCenters).toBeGreaterThanOrEqual(Math.min(legacy.peakSumAtMarkCenters,24));});
});
describe('SKU administrator boundary',()=>{
  beforeEach(()=>{vi.stubEnv('SKU_IMAGES_ENABLED','true');auth.mockResolvedValue(true);});
  it('blocks unauthenticated APIs',async()=>{auth.mockResolvedValue(false);expect((await skuAccess())?.status).toBe(401);});
  it('blocks cross-site paid mutations',async()=>{expect((await skuAccess(new Request('https://hommly.online/api/admin/sku-images/process',{method:'POST',headers:{origin:'https://elsewhere.example'}})))?.status).toBe(403);});
  it('allows authenticated same-origin use',async()=>{expect(await skuAccess(new Request('https://hommly.online/api/admin/sku-images/process',{method:'POST',headers:{origin:'https://hommly.online'}}))).toBeNull();});
  it('can disable the whole new tool without affecting card endpoints',async()=>{vi.stubEnv('SKU_IMAGES_ENABLED','false');expect((await skuAccess())?.status).toBe(503);});
});
