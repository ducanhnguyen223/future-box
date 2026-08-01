import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

type PostmarkStampProps = {
  date: string;
  animateIn?: boolean;
  size?: number;
};

/** Dấu bưu điện đóng lệch. Khi animateIn, chạy hiệu ứng đóng dấu 480ms/4 bước. */
export function PostmarkStamp({ date, animateIn, size = 46 }: PostmarkStampProps) {
  const reducedMotion = useReducedMotion();
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = `TH${String(d.getMonth() + 1).padStart(2, '0')}`;
  const year = d.getFullYear();

  const shouldAnimate = animateIn && !reducedMotion;
  const progress = useSharedValue(shouldAnimate ? 0 : 1);

  useEffect(() => {
    if (shouldAnimate) {
      progress.value = withTiming(1, { duration: 480, easing: Easing.steps(4) });
    }
  }, [shouldAnimate, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.6, 1], [0, 1, 0.82]),
    transform: [
      { scale: interpolate(progress.value, [0, 1], [1.9, 1]) },
      { rotate: `${interpolate(progress.value, [0, 1], [-24, -11])}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }, animatedStyle]}
    >
      <ThemedText type="mono" style={styles.line}>
        {day}
      </ThemedText>
      <ThemedText type="mono" style={styles.line}>
        {month}
      </ThemedText>
      <ThemedText type="mono" style={styles.line}>
        {year}
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  circle: {
    borderWidth: 1.5,
    borderColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    color: Colors.red,
    fontSize: 8.5,
    lineHeight: 10,
    textAlign: 'center',
  },
});
