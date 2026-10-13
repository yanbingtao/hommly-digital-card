import { beforeEach,it,expect,vi } from 'vitest';
const session=vi.hoisted(()=>({value:undefined as string|undefined}));
vi.mock('next/headers',()=>({cookies:()=>({get:()=>session.value?{value:session.value}:undefined})}));
import { staffToken,verifyStaff,isSkuStaffAuthenticated } from './staff-auth';
beforeEach(()=>{process.env.SKU_STAFF_USERNAME='staff';process.env.SKU_STAFF_PASSWORD='test-only-password';session.value=undefined;});
it('requires configured exact staff credentials',()=>{expect(verifyStaff('staff','test-only-password')).toBe(true);expect(verifyStaff('staff','wrong')).toBe(false);delete process.env.SKU_STAFF_PASSWORD;expect(verifyStaff('staff','')).toBe(false);});
it('accepts only signed staff session and invalidates after credential rotation',async()=>{session.value='forged';expect(await isSkuStaffAuthenticated()).toBe(false);session.value=staffToken();expect(await isSkuStaffAuthenticated()).toBe(true);process.env.SKU_STAFF_PASSWORD='rotated';expect(await isSkuStaffAuthenticated()).toBe(false);});
