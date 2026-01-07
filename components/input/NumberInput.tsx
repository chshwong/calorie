// components/inputs/NumberInput.tsx
import React, { forwardRef, useCallback } from 'react';
import { Platform, TextInput, TextInputProps } from 'react-native';

type Props = Omit<TextInputProps, 'keyboardType' | 'inputMode' | 'onChangeText' | 'value'> & {
  value: string;                 // keep as string in UI
  onChangeValue: (v: string) => void;
  allowDecimal?: boolean;        // default true
  maxDecimals?: number;          // default 2
  maxIntegers?: number;          // limit integer part digits (e.g., 4 for "9999.99")
};

export const NumberInput = forwardRef<TextInput, Props>(function NumberInput(
  { value, onChangeValue, allowDecimal = true, maxDecimals = 2, maxIntegers, ...rest },
  ref
) {
  const onChangeText = useCallback(
    (text: string) => {
      // Normalize locale decimal separator and strip invalid chars
      let t = text.replace(/,/g, '.');

      // Keep only digits and at most one dot
      t = t.replace(allowDecimal ? /[^0-9.]/g : /[^0-9]/g, '');
      if (allowDecimal) {
        const firstDot = t.indexOf('.');
        if (firstDot !== -1) {
          t =
            t.slice(0, firstDot + 1) +
            t.slice(firstDot + 1).replace(/\./g, '');
        }

        // Limit integer part digits
        if (maxIntegers !== undefined && maxIntegers > 0) {
          const [integerPart, decimalPart] = t.split('.');
          if (integerPart && integerPart.length > maxIntegers) {
            const limitedInteger = integerPart.slice(0, maxIntegers);
            t = decimalPart !== undefined ? `${limitedInteger}.${decimalPart}` : limitedInteger;
          }
        }

        // Limit decimals
        if (maxDecimals >= 0 && firstDot !== -1) {
          const [a, b] = t.split('.');
          t = b === undefined ? a : `${a}.${b.slice(0, maxDecimals)}`;
        }
      } else {
        // Limit integer part digits when decimals not allowed
        if (maxIntegers !== undefined && maxIntegers > 0 && t.length > maxIntegers) {
          t = t.slice(0, maxIntegers);
        }
      }

      onChangeValue(t);
    },
    [allowDecimal, maxDecimals, maxIntegers, onChangeValue]
  );

  return (
    <TextInput
      ref={ref}
      value={value}
      onChangeText={onChangeText}
      keyboardType={
        allowDecimal
          ? Platform.OS === 'ios'
            ? 'decimal-pad'
            : 'numeric'
          : Platform.OS === 'ios'
            ? 'number-pad'
            : 'numeric'
      }
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      autoCorrect={false}
      autoCapitalize="none"
      {...rest}
    />
  );
});
