 'use server';
import { cookies } from 'next/headers';
import { STAFF_COOKIE,staffToken,verifyStaff } from '@/lib/sku-images/staff-auth';
import { getAdminCookieOptions } from '@/lib/admin-auth';
export async function loginSkuStaff(username:string,password:string){if(!verifyStaff(username,password))return {success:false,error:'Incorrect staff credentials or staff login is not configured.'};cookies().set(STAFF_COOKIE,staffToken(),getAdminCookieOptions());return {success:true,redirectTo:'/staff/sku-images'};}
