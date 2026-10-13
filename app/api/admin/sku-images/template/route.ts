import { skuAccess } from '@/lib/sku-images/auth';
import ExcelJS from 'exceljs';
import { SKU_COLUMNS } from '@/lib/sku-images/types';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
  const denied=await skuAccess();if(denied)return denied;
  const wb=new ExcelJS.Workbook();const ws=wb.addWorksheet('Tasks');
  ws.addRow([...SKU_COLUMNS]);
  for(let i=1;i<=5;i++)ws.addRow([`IMG_${3419-i}.jpeg`,'','Enamel Badge with Christmas Gift Card','No','Yes',20,'']);
  ws.columns.forEach((c,i)=>c.width=i===6?65:30);ws.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};ws.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF164E63'}};ws.views=[{state:'frozen',ySplit:1}];
  const help=wb.addWorksheet('Instructions');
  help.addRows([['Field','How to fill'],['Image File','Use the uploaded photo filename. Case and extension differences are matched.'],['Product Name','Optional. Leave blank to use Item Type without inventing a name.'],['Item Type','For example: Enamel Badge with Christmas Gift Card. Required if Product Name is blank.'],['Halal','Yes adds the saved authorized Halal Mark; No does not.'],['Name Sticker','Yes produces with-sticker and without-sticker variants. No produces only without-sticker.'],['Sticker Limit','Maximum customizable name characters (1–100). Default 20.'],['Special Notes','Optional extra prompt instructions in Chinese or English. Leave blank for the standard modern ecommerce style.'],['Theme','Choose the theme once on the webpage.'],['SKU / Status','Automatically managed by the system. No need to fill these.'],['Brand Assets','Configure Logo and authorized Halal Mark once in Brand Assets settings.']]);
  help.columns=[{width:22},{width:100}];help.getColumn(2).alignment={wrapText:true};help.getRow(1).font={bold:true};
  for(let i=2;i<=6;i++){ws.getCell(`D${i}`).dataValidation={type:'list',allowBlank:false,formulae:['"Yes,No"']};ws.getCell(`E${i}`).dataValidation={type:'list',allowBlank:false,formulae:['"Yes,No"']};ws.getCell(`F${i}`).dataValidation={type:'whole',operator:'between',allowBlank:true,formulae:[1,100]};}
  const buffer=await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="hommly-sku-template.xlsx"','Cache-Control':'no-store'}});
}
