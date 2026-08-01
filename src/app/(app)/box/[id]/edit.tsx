import { useEffect, useState } from 'react';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField } from '@/components/form-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useEditBox } from '@/hooks/use-box-actions';
import {
  isFutureOpenAt,
  isValidBoxContentText,
  isValidFollowUpQuestion,
  MAX_CONTENT_TEXT_LENGTH,
  MAX_FOLLOW_UP_QUESTION_LENGTH,
} from '@/lib/validation';
import { fetchBoxById } from '@/services/boxes';
import type { Box } from '@/types/database';

const MIN_OPEN_AT = new Date(Date.now() + 60 * 1000);

/**
 * Sửa hộp (Feature #7, activity diagram 07): prefill content_text/open_at/follow_up_question
 * hiện tại, tái dùng validate giống create-box. Chỉ cho sửa khi hộp còn "Đang khóa" — server
 * (trigger guard_box_edit) vẫn re-check lại lúc submit vì trạng thái có thể đổi giữa chừng.
 */
export default function EditBoxScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { editBox, submitting } = useEditBox(id ?? '');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [box, setBox] = useState<Box | null>(null);

  const [contentText, setContentText] = useState('');
  const [openAt, setOpenAt] = useState<Date>(new Date());
  const [wantsFollowUp, setWantsFollowUp] = useState(false);
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [touched, setTouched] = useState({ contentText: false, followUpQuestion: false });
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    fetchBoxById(id)
      .then((current) => {
        if (cancelled) return;
        const isLocked = current.opened_at === null && new Date(current.open_at).getTime() > Date.now();
        if (!isLocked) {
          setLoadError('Hộp đã đến hạn mở, không thể sửa nữa.');
          return;
        }
        setBox(current);
        setContentText(current.content_text);
        setOpenAt(new Date(current.open_at));
        setWantsFollowUp(!!current.follow_up_question);
        setFollowUpQuestion(current.follow_up_question ?? '');
      })
      .catch(() => {
        if (!cancelled) setLoadError('Không tìm thấy hộp này.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const contentError =
    touched.contentText && !isValidBoxContentText(contentText) ? 'Nội dung cần từ 1 đến 2000 ký tự.' : undefined;
  const followUpError =
    touched.followUpQuestion && wantsFollowUp && !isValidFollowUpQuestion(followUpQuestion)
      ? `Câu hỏi tối đa ${MAX_FOLLOW_UP_QUESTION_LENGTH} ký tự.`
      : undefined;

  const isFormValid =
    isValidBoxContentText(contentText) &&
    isFutureOpenAt(openAt) &&
    (!wantsFollowUp || isValidFollowUpQuestion(followUpQuestion));

  const handleSubmit = async () => {
    setTouched({ contentText: true, followUpQuestion: true });
    if (!isFormValid) return;

    setFormError(null);
    const { error } = await editBox({
      contentText,
      openAt,
      followUpQuestion: wantsFollowUp ? followUpQuestion : '',
    });

    if (error) {
      setFormError(error);
      if (/không thể sửa nữa/i.test(error)) {
        router.replace('/(app)');
      }
      return;
    }

    router.replace('/(app)');
  };

  if (loading) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.blue} />
      </ThemedView>
    );
  }

  if (loadError || !box) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ThemedText type="default">{loadError ?? 'Không tìm thấy hộp này.'}</ThemedText>
        <Pressable onPress={() => router.back()} style={styles.secondaryButton}>
          <ThemedText type="default" themeColor="blue">
            Quay lại
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {formError ? (
            <ThemedView type="paperDim" style={styles.errorBanner}>
              <ThemedText type="small" style={styles.errorText}>
                {formError}
              </ThemedText>
            </ThemedView>
          ) : null}

          <View style={styles.field}>
            <FormField
              label="Nội dung gửi tương lai"
              value={contentText}
              onChangeText={(text) => setContentText(text.slice(0, MAX_CONTENT_TEXT_LENGTH))}
              onBlur={() => setTouched((value) => ({ ...value, contentText: true }))}
              error={contentError}
              multiline
              numberOfLines={6}
              style={styles.textArea}
              placeholder="Viết điều gì đó cho chính mình trong tương lai..."
            />
            <ThemedText type="monoLabel" themeColor="ink3" style={styles.counter}>
              {contentText.length}/{MAX_CONTENT_TEXT_LENGTH}
            </ThemedText>
          </View>

          <View style={styles.field}>
            <ThemedText type="smallBold" themeColor="ink2">
              Ngày mở
            </ThemedText>
            <DateTimePicker
              value={openAt}
              mode="date"
              minimumDate={MIN_OPEN_AT}
              onValueChange={(_event, date) => setOpenAt(date)}
            />
          </View>

          <View style={[styles.field, styles.followUpToggleRow]}>
            <ThemedText type="smallBold" themeColor="ink2">
              Thêm câu hỏi follow-up
            </ThemedText>
            <Switch
              value={wantsFollowUp}
              onValueChange={setWantsFollowUp}
              trackColor={{ false: Colors.rule, true: Colors.blue }}
            />
          </View>

          {wantsFollowUp ? (
            <FormField
              label="Câu hỏi (vd: Đã giảm cân chưa?)"
              value={followUpQuestion}
              onChangeText={(text) => setFollowUpQuestion(text.slice(0, MAX_FOLLOW_UP_QUESTION_LENGTH))}
              onBlur={() => setTouched((value) => ({ ...value, followUpQuestion: true }))}
              error={followUpError}
              placeholder="Câu hỏi Yes/No cho tương lai"
            />
          ) : null}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting || !isFormValid}
            style={[styles.submitButton, (submitting || !isFormValid) && styles.submitButtonDisabled]}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.paper} />
            ) : (
              <ThemedText type="default" style={styles.submitLabel}>
                Lưu thay đổi
              </ThemedText>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
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
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  field: {
    gap: Spacing.one,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  counter: {
    textAlign: 'right',
  },
  followUpToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorBanner: {
    borderRadius: Radius,
    padding: Spacing.three,
  },
  errorText: {
    color: Colors.red,
  },
  secondaryButton: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  submitButton: {
    backgroundColor: Colors.blue,
    borderRadius: Radius,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitLabel: {
    color: Colors.paper,
    fontWeight: '600',
  },
});
