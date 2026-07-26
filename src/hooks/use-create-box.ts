import { useCallback, useState } from 'react';

import {
  isFutureOpenAt,
  isValidBoxContentText,
  isValidBoxImage,
  isValidFollowUpQuestion,
} from '@/lib/validation';
import { deleteBox, deleteBoxPhoto, insertBox, insertBoxAttachment, uploadBoxPhoto } from '@/services/boxes';

export type CreateBoxPhoto = {
  uri: string;
  mimeType: string;
  sizeBytes: number;
};

export type CreateBoxInput = {
  userId: string;
  contentText: string;
  openAt: Date;
  followUpQuestion: string;
  photo: CreateBoxPhoto | null;
};

export type CreateBoxResult = { error: string | null };

const NETWORK_ERROR_MESSAGE = 'Không có kết nối mạng, vui lòng thử lại.';

function validate(input: CreateBoxInput): string | null {
  if (!isValidBoxContentText(input.contentText)) {
    return 'Nội dung cần từ 1 đến 2000 ký tự.';
  }
  if (!isFutureOpenAt(input.openAt)) {
    return 'Ngày mở phải là thời điểm trong tương lai.';
  }
  if (input.followUpQuestion && !isValidFollowUpQuestion(input.followUpQuestion)) {
    return 'Câu hỏi follow-up tối đa 200 ký tự.';
  }
  if (input.photo && !isValidBoxImage(input.photo)) {
    return 'Ảnh phải là JPEG/PNG và tối đa 5MB.';
  }
  return null;
}

function mapSubmitError(error: unknown): string {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';

  if (/network/i.test(message) || error instanceof TypeError) {
    return NETWORK_ERROR_MESSAGE;
  }
  if (message) return message;
  return 'Đã xảy ra lỗi, vui lòng thử lại.';
}

/**
 * Orchestrate luồng tạo hộp theo activity diagram 02: upload ảnh (nếu có) trước,
 * rồi insert boxes, rồi insert box_attachments — dọn ảnh/box orphan nếu bước sau thất bại.
 */
export function useCreateBox() {
  const [submitting, setSubmitting] = useState(false);

  const createBox = useCallback(async (input: CreateBoxInput): Promise<CreateBoxResult> => {
    const validationError = validate(input);
    if (validationError) {
      return { error: validationError };
    }

    setSubmitting(true);
    let uploadedPhotoPath: string | null = null;

    try {
      if (input.photo) {
        try {
          uploadedPhotoPath = await uploadBoxPhoto({
            userId: input.userId,
            uri: input.photo.uri,
            mimeType: input.photo.mimeType,
          });
        } catch (err) {
          return { error: mapSubmitError(err) };
        }
      }

      let box;
      try {
        box = await insertBox({
          userId: input.userId,
          contentText: input.contentText.trim(),
          openAt: input.openAt.toISOString(),
          followUpQuestion: input.followUpQuestion.trim() || null,
        });
      } catch (err) {
        if (uploadedPhotoPath) await deleteBoxPhoto(uploadedPhotoPath).catch(() => {});
        return { error: mapSubmitError(err) };
      }

      if (input.photo && uploadedPhotoPath) {
        try {
          await insertBoxAttachment({
            boxId: box.id,
            userId: input.userId,
            storagePath: uploadedPhotoPath,
            mimeType: input.photo.mimeType as 'image/jpeg' | 'image/png',
            sizeBytes: input.photo.sizeBytes,
          });
        } catch (err) {
          await deleteBoxPhoto(uploadedPhotoPath).catch(() => {});
          await deleteBox(box.id).catch(() => {});
          return { error: mapSubmitError(err) };
        }
      }

      return { error: null };
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { createBox, submitting };
}
