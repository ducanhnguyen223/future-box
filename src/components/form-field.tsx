import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

type FormFieldProps = TextInputProps & {
  label: string;
  error?: string;
  isPassword?: boolean;
};

export function FormField({ label, error, isPassword, style, ...rest }: FormFieldProps) {
  const [hidden, setHidden] = useState(isPassword);

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold" themeColor="ink2">
        {label}
      </ThemedText>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, { borderColor: error ? Colors.red : Colors.rule }, style]}
          placeholderTextColor={Colors.ink3}
          secureTextEntry={hidden}
          autoCapitalize="none"
          autoCorrect={false}
          {...rest}
        />
        {isPassword && (
          <Pressable onPress={() => setHidden((value) => !value)} hitSlop={8} style={styles.toggle}>
            <ThemedText type="mono" themeColor="ink3">
              {hidden ? 'HIỆN' : 'ẨN'}
            </ThemedText>
          </Pressable>
        )}
      </View>
      {error ? (
        <ThemedText type="small" style={styles.error}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.half,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderRadius: Radius,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontFamily: Fonts.serif,
    fontSize: 16,
    color: Colors.ink,
  },
  toggle: {
    position: 'absolute',
    right: Spacing.three,
  },
  error: {
    color: Colors.red,
  },
});
