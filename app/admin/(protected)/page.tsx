import Link from 'next/link';
import { Gift, Images, ArrowRight } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { AdminLogoutButton } from '@/components/admin/AdminLogoutButton';
export const dynamic='force-dynamic';
export const metadata={title:'Admin Portal | Hommly',robots:{index:false,follow:false}};
export default function AdminPortal(){
  return <main className="min-h-screen bg-[#fdf8f3] px-5 py-10"><div className="mx-auto max-w-4xl"><header className="flex items-center justify-between"><BrandLogo /><AdminLogoutButton /></header><h1 className="mt-12 text-3xl font-bold text-stone-800">Admin Portal</h1><p className="mt-3 text-stone-500">Choose the tool you want to use.</p><div className="mt-8 grid gap-6 sm:grid-cols-2">{[{href:'/admin/cards',title:'eCard Management',description:'Create and manage digital gift cards, buyer links and recipient QR codes.',Icon:Gift},{href:'/admin/sku-images',title:'SKU Image Generator',description:'Create modern product listing images from Excel and product photos.',Icon:Images}].map(({href,title,description,Icon})=><Link key={href} href={href} className="rounded-2xl border border-stone-200 bg-white p-7 shadow-sm transition hover:border-rose-300 hover:shadow-md"><Icon className="h-9 w-9 text-rose-400"/><h2 className="mt-5 text-xl font-semibold">{title}</h2><p className="mt-3 text-sm leading-relaxed text-stone-500">{description}</p><span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-rose-700">Open <ArrowRight className="h-4 w-4"/></span></Link>)}</div><Link href="/" className="mt-8 inline-block text-sm text-stone-500 hover:underline">Back to Hommly</Link></div></main>;
}
