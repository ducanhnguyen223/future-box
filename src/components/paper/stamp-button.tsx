import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

type StampButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'muted';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Nút dạng tem: viền đứt, chữ mono viết hoa. */
export function StampButton({ label, onPress, variant = 'primary', disabled, loading, style }: StampButtonProps) {
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.button, { borderColor: isPrimary ? Colors.blue : Colors.ink3 }, disabled && styles.disabled, style]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? Colors.blue : Colors.ink3} />
      ) : (
        <ThemedText type="monoLabel" themeColor={isPrimary ? 'blue' : 'ink3'} style={styles.label}>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    backgroundColor: Colors.paper,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    letterSpacing: 1,
  },
});
