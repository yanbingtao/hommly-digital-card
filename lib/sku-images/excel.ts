import type { Worksheet } from 'exceljs';
import { SKU_COLUMNS,validateSkuInputs,type SkuInput } from './types';
export function readSkuWorksheet(sheet:Worksheet,theme:string):SkuInput[]{
 const columns=new Map<string,number>();sheet.getRow(1).eachCell((cell,i)=>{const key=String(cell.value??'').trim();if(columns.has(key))throw new Error('Duplicate column names.');columns.set(key,i);});
 for(const column of ['Image File','Halal','Name Sticker','Sticker Limit'])if(!columns.has(column))throw new Error(`Missing column: ${column}`);
 const result:SkuInput[]=[];
 sheet.eachRow((row,i)=>{if(i===1)return;const get=(key:string)=>{const col=columns.get(key);if(!col)return '';const value=row.getCell(col).value;if(value&&typeof value==='object')throw new Error(`Row ${i}: formulas/rich text are not supported in input cells.`);return String(value??'').trim();};
 if(SKU_COLUMNS.every(c=>!get(c)))return;
 if(!/^(yes|no)$/i.test(get('Halal'))||!/^(yes|no)$/i.test(get('Name Sticker')))throw new Error(`Row ${i}: Halal and Name Sticker must be Yes or No.`);
 result.push({sku:get('SKU')||`IMAGE-${String(result.length+1).padStart(3,'0')}`,imageFile:get('Image File'),productName:get('Product Name'),itemType:get('Item Type'),halal:/^yes$/i.test(get('Halal')),nameSticker:/^yes$/i.test(get('Name Sticker')),stickerLimit:Number(get('Sticker Limit')||20),theme:get('Theme')||theme,notes:get('Special Notes')});
 });const issues=validateSkuInputs(result);if(issues.length)throw new Error(issues.join('\n'));return result;
}
