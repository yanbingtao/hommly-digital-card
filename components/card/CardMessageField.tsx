'use client';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type CardMessageFieldProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mixed?: boolean;
};

export function CardMessageField({
  id = 'message',
  value,
  onChange,
  placeholder = 'Write something thoughtful...',
  mixed = false,
}: CardMessageFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Your Message</Label>
      {mixed ? (
        <p className="text-xs text-amber-700">Selected gifts currently have different messages.</p>
      ) : null}
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={mixed ? 'Enter a message to apply to all selected gifts' : placeholder}
        rows={6}
      />
    </div>
  );
}
