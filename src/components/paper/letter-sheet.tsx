import { useEffect } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

type LetterSheetProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Tờ thư gập mở khi vào màn — 700ms, 5 bước, gốc biến đổi ở mép trên. */
export function LetterSheet({ children, style }: LetterSheetProps) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (!reducedMotion) {
      progress.value = withTiming(1, { duration: 700, easing: Easing.steps(5) });
    }
  }, [reducedMotion, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.3, 1]),
    transform: [{ scaleY: interpolate(progress.value, [0, 1], [0.04, 1]) }],
  }));

  return <Animated.View style={[styles.sheet, animatedStyle, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.rule,
    borderRadius: Radius,
    padding: Spacing.four,
    gap: Spacing.three,
    transformOrigin: 'top',
    ...Shadow.lift,
  },
});
