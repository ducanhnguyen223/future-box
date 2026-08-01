import { useState } from 'react';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField } from '@/components/form-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useCreateBox, type CreateBoxPhoto } from '@/hooks/use-create-box';
import {
  isFutureOpenAt,
  isValidBoxContentText,
  isValidBoxImage,
  isValidFollowUpQuestion,
  MAX_CONTENT_TEXT_LENGTH,
  MAX_FOLLOW_UP_QUESTION_LENGTH,
} from '@/lib/validation';

const DEFAULT_OPEN_AT = new Date(Date.now() + 24 * 60 * 60 * 1000); // mai, mặc định gợi ý ngày mở gần nhất
const MIN_OPEN_AT = new Date(Date.now() + 60 * 1000); // native picker cần minimumDate lớn hơn "bây giờ" một chút

export default function CreateBoxScreen() {
  const { session } = useAuth();
  const { createBox, submitting } = useCreateBox();

  const [contentText, setContentText] = useState('');
  const [openAt, setOpenAt] = useState(DEFAULT_OPEN_AT);
  const [photo, setPhoto] = useState<CreateBoxPhoto | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [wantsFollowUp, setWantsFollowUp] = useState(false);
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [touched, setTouched] = useState({ contentText: false, followUpQuestion: false });
  const [formError, setFormError] = useState<string | null>(null);

  const contentError =
    touched.contentText && !isValidBoxContentText(contentText)
      ? 'Nội dung cần từ 1 đến 2000 ký tự.'
      : undefined;
  const followUpError =
    touched.followUpQuestion && wantsFollowUp && !isValidFollowUpQuestion(followUpQuestion)
      ? `Câu hỏi tối đa ${MAX_FOLLOW_UP_QUESTION_LENGTH} ký tự.`
      : undefined;

  const isFormValid =
    isValidBoxContentText(contentText) &&
    isFutureOpenAt(openAt) &&
    (!wantsFollowUp || isValidFollowUpQuestion(followUpQuestion)) &&
    (!photo || isValidBoxImage(photo));

  const handlePickImage = async () => {
    setPhotoError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPhotoError('Cần quyền truy cập thư viện ảnh để đính kèm ảnh.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    const candidate: CreateBoxPhoto = {
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
      sizeBytes: asset.fileSize ?? 0,
    };

    if (!isValidBoxImage(candidate)) {
      setPhotoError('Ảnh phải là JPEG/PNG và tối đa 5MB.');
      return;
    }

    setPhoto(candidate);
  };

  const handleSubmit = async () => {
    setTouched({ contentText: true, followUpQuestion: true });
    if (!isFormValid || !session?.user.id) return;

    setFormError(null);
    const { error } = await createBox({
      userId: session.user.id,
      contentText,
      openAt,
      followUpQuestion: wantsFollowUp ? followUpQuestion : '',
      photo,
    });

    if (error) {
      setFormError(error);
      return;
    }

    router.back();
  };

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

          <View style={styles.field}>
            <ThemedText type="smallBold" themeColor="ink2">
              Ảnh đính kèm (tùy chọn)
            </ThemedText>
            {photo ? (
              <View>
                <Image source={{ uri: photo.uri }} style={styles.photoPreview} contentFit="cover" />
                <Pressable onPress={() => setPhoto(null)} style={styles.removePhotoButton} hitSlop={8}>
                  <ThemedText type="monoLabel" style={styles.removePhotoLabel}>
                    Xóa ảnh
                  </ThemedText>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={handlePickImage} style={styles.addPhotoButton}>
                <ThemedText type="default" themeColor="ink2">
                  + Thêm ảnh
                </ThemedText>
              </Pressable>
            )}
            {photoError ? (
              <ThemedText type="small" style={styles.error}>
                {photoError}
              </ThemedText>
            ) : null}
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
                Lưu
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
  addPhotoButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.ink3,
    borderRadius: Radius,
    paddingVertical: Spacing.four,
    alignItems: 'center',
  },
  photoPreview: {
    width: '100%',
    height: 180,
    borderRadius: Radius,
  },
  removePhotoButton: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    backgroundColor: Colors.ink,
    borderRadius: Radius,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  removePhotoLabel: {
    color: Colors.paper,
  },
  errorBanner: {
    borderRadius: Radius,
    padding: Spacing.three,
  },
  errorText: {
    color: Colors.red,
  },
  error: {
    color: Colors.red,
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
