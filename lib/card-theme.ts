import type { Theme } from './types';

export const VALID_CARD_THEMES: Theme[] = ['thank_you', 'birthday', 'farewell'];

export function isValidCardTheme(theme: string): theme is Theme {
  return VALID_CARD_THEMES.includes(theme as Theme);
}
