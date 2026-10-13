import { redirect } from 'next/navigation';
import { isSkuStaffAuthenticated } from '@/lib/sku-images/staff-auth';
import { SkuImagesClient } from '@/components/admin/SkuImagesClient';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};
export default async function StaffSku(){if(!await isSkuStaffAuthenticated())redirect('/staff/login');if(process.env.SKU_IMAGES_ENABLED!=='true')return <p>SKU tool is not enabled.</p>;return <SkuImagesClient staff/>;}
