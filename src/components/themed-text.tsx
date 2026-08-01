import { StyleSheet, Text, type TextProps } from 'react-native';

import { Colors, Fonts, ThemeColor } from '@/constants/theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'mono' | 'monoLabel';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  return (
    <Text
      style={[
        { color: Colors[themeColor ?? 'ink'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'mono' && styles.mono,
        type === 'monoLabel' && styles.monoLabel,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontFamily: Fonts.serif,
    fontSize: 13,
    lineHeight: 19,
  },
  smallBold: {
    fontFamily: Fonts.serifSemiBold,
    fontSize: 13,
    lineHeight: 19,
  },
  default: {
    fontFamily: Fonts.serif,
    fontSize: 16.5,
    lineHeight: 26,
  },
  title: {
    fontFamily: Fonts.serifSemiBold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontFamily: Fonts.serifSemiBold,
    fontSize: 16,
    lineHeight: 22,
  },
  link: {
    fontFamily: Fonts.serif,
    lineHeight: 24,
    fontSize: 14,
  },
  linkPrimary: {
    fontFamily: Fonts.serifSemiBold,
    lineHeight: 24,
    fontSize: 14,
    color: Colors.blue,
  },
  mono: {
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
  monoLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
