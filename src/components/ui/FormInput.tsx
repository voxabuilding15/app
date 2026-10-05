import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';

import { Input, type InputProps } from './Input';

export interface FormInputProps<T extends FieldValues> extends Omit<
  InputProps,
  'value' | 'onChangeText' | 'error'
> {
  control: Control<T>;
  name: FieldPath<T>;
}

export function FormInput<T extends FieldValues>({ control, name, ...rest }: FormInputProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Input
          {...rest}
          value={typeof field.value === 'string' ? field.value : ''}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={fieldState.error?.message}
        />
      )}
    />
  );
}
