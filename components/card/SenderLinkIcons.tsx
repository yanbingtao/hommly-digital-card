'use client';

import {
  Globe,
  Instagram,
  Linkedin,
  Mail,
  MessageCircle,
  Music2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { SenderLinkKey, VisibleSenderLink } from '@/lib/sender-links';

const ICONS: Record<SenderLinkKey, React.ComponentType<{ className?: string }>> = {
  whatsapp: MessageCircle,
  instagram: Instagram,
  linkedin: Linkedin,
  tiktok: Music2,
  website: Globe,
  email: Mail,
};

interface SenderLinkIconsProps {
  links: VisibleSenderLink[];
  className?: string;
}

export function SenderLinkIcons({ links, className }: SenderLinkIconsProps) {
  if (links.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.6 }}
      className={`flex flex-wrap items-center justify-center gap-2.5 ${className ?? ''}`}
    >
      {links.map((link) => {
        const Icon = ICONS[link.key];
        return (
          <a
            key={link.key}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={link.label}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-stone-500 shadow-sm ring-1 ring-stone-200/50 transition-colors hover:bg-white hover:text-stone-700"
          >
            <Icon className="h-4 w-4" />
          </a>
        );
      })}
    </motion.div>
  );
}
