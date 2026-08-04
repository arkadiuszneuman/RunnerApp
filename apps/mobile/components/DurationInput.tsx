import { Input, InputField } from '@gluestack-ui/themed';
import { digitsToTimespan, formatDigits, timespanToDigits, Timespan, type DurationFields } from '@runner/core';
import { useState } from 'react';
import type { NativeSyntheticEvent, TextInputKeyPressEventData } from 'react-native';

export interface DurationInputProps {
  value: Timespan;
  /** 2 → mm:ss (e.g. tempo); 3 → h:mm:ss (e.g. segment duration). */
  fields: DurationFields;
  onChange: (value: Timespan) => void;
  placeholder?: string;
}

/**
 * Calculator/ATM-style duration entry, replacing MUI's TimePicker (no RN
 * equivalent exists for a segmented, keyboard-editable duration field — see
 * packages/core/src/duration/durationInput.ts). Digits type in from the
 * right; the component owns a raw digit buffer and always renders it fully
 * formatted, rather than trying to diff the native TextInput's own text
 * (which gets fiddly with cursor position on a controlled input).
 */
export function DurationInput({ value, fields, onChange, placeholder }: DurationInputProps) {
  const [digits, setDigits] = useState(() => timespanToDigits(value, fields));

  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    const key = e.nativeEvent.key;
    let nextDigits: string;
    if (key === 'Backspace') {
      nextDigits = digits.slice(0, -1);
    } else if (/^[0-9]$/.test(key)) {
      nextDigits = digits + key;
    } else {
      return;
    }
    setDigits(nextDigits);
    onChange(digitsToTimespan(nextDigits, fields));
  };

  return (
    <Input>
      <InputField
        value={formatDigits(digits, fields)}
        placeholder={placeholder}
        keyboardType="number-pad"
        onKeyPress={handleKeyPress}
      />
    </Input>
  );
}
