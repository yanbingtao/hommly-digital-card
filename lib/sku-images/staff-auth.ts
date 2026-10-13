import crypto from 'crypto';
import { cookies } from 'next/headers';
export const STAFF_COOKIE='hommly_sku_staff_session';
export function staffToken(){const u=process.env.SKU_STAFF_USERNAME?.trim(),p=process.env.SKU_STAFF_PASSWORD;if(!u||!p)throw new Error('SKU staff login is not configured.');return crypto.createHmac('sha256',p).update(`hommly-sku-staff-v1:${u}`).digest('hex');}
export function verifyStaff(u:string,p:string){try{const expected=crypto.createHash('sha256').update(`${process.env.SKU_STAFF_USERNAME?.trim()}\0${process.env.SKU_STAFF_PASSWORD}`).digest();const actual=crypto.createHash('sha256').update(`${u.trim()}\0${p}`).digest();staffToken();return crypto.timingSafeEqual(expected,actual);}catch{return false;}}
export async function isSkuStaffAuthenticated(){try{return cookies().get(STAFF_COOKIE)?.value===staffToken();}catch{return false;}}
