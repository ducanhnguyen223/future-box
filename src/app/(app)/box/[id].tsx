import { useEffect } from 'react';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useDeleteBox } from '@/hooks/use-box-actions';
import { useOpenBox } from '@/hooks/use-open-box';

/** Chỉ để hiển thị "còn bao lâu" — điều kiện mở thật sự luôn do server (RPC open_box) quyết định. */
function formatRemaining(openAt: string): string {
  const diffMs = new Date(openAt).getTime() - Date.now();
  if (diffMs <= 0) return 'Sắp đến giờ mở.';

  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days >= 1) return `Còn ${days} ngày nữa mới mở được.`;

  const hours = Math.max(1, Math.floor(diffMs / (60 * 60 * 1000)));
  return `Còn khoảng ${hours} giờ nữa mới mở được.`;
}

// ponytail: Reanimated đã là dependency sẵn có (dùng ở Collapsible) — scale+opacity pulse
// đơn giản là đủ cho hiệu ứng chúc mừng, không cần thêm lib confetti mới.
function CelebrationOverlay() {
  const scale = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(withTiming(1.15, { duration: 400 }), withTiming(0.95, { duration: 400 })),
      -1,
      true
    );
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.celebrationOverlay}>
      <Animated.Text style={[styles.celebrationEmoji, animatedStyle]}>🎉</Animated.Text>
      <ThemedText type="title" style={styles.celebrationText}>
        Chúc mừng!
      </ThemedText>
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
        <ActivityIndicator size="large" />
        <ThemedText type="small" themeColor="textSecondary">
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
          <ThemedText type="default">Quay lại</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  if (blocked) {
    return (
      <Animated.View entering={FadeIn.duration(200)} style={styles.centerContainerFlex}>
        <ThemedText style={styles.lockIcon}>🔒</ThemedText>
        <ThemedText type="default">{formatRemaining(box.open_at)}</ThemedText>
        <View style={styles.lockedActionsRow}>
          <Pressable
            onPress={() => router.push(`/(app)/box/${box.id}/edit`)}
            disabled={deleting}
            style={styles.editButton}
          >
            <ThemedText type="default" style={styles.editButtonLabel}>
              Sửa
            </ThemedText>
          </Pressable>
          <Pressable onPress={handleDelete} disabled={deleting} style={styles.deleteButton}>
            {deleting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <ThemedText type="default" style={styles.deleteButtonLabel}>
                Xóa
              </ThemedText>
            )}
          </Pressable>
        </View>
        <Pressable onPress={() => router.back()} style={styles.secondaryButton}>
          <ThemedText type="default">Quay lại</ThemedText>
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
          <Animated.View entering={FadeIn.duration(400)} style={styles.contentCard}>
            {attachmentUrl ? (
              <Image source={{ uri: attachmentUrl }} style={styles.photo} contentFit="cover" />
            ) : null}
            <ThemedText type="default">{box.content_text}</ThemedText>
          </Animated.View>

          {box.follow_up_question ? (
            <View style={styles.followUpBlock}>
              <ThemedText type="smallBold">{box.follow_up_question}</ThemedText>

              {wasAlreadyOpened || !needsFollowUpAnswer ? (
                <ThemedView type="backgroundElement" style={styles.answerBadge}>
                  <ThemedText type="default">{box.follow_up_answer ? 'Yes' : 'No'}</ThemedText>
                </ThemedView>
              ) : (
                <View style={styles.answerRow}>
                  <Pressable
                    onPress={() => submitAnswer(true)}
                    disabled={opening}
                    style={[styles.answerButton, styles.answerButtonYes, opening && styles.answerButtonDisabled]}
                  >
                    {opening && pendingAnswer === true ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <ThemedText type="default" style={styles.answerButtonLabel}>
                        Yes
                      </ThemedText>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => submitAnswer(false)}
                    disabled={opening}
                    style={[styles.answerButton, styles.answerButtonNo, opening && styles.answerButtonDisabled]}
                  >
                    {opening && pendingAnswer === false ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <ThemedText type="default" style={styles.answerButtonLabel}>
                        No
                      </ThemedText>
                    )}
                  </Pressable>
                </View>
              )}

              {openError ? (
                <View style={styles.errorBlock}>
                  <ThemedText type="small" style={styles.errorText}>
                    {openError}
                  </ThemedText>
                  <Pressable onPress={retryOpen} style={styles.secondaryButton}>
                    <ThemedText type="default">Thử lại</ThemedText>
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

      {justAnsweredYes ? <CelebrationOverlay /> : null}
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
  lockIcon: {
    fontSize: 48,
  },
  lockedActionsRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  editButton: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: '#208AEF',
  },
  editButtonLabel: {
    color: '#ffffff',
    fontWeight: '600',
  },
  deleteButton: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: '#d92d20',
    minWidth: 64,
    alignItems: 'center',
  },
  deleteButtonLabel: {
    color: '#ffffff',
    fontWeight: '600',
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
  contentCard: {
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Spacing.three,
    backgroundColor: '#F0F0F3',
  },
  photo: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Spacing.two,
  },
  followUpBlock: {
    gap: Spacing.three,
  },
  answerRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  answerButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
  },
  answerButtonYes: {
    backgroundColor: '#208AEF',
  },
  answerButtonNo: {
    backgroundColor: '#60646C',
  },
  answerButtonDisabled: {
    opacity: 0.6,
  },
  answerButtonLabel: {
    color: '#ffffff',
    fontWeight: '600',
  },
  answerBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  errorBlock: {
    gap: Spacing.two,
  },
  errorText: {
    color: '#d92d20',
  },
  secondaryButton: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  doneButton: {
    alignSelf: 'center',
    backgroundColor: '#208AEF',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.six,
  },
  doneButtonLabel: {
    color: '#ffffff',
    fontWeight: '600',
  },
  celebrationOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  celebrationEmoji: {
    fontSize: 96,
  },
  celebrationText: {
    color: '#ffffff',
  },
});
