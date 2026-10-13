import type { SkuInput } from './types';

/** Approved local POC direction, 2026-10-12. Unified scene; no protected image patches. */
export function skuPrompt(row: SkuInput, variant: string, hasHalalLogo: boolean): string {
  const item = row.itemType || (/badge/i.test(row.productName) ? 'Enamel Badge with Christmas Gift Card' : row.productName);
  const sticker = variant === 'with-sticker'
    ? `Keep the physical adhesive name sticker, its original wording and flat paper appearance. Integrate ONE attractive modern callout with a curved arrow pointing to that sticker. Exact text: "Customize your name here" and "Maximum ${row.stickerLimit} characters". Use modern rounded sans-serif, bold main text, readable secondary text, minimum 26-pixel equivalent at 1024 resolution. Do not obscure the product or use tiny generic bubbles.`
    : 'Remove ONLY the entire physical adhesive name sticker (such as From Alex), including paper, edges, name text and sticker shadow. Seamlessly reconstruct underlying card paper and artwork. Preserve badge lettering and printed card slogans. Remove customization callouts, arrows and character-limit text. Keep the same styled scene and framing from the input image.';
  return [
    'Art-direct a finished premium MODERN, ATTRACTIVE, ECOMMERCE-READY square product listing as ONE unified image. Extract the real physical card and attached product from its original surroundings. Remove ALL hand, laptop, desk, cables and original background remnants. Do not paste a rectangular original-photo patch.',
    'Use cohesive product-first hierarchy, natural studio lighting, believable perspective and contact shadows, coordinated color temperature, balanced negative space and mobile-readable modern sans-serif typography. Keep recognizable card artwork, attached product design, quantity, materials and lettering faithful. Allow natural lighting adjustments to make the whole scene coherent. No collage seams, split panels, letterbox strips, vintage typography, clutter or duplicated labels.',
    'For Christmas use a refined warm ivory surface, restrained evergreen and red/gold accents, and soft distant fairy-light bokeh. Avoid oversaturated yellow lighting and crowded glitter. For other themes use appropriate surrounding props. Keep the full card and attached item visible.',
    `Theme: ${row.theme}. Product: ${row.productName || row.itemType}. Do not invent a product name. Integrate ONE readable contemporary product caption exactly "${item}" into the surrounding scene, outside the card.`,
    `Additional guidance: ${row.notes}`,
    sticker,
    'The second reference image is the official Hommly logo. Use ONLY that logo at the top left, about 18–22% of image width, ignoring empty padding. Preserve spelling and identifying design. No invented brands, duplicate logos or tiny pasted white-square logo. Integrate branding into the finished overall composition.',
    row.halal && hasHalalLogo ? 'The third reference is the supplied halal mark. Integrate it clearly at the top right.' : 'Do not add halal marks or wording.',
    'Final priority: one cohesive modern commercially usable edge-to-edge square image. All scene design and listing graphics must be generated together, not reserved for later overlays. No watermarks: subtle hommly.sg marks are added by the server after generation.',
  ].join(' ');
}
