import type { ReactNode } from 'react';
import { Heart, PartyPopper, CloudRain } from 'lucide-react';
import type { Theme } from './types';

export { VALID_CARD_THEMES, isValidCardTheme } from './card-theme';

export const CARD_EDITOR_THEMES: {
  id: Theme;
  label: string;
  icon: ReactNode;
  description: string;
}[] = [
  {
    id: 'thank_you',
    label: 'Thank You',
    icon: <Heart className="h-4 w-4" />,
    description: 'Warm, gentle, and heartfelt',
  },
  {
    id: 'birthday',
    label: 'Birthday',
    icon: <PartyPopper className="h-4 w-4" />,
    description: 'Cheerful and celebratory',
  },
  {
    id: 'farewell',
    label: 'Farewell',
    icon: <CloudRain className="h-4 w-4" />,
    description: 'Soft, emotional, and warm',
  },
];
