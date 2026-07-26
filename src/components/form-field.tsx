import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type FormFieldProps = TextInputProps & {
  label: string;
  error?: string;
  isPassword?: boolean;
};

export function FormField({ label, error, isPassword, style, ...rest }: FormFieldProps) {
  const theme = useTheme();
  const [hidden, setHidden] = useState(isPassword);

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View style={styles.inputRow}>
        <TextInput
          style={[
            styles.input,
            { color: theme.text, borderColor: error ? '#d92d20' : theme.backgroundSelected },
            style,
          ]}
          placeholderTextColor={theme.textSecondary}
          secureTextEntry={hidden}
          autoCapitalize="none"
          autoCorrect={false}
          {...rest}
        />
        {isPassword && (
          <Pressable onPress={() => setHidden((value) => !value)} hitSlop={8} style={styles.toggle}>
            <ThemedText type="small" themeColor="textSecondary">
              {hidden ? 'Hiện' : 'Ẩn'}
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
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  toggle: {
    position: 'absolute',
    right: Spacing.three,
  },
  error: {
    color: '#d92d20',
  },
});
