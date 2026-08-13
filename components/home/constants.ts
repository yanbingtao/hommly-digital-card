import { CARD_AVAILABILITY_MONTHS } from '@/lib/card-expiry';

export const SHOP_URL = 'https://hommly.sg';

/** Hommly.sg contact page — https://hommly.sg/pages/contact */
export const HOMMLY_CONTACT_URL = 'https://hommly.sg/pages/contact';

/** Hommly.online eCard support email (footer Contact). */
export const HOMMLY_ECARD_EMAIL = 'ecard@hommly.sg';
export const HOMMLY_ECARD_MAILTO = `mailto:${HOMMLY_ECARD_EMAIL}`;

/** Hommly.sg policy pages (no Privacy/Terms routes on Hommly.online). */
export const HOMMLY_PRIVACY_URL = 'https://hommly.sg/policies/privacy-policy';
export const HOMMLY_TERMS_URL = 'https://hommly.sg/policies/terms-of-service';

/** Verified from lib/card-expiry.ts — used in FAQ copy only. */
export const ECARD_AVAILABILITY_MONTHS = CARD_AVAILABILITY_MONTHS;

export const LANDING_MAX_WIDTH = 'max-w-[1200px]';
