import * as React from 'react';
import { ExternalLink, type LucideIcon } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Shared public marketing CTA system for Hommly.online
 * (homepage, /ecard, landing sections).
 * Not for Admin, buyer editor, PIN gates, FAQ, or utility icon buttons.
 */
export const hommlyCtaVariants = cva(
  [
    'group/cta inline-flex items-center justify-center gap-2',
    'whitespace-nowrap font-semibold tracking-[-0.01em]',
    'transition-[color,background-color,border-color,box-shadow,transform] duration-[180ms] ease-out',
    'motion-reduce:transition-colors motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none',
    'aria-disabled:pointer-events-none aria-disabled:translate-y-0 aria-disabled:opacity-50 aria-disabled:shadow-none',
  ].join(' '),
  {
    variants: {
      variant: {
        /** Hero / section primary — Hommly coral */
        primary: [
          'h-[50px] min-h-[48px] rounded-[15px] px-6 text-[15px] sm:h-[52px] sm:px-7 sm:text-base',
          'bg-rose-500 text-white',
          'shadow-[0_10px_22px_-12px_rgba(244,63,94,0.55)]',
          'hover:-translate-y-px hover:bg-rose-600 hover:shadow-[0_14px_28px_-12px_rgba(225,29,72,0.5)]',
          'active:translate-y-0 active:scale-[0.985] active:bg-rose-600',
          'focus-visible:ring-rose-300',
        ].join(' '),
        /** Same footprint as primary; quieter neutral treatment */
        secondary: [
          'h-[50px] min-h-[48px] rounded-[15px] px-6 text-[15px] sm:h-[52px] sm:px-7 sm:text-base',
          'border border-stone-200/90 bg-[#fffaf7] text-stone-800',
          'shadow-[0_8px_18px_-14px_rgba(28,25,23,0.28)]',
          'hover:-translate-y-px hover:border-stone-300 hover:bg-white hover:shadow-[0_12px_24px_-14px_rgba(28,25,23,0.32)]',
          'active:translate-y-0 active:scale-[0.985]',
          'focus-visible:ring-stone-300',
        ].join(' '),
        /** Compact header CTA — same accent family */
        header: [
          'h-11 min-h-11 rounded-[13px] px-5 text-[14px] sm:h-[42px] sm:px-[1.35rem] sm:text-[15px]',
          'bg-rose-500 text-white',
          'shadow-[0_8px_18px_-12px_rgba(244,63,94,0.5)]',
          'hover:-translate-y-px hover:bg-rose-600 hover:shadow-[0_12px_22px_-12px_rgba(225,29,72,0.48)]',
          'active:translate-y-0 active:scale-[0.985]',
          'focus-visible:ring-rose-300',
        ].join(' '),
        /** Primary footprint on accent / photo panels (white fill) */
        inverse: [
          'h-[50px] min-h-[48px] rounded-[15px] px-6 text-[15px] sm:h-[52px] sm:px-7 sm:text-base',
          'bg-white text-stone-900',
          'shadow-[0_12px_28px_-16px_rgba(28,25,23,0.45)]',
          'hover:-translate-y-px hover:bg-[#fffaf7] hover:shadow-[0_16px_32px_-16px_rgba(28,25,23,0.5)]',
          'active:translate-y-0 active:scale-[0.985]',
          'focus-visible:ring-white/80 focus-visible:ring-offset-rose-500',
        ].join(' '),
        /** Secondary footprint on dark panels (e.g. /ecard final CTA) */
        onDark: [
          'h-[50px] min-h-[48px] rounded-[15px] px-6 text-[15px] sm:h-[52px] sm:px-7 sm:text-base',
          'border border-white/25 bg-white/5 text-white',
          'shadow-[0_10px_24px_-18px_rgba(0,0,0,0.35)]',
          'hover:-translate-y-px hover:border-white/40 hover:bg-white/10',
          'active:translate-y-0 active:scale-[0.985]',
          'focus-visible:ring-white/70 focus-visible:ring-offset-[#55382D]',
        ].join(' '),
      },
      block: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      block: false,
    },
  }
);

export type HommlyCtaVariant = NonNullable<VariantProps<typeof hommlyCtaVariants>['variant']>;

const iconMotionClass =
  'shrink-0 opacity-95 transition-transform duration-[180ms] ease-out group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover/cta:translate-x-0 motion-reduce:group-hover/cta:translate-y-0';

const iconDownMotionClass =
  'shrink-0 opacity-80 transition-transform duration-[180ms] ease-out group-hover/cta:translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover/cta:translate-y-0';

export type HommlyCtaProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> &
  VariantProps<typeof hommlyCtaVariants> & {
    href: string;
    /** Opens in a new tab with noopener and shows external icon by default. */
    external?: boolean;
    showExternalIcon?: boolean;
    /** Custom trailing icon (e.g. ArrowDown). Overrides external icon when set. */
    icon?: LucideIcon;
    /** Motion hint for custom icon: external-style diagonal vs soft downward. */
    iconMotion?: 'external' | 'down';
  };

export function HommlyCta({
  className,
  variant = 'primary',
  block = false,
  href,
  external = false,
  showExternalIcon,
  icon: Icon,
  iconMotion = 'external',
  children,
  ...props
}: HommlyCtaProps) {
  const withExternal = !Icon && (showExternalIcon ?? external);
  const iconSize =
    variant === 'header' ? 'h-[15px] w-[15px]' : 'h-4 w-4 sm:h-[1.05rem] sm:w-[1.05rem]';
  const motionClass = iconMotion === 'down' ? iconDownMotionClass : iconMotionClass;

  return (
    <a
      href={href}
      className={cn(hommlyCtaVariants({ variant, block }), className)}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      {...props}
    >
      <span>{children}</span>
      {Icon ? <Icon className={cn(iconSize, motionClass)} aria-hidden /> : null}
      {withExternal ? <ExternalLink className={cn(iconSize, iconMotionClass)} aria-hidden /> : null}
    </a>
  );
}
