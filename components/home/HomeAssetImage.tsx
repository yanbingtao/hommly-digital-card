import Image from 'next/image';
import { cn } from '@/lib/utils';

type HomeAssetImageProps = {
  src: string;
  available: boolean;
  alt: string;
  /** Shown in the neutral fallback so creators know what to drop in */
  placeholderLabel: string;
  fill?: boolean;
  width?: number;
  height?: number;
  priority?: boolean;
  sizes?: string;
  className?: string;
  imageClassName?: string;
  aspectClassName?: string;
};

/**
 * Renders a Hommly homepage asset when present; otherwise a clean neutral
 * placeholder (never fake stock product imagery).
 */
export function HomeAssetImage({
  src,
  available,
  alt,
  placeholderLabel,
  fill = true,
  width,
  height,
  priority = false,
  sizes,
  className,
  imageClassName,
  aspectClassName = 'aspect-[4/3]',
}: HomeAssetImageProps) {
  if (!available) {
    return (
      <div
        className={cn(
          'relative flex w-full items-center justify-center overflow-hidden rounded-[inherit] bg-gradient-to-br from-stone-100 via-[#faf6f3] to-stone-200/80',
          aspectClassName,
          className
        )}
        role="img"
        aria-label={`${alt} (asset pending: ${placeholderLabel})`}
      >
        <div className="px-4 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">
            Hommly asset
          </p>
          <p className="mt-1 max-w-[200px] text-xs leading-snug text-stone-500">
            {placeholderLabel}
          </p>
        </div>
      </div>
    );
  }

  if (fill) {
    return (
      <div className={cn('relative w-full overflow-hidden rounded-[inherit]', aspectClassName, className)}>
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          className={cn('object-cover', imageClassName)}
        />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width ?? 800}
      height={height ?? 600}
      priority={priority}
      sizes={sizes}
      className={cn('object-cover', className, imageClassName)}
    />
  );
}
