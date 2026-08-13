import fs from 'fs';
import path from 'path';
import { HOME_ASSETS, type HomeAssetAvailability } from '@/lib/home-asset-paths';

export { HOME_ASSETS, type HomeAssetAvailability } from '@/lib/home-asset-paths';

function publicFileExists(publicPath: string): boolean {
  const relative = publicPath.replace(/^\//, '');
  return fs.existsSync(path.join(process.cwd(), 'public', relative));
}

export function getHomeAssetAvailability(): HomeAssetAvailability {
  return {
    hero: publicFileExists(HOME_ASSETS.hero),
    qrCard: publicFileExists(HOME_ASSETS.qrCard),
    giftBox: publicFileExists(HOME_ASSETS.giftBox),
    ecardPreview: publicFileExists(HOME_ASSETS.ecardPreview),
    finalCta: publicFileExists(HOME_ASSETS.finalCta),
    products: {
      farewell: publicFileExists(HOME_ASSETS.products.farewell),
      teacher: publicFileExists(HOME_ASSETS.products.teacher),
      birthday: publicFileExists(HOME_ASSETS.products.birthday),
      thankYou: publicFileExists(HOME_ASSETS.products.thankYou),
      office: publicFileExists(HOME_ASSETS.products.office),
      team: publicFileExists(HOME_ASSETS.products.team),
      graduation: publicFileExists(HOME_ASSETS.products.graduation),
      housewarming: publicFileExists(HOME_ASSETS.products.housewarming),
    },
  };
}

export function listMissingHomeAssets(
  availability: HomeAssetAvailability = getHomeAssetAvailability()
): string[] {
  const missing: string[] = [];
  if (!availability.hero) missing.push(HOME_ASSETS.hero);
  if (!availability.qrCard) missing.push(HOME_ASSETS.qrCard);
  if (!availability.giftBox) missing.push(HOME_ASSETS.giftBox);
  if (!availability.ecardPreview) missing.push(HOME_ASSETS.ecardPreview);
  if (!availability.finalCta) missing.push(HOME_ASSETS.finalCta);
  (Object.keys(HOME_ASSETS.products) as Array<keyof typeof HOME_ASSETS.products>).forEach(
    (key) => {
      if (!availability.products[key]) missing.push(HOME_ASSETS.products[key]);
    }
  );
  return missing;
}
