import { useState } from 'react';

import { Input } from '@/components';

interface MinutesFieldProps {
  label: string;
  value: number;
  error?: string;
  onCommit: (minutes: number) => void;
}

/** A whole number of minutes, applied as soon as it is a number; empty or invalid text is not applied. */
export function MinutesField({ label, value, error, onCommit }: MinutesFieldProps) {
  const [text, setText] = useState<string | null>(null);

  return (
    <Input
      label={label}
      value={text ?? String(value)}
      error={error}
      keyboardType="number-pad"
      maxLength={5}
      onChangeText={(next) => {
        const digits = next.replace(/\D/g, '');
        setText(digits);
        if (digits !== '') {
          onCommit(Number(digits));
        }
      }}
      onBlur={() => setText(null)}
    />
  );
}
