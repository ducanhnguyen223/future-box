import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

import { CountdownLabel } from './countdown-label';
import { PostmarkStamp } from './postmark-stamp';

export type PaperCardStatus = 'locked' | 'ready' | 'opened';

type PaperCardProps = {
  status: PaperCardStatus;
  title: string;
  preview?: string;
  openAt: string;
  meta?: string;
  onPress?: () => void;
};

/** Mép giấy rách răng cưa — chỉ hiện trên hộp đã mở. */
function TornEdge() {
  return (
    <Svg width="100%" height={9} viewBox="0 0 100 9" preserveAspectRatio="none">
      <Path
        d="M0,9 L6,1 L13,8 L20,0 L27,8 L34,1 L41,9 L48,1 L55,8 L62,0 L69,8 L76,1 L83,9 L90,1 L97,8 L100,9 L100,0 L0,0 Z"
        fill={Colors.ground}
      />
    </Svg>
  );
}

/**
 * Ba trạng thái phải đọc được bằng hình, không cần đọc chữ (design/design-system.md mục 5):
 * đang khóa = nền paperDim + dấu mộc + đếm ngược; sẵn sàng mở = nền paper + dấu mộc + chấm đỏ;
 * đã mở = nền paper + mép trên rách răng cưa.
 */
export function PaperCard({ status, title, preview, openAt, meta, onPress }: PaperCardProps) {
  const reducedMotion = useReducedMotion();
  const shakeX = useSharedValue(0);

  const handlePress = () => {
    if (status === 'locked') {
      if (!reducedMotion) {
        shakeX.value = withSequence(
          withTiming(-4, { duration: 65 }),
          withTiming(4, { duration: 130 }),
          withTiming(0, { duration: 65 })
        );
      }
      return;
    }
    onPress?.();
  };

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  return (
    <Animated.View style={shakeStyle}>
      <Pressable
        onPress={handlePress}
        style={[styles.card, { backgroundColor: status === 'locked' ? Colors.paperDim : Colors.paper }]}
      >
        {status === 'opened' ? <TornEdge /> : null}
        <View style={styles.body}>
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <ThemedText type="smallBold" numberOfLines={2}>
                {title}
              </ThemedText>
              {preview ? (
                <ThemedText type="small" themeColor="ink2" numberOfLines={1}>
                  {preview}
                </ThemedText>
              ) : null}
            </View>
            {status !== 'opened' ? <PostmarkStamp date={openAt} /> : null}
          </View>

          <View style={styles.metaRow}>
            {status === 'ready' ? <View style={styles.readyDot} /> : null}
            {status === 'locked' ? <CountdownLabel openAt={openAt} /> : null}
            {status === 'ready' ? (
              <ThemedText type="monoLabel" themeColor="ink3">
                ĐÃ TỚI NGÀY
              </ThemedText>
            ) : null}
            {status === 'opened' && meta ? (
              <ThemedText type="monoLabel" themeColor="ink3">
                {meta}
              </ThemedText>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: Colors.rule,
    borderRadius: Radius,
    marginBottom: Spacing.three,
    overflow: 'hidden',
    ...Shadow.lift,
  },
  body: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  headerText: {
    flex: 1,
    gap: Spacing.half,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  readyDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Colors.red,
  },
});
