import { skuAccess } from '@/lib/sku-images/auth';
import ExcelJS from 'exceljs';
import { SKU_COLUMNS } from '@/lib/sku-images/types';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
  const denied=await skuAccess();if(denied)return denied;
  const wb=new ExcelJS.Workbook();const ws=wb.addWorksheet('Tasks');
  ws.addRow([...SKU_COLUMNS,'Item Type']);
  for(let i=1;i<=5;i++)ws.addRow([`CHRISTMAS-BADGE-${String(i).padStart(3,'0')}`,`IMG_${3419-i}.jpeg`,'Christmas Enamel Badge','No','Yes',20,'Christmas','Create a modern attractive cohesive Christmas ecommerce listing.','Enamel Badge with Christmas Gift Card']);
  ws.columns.forEach((c,i)=>c.width=i===7?65:25);ws.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};ws.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF164E63'}};ws.views=[{state:'frozen',ySplit:1}];
  const buffer=await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="hommly-sku-template.xlsx"','Cache-Control':'no-store'}});
}
