import { View, type ViewProps } from 'react-native';

import { Colors, ThemeColor } from '@/constants/theme';

export type ThemedViewProps = ViewProps & {
  type?: ThemeColor;
};

export function ThemedView({ style, type, ...otherProps }: ThemedViewProps) {
  return <View style={[{ backgroundColor: Colors[type ?? 'ground'] }, style]} {...otherProps} />;
}
