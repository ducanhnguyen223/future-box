import { useCallback, useEffect, useState } from 'react';

import { fetchBoxAttachmentUrl, fetchBoxById, openBox } from '@/services/boxes';
import type { Box } from '@/types/database';

const NETWORK_ERROR_MESSAGE = 'Không có kết nối mạng, vui lòng thử lại.';

function mapError(error: unknown): string {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';

  if (/network/i.test(message) || error instanceof TypeError) {
    return NETWORK_ERROR_MESSAGE;
  }
  return message || 'Đã xảy ra lỗi, vui lòng thử lại.';
}

/**
 * Luồng mở hộp (Feature #4, activity diagram 04): đọc row trước để biết open_at/opened_at/
 * follow_up_question — KHÔNG gọi RPC open_box chỉ để "check", chỉ gọi khi thật sự cần set
 * opened_at (ngay sau khi hiển thị nội dung nếu không có follow-up, hoặc sau khi user chọn
 * Yes/No). Điều kiện `now() >= open_at` hiển thị ở đây chỉ là gợi ý UI — quyết định thật luôn
 * do server (RPC) enforce, chống gian lận đổi giờ máy.
 */
export function useOpenBox(boxId: string | undefined) {
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [wasAlreadyOpened, setWasAlreadyOpened] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);

  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [pendingAnswer, setPendingAnswer] = useState<boolean | null>(null);
  const [justAnsweredYes, setJustAnsweredYes] = useState(false);

  useEffect(() => {
    if (!boxId) return;
    let cancelled = false;

    setLoading(true);
    setFetchError(null);
    fetchBoxById(boxId)
      .then((current) => {
        if (cancelled) return;
        setBox(current);
        setWasAlreadyOpened(current.opened_at !== null);
      })
      .catch((err) => {
        if (!cancelled) setFetchError(mapError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [boxId]);

  const blocked = !!box && !wasAlreadyOpened && new Date(box.open_at).getTime() > Date.now();
  const needsFollowUpAnswer =
    !!box && !wasAlreadyOpened && !blocked && !!box.follow_up_question && box.follow_up_answered_at === null;

  const performOpen = useCallback(
    async (answer?: boolean) => {
      if (!boxId) return;
      if (answer !== undefined) setPendingAnswer(answer);
      setOpening(true);
      setOpenError(null);
      try {
        const updated = await openBox(boxId, answer);
        setBox(updated);
        if (answer === true) setJustAnsweredYes(true);
      } catch (err) {
        setOpenError(mapError(err));
      } finally {
        setOpening(false);
      }
    },
    [boxId]
  );

  // Không follow-up: tự động set opened_at ngay sau khi nội dung đủ điều kiện hiển thị.
  useEffect(() => {
    if (!box || wasAlreadyOpened || blocked || box.follow_up_question || box.opened_at) return;
    if (opening || openError) return;
    performOpen();
  }, [box, wasAlreadyOpened, blocked, opening, openError, performOpen]);

  // Ảnh đính kèm: chỉ cần khi nội dung sẽ được hiển thị (đã mở trước đó hoặc đủ điều kiện mở).
  useEffect(() => {
    if (!box || blocked) return;
    let cancelled = false;
    fetchBoxAttachmentUrl(box.id)
      .then((url) => {
        if (!cancelled) setAttachmentUrl(url);
      })
      .catch(() => {
        // ponytail: ảnh là phụ, lỗi lấy signed URL không nên chặn xem nội dung chính.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box?.id, blocked]);

  const submitAnswer = useCallback((answer: boolean) => performOpen(answer), [performOpen]);
  const retryOpen = useCallback(() => performOpen(pendingAnswer ?? undefined), [performOpen, pendingAnswer]);

  return {
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
  };
}
