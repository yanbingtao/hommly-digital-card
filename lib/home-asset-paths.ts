/**
 * Canonical Hommly homepage asset paths under /public/home.
 * Safe for client components (no Node fs).
 */
export const HOME_ASSETS = {
  hero: '/home/hero-hommly-ecard.webp',
  qrCard: '/home/qr-card.webp',
  giftBox: '/home/gift-box.webp',
  /** Recipient Experience preview photo (phone + gift lifestyle). */
  ecardPreview: '/home/ecard-preview.webp',
  /** Final CTA box background. */
  finalCta: '/home/final-cta.webp',
  products: {
    farewell: '/home/products/farewell-gift.webp',
    teacher: '/home/products/teacher-gift.webp',
    birthday: '/home/products/birthday-gift.webp',
    thankYou: '/home/products/thank-you-gift.webp',
    office: '/home/products/office-gift.webp',
    team: '/home/products/team-gift.webp',
    graduation: '/home/products/graduation-gift.webp',
    housewarming: '/home/products/housewarming-gift.webp',
  },
} as const;

export type HomeAssetAvailability = {
  hero: boolean;
  qrCard: boolean;
  giftBox: boolean;
  ecardPreview: boolean;
  finalCta: boolean;
  products: {
    farewell: boolean;
    teacher: boolean;
    birthday: boolean;
    thankYou: boolean;
    office: boolean;
    team: boolean;
    graduation: boolean;
    housewarming: boolean;
  };
};
