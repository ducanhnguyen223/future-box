import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockFetchBoxById = jest.fn();
const mockOpenBox = jest.fn();
const mockFetchBoxAttachmentUrl = jest.fn();

jest.mock('@/services/boxes', () => ({
  fetchBoxById: (...args: unknown[]) => mockFetchBoxById(...args),
  openBox: (...args: unknown[]) => mockOpenBox(...args),
  fetchBoxAttachmentUrl: (...args: unknown[]) => mockFetchBoxAttachmentUrl(...args),
}));

import { useOpenBox } from '@/hooks/use-open-box';
import type { Box } from '@/types/database';

const BOX_ID = 'box-1';

function makeBox(overrides: Partial<Box> = {}): Box {
  return {
    id: BOX_ID,
    user_id: 'user-1',
    content_text: 'hello future me',
    open_at: '2020-01-01T00:00:00.000Z',
    opened_at: null,
    follow_up_question: null,
    follow_up_answer: null,
    follow_up_answered_at: null,
    notified_at: null,
    created_at: '2019-01-01T00:00:00.000Z',
    updated_at: '2019-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('useOpenBox', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchBoxAttachmentUrl.mockResolvedValue(null);
  });

  it('blocks viewing when open_at has not been reached yet, without calling the RPC', async () => {
    mockFetchBoxById.mockResolvedValue(makeBox({ open_at: '2999-01-01T00:00:00.000Z' }));

    const { result } = renderHook(() => useOpenBox(BOX_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.blocked).toBe(true);
    expect(mockOpenBox).not.toHaveBeenCalled();
  });

  it('shows read-only content and answer when the box was already opened before', async () => {
    mockFetchBoxById.mockResolvedValue(
      makeBox({
        opened_at: '2020-06-01T00:00:00.000Z',
        follow_up_question: 'Đã giảm cân chưa?',
        follow_up_answer: true,
        follow_up_answered_at: '2020-06-01T00:00:00.000Z',
      })
    );

    const { result } = renderHook(() => useOpenBox(BOX_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.wasAlreadyOpened).toBe(true);
    expect(result.current.blocked).toBe(false);
    expect(result.current.needsFollowUpAnswer).toBe(false);
    expect(mockOpenBox).not.toHaveBeenCalled();
  });

  it('auto marks the box as opened when ready and there is no follow-up question', async () => {
    mockFetchBoxById.mockResolvedValue(makeBox());
    mockOpenBox.mockResolvedValue(makeBox({ opened_at: '2020-01-02T00:00:00.000Z' }));

    const { result } = renderHook(() => useOpenBox(BOX_ID));

    await waitFor(() => expect(mockOpenBox).toHaveBeenCalledWith(BOX_ID, undefined));
    await waitFor(() => expect(result.current.box?.opened_at).not.toBeNull());
    expect(result.current.openError).toBeNull();
  });

  it('calls the RPC with true and marks a celebration when the user answers Yes', async () => {
    mockFetchBoxById.mockResolvedValue(makeBox({ follow_up_question: 'Đã giảm cân chưa?' }));
    mockOpenBox.mockResolvedValue(
      makeBox({
        follow_up_question: 'Đã giảm cân chưa?',
        follow_up_answer: true,
        follow_up_answered_at: '2020-01-02T00:00:00.000Z',
        opened_at: '2020-01-02T00:00:00.000Z',
      })
    );

    const { result } = renderHook(() => useOpenBox(BOX_ID));
    await waitFor(() => expect(result.current.needsFollowUpAnswer).toBe(true));

    await act(async () => {
      await result.current.submitAnswer(true);
    });

    expect(mockOpenBox).toHaveBeenCalledWith(BOX_ID, true);
    expect(result.current.justAnsweredYes).toBe(true);
    expect(result.current.needsFollowUpAnswer).toBe(false);
  });

  it('calls the RPC with false and does not mark a celebration when the user answers No', async () => {
    mockFetchBoxById.mockResolvedValue(makeBox({ follow_up_question: 'Đã giảm cân chưa?' }));
    mockOpenBox.mockResolvedValue(
      makeBox({
        follow_up_question: 'Đã giảm cân chưa?',
        follow_up_answer: false,
        follow_up_answered_at: '2020-01-02T00:00:00.000Z',
        opened_at: '2020-01-02T00:00:00.000Z',
      })
    );

    const { result } = renderHook(() => useOpenBox(BOX_ID));
    await waitFor(() => expect(result.current.needsFollowUpAnswer).toBe(true));

    await act(async () => {
      await result.current.submitAnswer(false);
    });

    expect(mockOpenBox).toHaveBeenCalledWith(BOX_ID, false);
    expect(result.current.justAnsweredYes).toBe(false);
    expect(result.current.needsFollowUpAnswer).toBe(false);
  });

  it('keeps the chosen answer and lets the user retry when saving the RPC fails', async () => {
    mockFetchBoxById.mockResolvedValue(makeBox({ follow_up_question: 'Đã giảm cân chưa?' }));
    mockOpenBox.mockRejectedValueOnce(new Error('network request failed'));

    const { result } = renderHook(() => useOpenBox(BOX_ID));
    await waitFor(() => expect(result.current.needsFollowUpAnswer).toBe(true));

    await act(async () => {
      await result.current.submitAnswer(true);
    });

    expect(result.current.openError).toBe('Không có kết nối mạng, vui lòng thử lại.');
    expect(result.current.needsFollowUpAnswer).toBe(true);
    expect(result.current.pendingAnswer).toBe(true);

    mockOpenBox.mockResolvedValueOnce(
      makeBox({
        follow_up_question: 'Đã giảm cân chưa?',
        follow_up_answer: true,
        follow_up_answered_at: '2020-01-02T00:00:00.000Z',
        opened_at: '2020-01-02T00:00:00.000Z',
      })
    );

    await act(async () => {
      await result.current.retryOpen();
    });

    expect(mockOpenBox).toHaveBeenLastCalledWith(BOX_ID, true);
    expect(result.current.openError).toBeNull();
    expect(result.current.justAnsweredYes).toBe(true);
  });
});
