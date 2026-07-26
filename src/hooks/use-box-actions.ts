import { useCallback, useState } from 'react';

import {
  isFutureOpenAt,
  isValidBoxContentText,
  isValidFollowUpQuestion,
} from '@/lib/validation';
import { deleteBoxAndAttachment, updateBox } from '@/services/boxes';

const NETWORK_ERROR_MESSAGE = 'Không có kết nối mạng, vui lòng thử lại.';
const EXPIRED_MESSAGE = 'Hộp đã đến hạn mở, không thể sửa nữa.';
const EXPIRED_DELETE_MESSAGE = 'Hộp đã đến hạn mở, không thể xóa nữa.';

export type EditBoxInput = {
  contentText: string;
  openAt: Date;
  followUpQuestion: string;
};

export type BoxActionResult = { error: string | null };

function validateEdit(input: EditBoxInput): string | null {
  if (!isValidBoxContentText(input.contentText)) {
    return 'Nội dung cần từ 1 đến 2000 ký tự.';
  }
  if (!isFutureOpenAt(input.openAt)) {
    return 'Ngày mở phải là thời điểm trong tương lai.';
  }
  if (input.followUpQuestion && !isValidFollowUpQuestion(input.followUpQuestion)) {
    return 'Câu hỏi follow-up tối đa 200 ký tự.';
  }
  return null;
}

/** true nếu error là do trigger DB guard_box_edit/guard_box_delete reject (hộp hết hạn/đã mở giữa lúc thao tác). */
function isGuardRejection(error: unknown): boolean {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  return /locked-expired or already opened/i.test(message);
}

function mapError(error: unknown, expiredMessage: string): string {
  if (isGuardRejection(error)) return expiredMessage;

  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  if (/network/i.test(message) || error instanceof TypeError) {
    return NETWORK_ERROR_MESSAGE;
  }
  return message || 'Đã xảy ra lỗi, vui lòng thử lại.';
}

/**
 * Sửa hộp (Feature #7, activity diagram 07): validate lại như lúc tạo, rồi UPDATE thường
 * (RLS + trigger DB tự re-check server time — không cần client tự kiểm tra trạng thái).
 */
export function useEditBox(boxId: string) {
  const [submitting, setSubmitting] = useState(false);

  const editBox = useCallback(
    async (input: EditBoxInput): Promise<BoxActionResult> => {
      const validationError = validateEdit(input);
      if (validationError) return { error: validationError };

      setSubmitting(true);
      try {
        await updateBox(boxId, {
          contentText: input.contentText.trim(),
          openAt: input.openAt.toISOString(),
          followUpQuestion: input.followUpQuestion.trim() || null,
        });
        return { error: null };
      } catch (err) {
        return { error: mapError(err, EXPIRED_MESSAGE) };
      } finally {
        setSubmitting(false);
      }
    },
    [boxId]
  );

  return { editBox, submitting };
}

/** Xóa hộp (Feature #7): dọn ảnh Storage nếu có, DB trigger re-check server time lúc xóa. */
export function useDeleteBox(boxId: string) {
  const [deleting, setDeleting] = useState(false);

  const deleteBox = useCallback(async (): Promise<BoxActionResult> => {
    setDeleting(true);
    try {
      await deleteBoxAndAttachment(boxId);
      return { error: null };
    } catch (err) {
      return { error: mapError(err, EXPIRED_DELETE_MESSAGE) };
    } finally {
      setDeleting(false);
    }
  }, [boxId]);

  return { deleteBox, deleting };
}
