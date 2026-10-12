import { SkuImagesClient } from '@/components/admin/SkuImagesClient';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Internal SKU Images | Hommly', robots: { index:false, follow:false } };
export default async function SkuImagesPage() {
  if (!(await isAdminAuthenticated())) redirect('/admin/login?next=/admin/sku-images');
  if (process.env.SKU_IMAGES_ENABLED !== 'true') return <main className="mx-auto max-w-3xl p-8"><h1 className="text-2xl font-bold">SKU Image Generator</h1><p className="mt-4">This internal tool is not enabled yet.</p><a href="/admin/cards" className="underline">Back to Digital Cards</a></main>;
  return <SkuImagesClient />;
}
