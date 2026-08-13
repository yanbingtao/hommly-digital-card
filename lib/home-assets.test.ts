import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { HOME_ASSETS } from './home-asset-paths';
import { getHomeAssetAvailability, listMissingHomeAssets } from './home-assets';

const ROOT = path.join(__dirname, '..');

describe('homepage asset structure', () => {
  it('documents the /public/home asset contract', () => {
    expect(HOME_ASSETS.hero).toBe('/home/hero-hommly-ecard.webp');
    expect(HOME_ASSETS.qrCard).toBe('/home/qr-card.webp');
    expect(HOME_ASSETS.giftBox).toBe('/home/gift-box.webp');
    expect(HOME_ASSETS.ecardPreview).toBe('/home/ecard-preview.webp');
    expect(HOME_ASSETS.finalCta).toBe('/home/final-cta.webp');
    expect(HOME_ASSETS.products.teacher).toBe('/home/products/teacher-gift.webp');
    expect(HOME_ASSETS.products.farewell).toBe('/home/products/farewell-gift.webp');
    expect(HOME_ASSETS.products.birthday).toBe('/home/products/birthday-gift.webp');
    expect(HOME_ASSETS.products.office).toBe('/home/products/office-gift.webp');
    expect(HOME_ASSETS.products.team).toBe('/home/products/team-gift.webp');
    expect(HOME_ASSETS.products.graduation).toBe('/home/products/graduation-gift.webp');
    expect(HOME_ASSETS.products.housewarming).toBe('/home/products/housewarming-gift.webp');
    expect(HOME_ASSETS.products.thankYou).toBe('/home/products/thank-you-gift.webp');
  });

  it('keeps asset folders ready for drop-in Hommly photography', () => {
    expect(fs.existsSync(path.join(ROOT, 'public/home'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'public/home/products'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'public/home/ASSETS.md'))).toBe(true);
  });

  it('lists only assets that are not present on disk', () => {
    const availability = getHomeAssetAvailability();
    const missing = listMissingHomeAssets(availability);
    for (const publicPath of missing) {
      const relative = publicPath.replace(/^\//, '');
      expect(fs.existsSync(path.join(ROOT, 'public', relative))).toBe(false);
    }
    if (availability.ecardPreview) {
      expect(missing).not.toContain(HOME_ASSETS.ecardPreview);
    }
  });

  it('homepage no longer references /ecard-hero.jpg for marketing imagery', () => {
    const files = [
      'components/home/HeroProductVisual.tsx',
      'components/home/PhoneEcardMockup.tsx',
      'components/home/HommlyGiftSection.tsx',
      'components/home/FinalCta.tsx',
      'components/home/OccasionsSection.tsx',
    ];
    for (const relative of files) {
      const source = fs.readFileSync(path.join(ROOT, relative), 'utf8');
      expect(source).not.toMatch(/ecard-hero\.jpg/);
    }
  });
});
