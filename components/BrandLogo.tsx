import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  href?: string | null;
  showText?: boolean;
  text?: string;
  className?: string;
  imageClassName?: string;
}

export function BrandLogo({
  href = '/',
  showText = true,
  text = 'Hommly',
  className,
  imageClassName,
}: BrandLogoProps) {
  const content = (
    <>
      <Image
        src="/logo.png"
        alt="Hommly"
        width={36}
        height={36}
        className={cn('h-9 w-9 object-contain', imageClassName)}
        priority
      />
      {showText ? (
        <span className="text-lg font-semibold tracking-tight text-stone-900">{text}</span>
      ) : null}
    </>
  );

  const classes = cn('flex items-center gap-2.5', className);

  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }

  return <div className={classes}>{content}</div>;
}
