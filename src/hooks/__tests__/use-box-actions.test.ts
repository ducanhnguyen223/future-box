import { act, renderHook } from '@testing-library/react-native';

const mockUpdateBox = jest.fn();
const mockDeleteBoxAndAttachment = jest.fn();

jest.mock('@/services/boxes', () => ({
  updateBox: (...args: unknown[]) => mockUpdateBox(...args),
  deleteBoxAndAttachment: (...args: unknown[]) => mockDeleteBoxAndAttachment(...args),
}));

import { useDeleteBox, useEditBox, type EditBoxInput } from '@/hooks/use-box-actions';

const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

function baseEditInput(overrides: Partial<EditBoxInput> = {}): EditBoxInput {
  return {
    contentText: 'Gửi cho tương lai của tôi',
    openAt: futureDate,
    followUpQuestion: '',
    ...overrides,
  };
}

describe('useEditBox', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('edits a box successfully', async () => {
    mockUpdateBox.mockResolvedValue({ id: 'box-1' });
    const { result } = renderHook(() => useEditBox('box-1'));

    let response: { error: string | null } | undefined;
    await act(async () => {
      response = await result.current.editBox(baseEditInput());
    });

    expect(response).toEqual({ error: null });
    expect(mockUpdateBox).toHaveBeenCalledWith(
      'box-1',
      expect.objectContaining({ contentText: 'Gửi cho tương lai của tôi' })
    );
  });

  it('rejects an open_at date in the past without calling updateBox', async () => {
    const { result } = renderHook(() => useEditBox('box-1'));

    let response: { error: string | null } | undefined;
    await act(async () => {
      response = await result.current.editBox(baseEditInput({ openAt: pastDate }));
    });

    expect(response?.error).toBeTruthy();
    expect(mockUpdateBox).not.toHaveBeenCalled();
  });

  it('reports the box-expired message when the DB guard trigger rejects the update', async () => {
    mockUpdateBox.mockRejectedValue(
      new Error('box is locked-expired or already opened, cannot edit content/open_at/follow_up_question')
    );
    const { result } = renderHook(() => useEditBox('box-1'));

    let response: { error: string | null } | undefined;
    await act(async () => {
      response = await result.current.editBox(baseEditInput());
    });

    expect(response?.error).toBe('Hộp đã đến hạn mở, không thể sửa nữa.');
  });
});

describe('useDeleteBox', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes a box successfully (including cleaning up its Storage photo, delegated to the service)', async () => {
    mockDeleteBoxAndAttachment.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteBox('box-1'));

    let response: { error: string | null } | undefined;
    await act(async () => {
      response = await result.current.deleteBox();
    });

    expect(response).toEqual({ error: null });
    expect(mockDeleteBoxAndAttachment).toHaveBeenCalledWith('box-1');
  });

  it('reports the box-expired message when the DB guard trigger rejects the delete', async () => {
    mockDeleteBoxAndAttachment.mockRejectedValue(
      new Error('box is locked-expired or already opened, cannot delete')
    );
    const { result } = renderHook(() => useDeleteBox('box-1'));

    let response: { error: string | null } | undefined;
    await act(async () => {
      response = await result.current.deleteBox();
    });

    expect(response?.error).toBe('Hộp đã đến hạn mở, không thể xóa nữa.');
  });

  it('surfaces a network error message on generic failure', async () => {
    mockDeleteBoxAndAttachment.mockRejectedValue(new TypeError('network request failed'));
    const { result } = renderHook(() => useDeleteBox('box-1'));

    let response: { error: string | null } | undefined;
    await act(async () => {
      response = await result.current.deleteBox();
    });

    expect(response?.error).toBe('Không có kết nối mạng, vui lòng thử lại.');
  });
});
