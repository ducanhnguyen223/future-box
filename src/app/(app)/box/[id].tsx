import { useEffect } from 'react';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LetterSheet } from '@/components/paper/letter-sheet';
import { StampButton } from '@/components/paper/stamp-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useDeleteBox } from '@/hooks/use-box-actions';
import { useOpenBox } from '@/hooks/use-open-box';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

/** Chỉ để hiển thị "còn bao lâu" — điều kiện mở thật sự luôn do server (RPC open_box) quyết định. */
function formatRemaining(openAt: string): string {
  const diffMs = new Date(openAt).getTime() - Date.now();
  if (diffMs <= 0) return 'Sắp đến giờ mở.';

  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days >= 1) return `Còn ${days} ngày nữa mới mở được.`;

  const hours = Math.max(1, Math.floor(diffMs / (60 * 60 * 1000)));
  return `Còn khoảng ${hours} giờ nữa mới mở được.`;
}

/** Đóng dấu "ĐÃ TRẢ LỜI" khi chọn Yes — cùng nhịp stampDown 480ms/4 bước như PostmarkStamp. */
function AnsweredStamp() {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (!reducedMotion) {
      progress.value = withTiming(1, { duration: 480, easing: Easing.steps(4) });
    }
  }, [reducedMotion, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.6, 1], [0, 1, 1]),
    transform: [
      { scale: interpolate(progress.value, [0, 1], [1.9, 1]) },
      { rotate: `${interpolate(progress.value, [0, 1], [-24, -8])}deg` },
    ],
  }));

  return (
    <Animated.View entering={FadeIn.duration(150)} style={styles.celebrationOverlay}>
      <Animated.View style={[styles.answeredStamp, animatedStyle]}>
        <ThemedText type="monoLabel" style={styles.answeredStampLabel}>
          Đã trả lời
        </ThemedText>
      </Animated.View>
    </Animated.View>
  );
}

export default function BoxDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    loading,
    fetchError,
    box,
    attachmentUrl,
    wasAlreadyOpened,
    blocked,
    needsFollowUpAnswer,
    opening,
    openError,
    pendingAnswer,
    justAnsweredYes,
    submitAnswer,
    retryOpen,
  } = useOpenBox(id);
  const { deleteBox, deleting } = useDeleteBox(id ?? '');

  const handleDelete = () => {
    Alert.alert('Xóa hộp?', 'Bạn chắc chắn muốn xóa hộp này? Hành động này không thể hoàn tác.', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          const { error } = await deleteBox();
          if (error) {
            Alert.alert('Không thể xóa', error);
          }
          router.replace('/(app)');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.blue} />
        <ThemedText type="small" themeColor="ink3">
          Đang kiểm tra...
        </ThemedText>
      </ThemedView>
    );
  }

  if (fetchError || !box) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ThemedText type="default">{fetchError ?? 'Không tìm thấy hộp này.'}</ThemedText>
        <Pressable onPress={() => router.back()} style={styles.secondaryButton}>
          <ThemedText type="default" themeColor="blue">
            Quay lại
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  if (blocked) {
    return (
      <Animated.View entering={FadeIn.duration(200)} style={styles.centerContainerFlex}>
        <ThemedText type="monoLabel" themeColor="ink3">
          Đang niêm phong
        </ThemedText>
        <ThemedText type="default">{formatRemaining(box.open_at)}</ThemedText>
        <View style={styles.lockedActionsRow}>
          <StampButton
            label="Sửa"
            variant="muted"
            disabled={deleting}
            onPress={() => router.push(`/(app)/box/${box.id}/edit`)}
          />
          <StampButton label="Xóa" variant="primary" disabled={deleting} loading={deleting} onPress={handleDelete} />
        </View>
        <Pressable onPress={() => router.back()} style={styles.secondaryButton}>
          <ThemedText type="default" themeColor="ink3">
            Quay lại
          </ThemedText>
        </Pressable>
      </Animated.View>
    );
  }

  // "Xong" hiển thị khi: xem lại hộp cũ (read-only), hoặc hộp không có follow-up đã tự mark opened,
  // hoặc follow-up đã được trả lời xong trong phiên này (kể cả Yes — vẫn có nút Xong để đóng overlay chúc mừng).
  const showDone =
    wasAlreadyOpened || (!box.follow_up_question && !!box.opened_at) || !!box.follow_up_answered_at;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <LetterSheet>
            {attachmentUrl ? (
              <Image source={{ uri: attachmentUrl }} style={styles.photo} contentFit="cover" />
            ) : null}
            <ThemedText type="default">{box.content_text}</ThemedText>
          </LetterSheet>

          {box.follow_up_question ? (
            <View style={styles.followUpBlock}>
              <ThemedText type="smallBold">{box.follow_up_question}</ThemedText>

              {wasAlreadyOpened || !needsFollowUpAnswer ? (
                <ThemedView type="paperDim" style={styles.answerBadge}>
                  <ThemedText type="monoLabel" themeColor="ink3">
                    {box.follow_up_answer ? 'ĐÃ TRẢ LỜI: CÓ' : 'ĐÃ TRẢ LỜI: CHƯA'}
                  </ThemedText>
                </ThemedView>
              ) : (
                <View style={styles.answerRow}>
                  <StampButton
                    label="Có"
                    variant="primary"
                    disabled={opening}
                    loading={opening && pendingAnswer === true}
                    onPress={() => submitAnswer(true)}
                  />
                  <StampButton
                    label="Chưa"
                    variant="muted"
                    disabled={opening}
                    loading={opening && pendingAnswer === false}
                    onPress={() => submitAnswer(false)}
                  />
                </View>
              )}

              {openError ? (
                <View style={styles.errorBlock}>
                  <ThemedText type="small" style={styles.errorText}>
                    {openError}
                  </ThemedText>
                  <Pressable onPress={retryOpen} style={styles.secondaryButton}>
                    <ThemedText type="default" themeColor="blue">
                      Thử lại
                    </ThemedText>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}

          {showDone ? (
            <Pressable onPress={() => router.back()} style={styles.doneButton}>
              <ThemedText type="default" style={styles.doneButtonLabel}>
                Xong
              </ThemedText>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>

      {justAnsweredYes ? <AnsweredStamp /> : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  centerContainerFlex: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  lockedActionsRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignSelf: 'stretch',
    maxWidth: 320,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  photo: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Radius,
    borderWidth: 1,
    borderColor: Colors.rule,
  },
  followUpBlock: {
    gap: Spacing.three,
  },
  answerRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  answerBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius,
  },
  errorBlock: {
    gap: Spacing.two,
  },
  errorText: {
    color: Colors.red,
  },
  secondaryButton: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  doneButton: {
    alignSelf: 'center',
    backgroundColor: Colors.blue,
    borderRadius: Radius,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.six,
  },
  doneButtonLabel: {
    color: Colors.paper,
    fontWeight: '600',
  },
  celebrationOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(35,32,25,0.55)',
  },
  answeredStamp: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.paper,
  },
  answeredStampLabel: {
    color: Colors.red,
    fontSize: 13,
    textAlign: 'center',
  },
});
