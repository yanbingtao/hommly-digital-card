'use client';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type CardMessageFieldProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mixed?: boolean;
  className?: string;
};

export function CardMessageField({
  id = 'message',
  value,
  onChange,
  placeholder = 'Write your message here...',
  mixed = false,
  className,
}: CardMessageFieldProps) {
  return (
    <div className={cn('space-y-2.5', className)}>
      <div className="space-y-1">
        <Label htmlFor={id} className="text-base font-semibold text-stone-900">
          Your message
        </Label>
        <p className="text-sm text-stone-500">
          Write the message your recipient will see when they open the eCard.
        </p>
      </div>
      {mixed ? (
        <p className="text-xs text-amber-700">Selected gifts currently have different messages.</p>
      ) : null}
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={mixed ? 'Enter a message to apply to all selected gifts' : placeholder}
        rows={8}
        className={cn(
          'min-h-[11rem] resize-y rounded-xl border-stone-200 bg-white px-3.5 py-3 text-[15px] leading-relaxed text-stone-800',
          'placeholder:text-stone-400',
          'focus-visible:border-rose-300 focus-visible:ring-rose-400/30'
        )}
      />
    </div>
  );
}
