import { act, renderHook } from '@testing-library/react-native';

const mockUploadBoxPhoto = jest.fn();
const mockDeleteBoxPhoto = jest.fn();
const mockInsertBox = jest.fn();
const mockDeleteBox = jest.fn();
const mockInsertBoxAttachment = jest.fn();

jest.mock('@/services/boxes', () => ({
  uploadBoxPhoto: (...args: unknown[]) => mockUploadBoxPhoto(...args),
  deleteBoxPhoto: (...args: unknown[]) => mockDeleteBoxPhoto(...args),
  insertBox: (...args: unknown[]) => mockInsertBox(...args),
  deleteBox: (...args: unknown[]) => mockDeleteBox(...args),
  insertBoxAttachment: (...args: unknown[]) => mockInsertBoxAttachment(...args),
}));

import { useCreateBox, type CreateBoxInput } from '@/hooks/use-create-box';

const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

function baseInput(overrides: Partial<CreateBoxInput> = {}): CreateBoxInput {
  return {
    userId: 'user-1',
    contentText: 'Gửi cho tương lai của tôi',
    openAt: futureDate,
    followUpQuestion: '',
    photo: null,
    ...overrides,
  };
}

describe('useCreateBox', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteBoxPhoto.mockResolvedValue(undefined);
    mockDeleteBox.mockResolvedValue(undefined);
  });

  it('creates a box without a photo successfully', async () => {
    mockInsertBox.mockResolvedValue({ id: 'box-1' });
    const { result } = renderHook(() => useCreateBox());

    let response: { error: string | null } | undefined;
    await act(async () => {
      response = await result.current.createBox(baseInput());
    });

    expect(response).toEqual({ error: null });
    expect(mockUploadBoxPhoto).not.toHaveBeenCalled();
    expect(mockInsertBox).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', contentText: 'Gửi cho tương lai của tôi' })
    );
    expect(mockInsertBoxAttachment).not.toHaveBeenCalled();
  });

  it('creates a box with a photo: uploads first, then inserts box, then the attachment', async () => {
    mockUploadBoxPhoto.mockResolvedValue('user-1/abc.jpg');
    mockInsertBox.mockResolvedValue({ id: 'box-1' });
    mockInsertBoxAttachment.mockResolvedValue({ id: 'att-1' });

    const { result } = renderHook(() => useCreateBox());

    let response: { error: string | null } | undefined;
    await act(async () => {
      response = await result.current.createBox(
        baseInput({ photo: { uri: 'file://p.jpg', mimeType: 'image/jpeg', sizeBytes: 1000 } })
      );
    });

    expect(response).toEqual({ error: null });
    const uploadOrder = mockUploadBoxPhoto.mock.invocationCallOrder[0];
    const insertBoxOrder = mockInsertBox.mock.invocationCallOrder[0];
    const insertAttachmentOrder = mockInsertBoxAttachment.mock.invocationCallOrder[0];
    expect(uploadOrder).toBeLessThan(insertBoxOrder);
    expect(insertBoxOrder).toBeLessThan(insertAttachmentOrder);
    expect(mockInsertBoxAttachment).toHaveBeenCalledWith(
      expect.objectContaining({ boxId: 'box-1', storagePath: 'user-1/abc.jpg' })
    );
  });

  it('rejects empty content text without calling any service', async () => {
    const { result } = renderHook(() => useCreateBox());

    let response: { error: string | null } | undefined;
    await act(async () => {
      response = await result.current.createBox(baseInput({ contentText: '' }));
    });

    expect(response?.error).toBeTruthy();
    expect(mockInsertBox).not.toHaveBeenCalled();
  });

  it('rejects content text over 2000 characters', async () => {
    const { result } = renderHook(() => useCreateBox());

    let response: { error: string | null } | undefined;
    await act(async () => {
      response = await result.current.createBox(baseInput({ contentText: 'a'.repeat(2001) }));
    });

    expect(response?.error).toBeTruthy();
    expect(mockInsertBox).not.toHaveBeenCalled();
  });

  it('rejects an open_at date in the past', async () => {
    const { result } = renderHook(() => useCreateBox());

    let response: { error: string | null } | undefined;
    await act(async () => {
      response = await result.current.createBox(baseInput({ openAt: pastDate }));
    });

    expect(response?.error).toBeTruthy();
    expect(mockInsertBox).not.toHaveBeenCalled();
  });

  it('rejects a follow-up question over 200 characters', async () => {
    const { result } = renderHook(() => useCreateBox());

    let response: { error: string | null } | undefined;
    await act(async () => {
      response = await result.current.createBox(baseInput({ followUpQuestion: 'a'.repeat(201) }));
    });

    expect(response?.error).toBeTruthy();
    expect(mockInsertBox).not.toHaveBeenCalled();
  });

  it('rejects a photo over 5MB', async () => {
    const { result } = renderHook(() => useCreateBox());

    let response: { error: string | null } | undefined;
    await act(async () => {
      response = await result.current.createBox(
        baseInput({ photo: { uri: 'file://big.jpg', mimeType: 'image/jpeg', sizeBytes: 6 * 1024 * 1024 } })
      );
    });

    expect(response?.error).toBeTruthy();
    expect(mockUploadBoxPhoto).not.toHaveBeenCalled();
  });

  it('surfaces a network error message when insertBox fails and cleans up the uploaded photo', async () => {
    mockUploadBoxPhoto.mockResolvedValue('user-1/abc.jpg');
    mockInsertBox.mockRejectedValue(new Error('network request failed'));

    const { result } = renderHook(() => useCreateBox());

    let response: { error: string | null } | undefined;
    await act(async () => {
      response = await result.current.createBox(
        baseInput({ photo: { uri: 'file://p.jpg', mimeType: 'image/jpeg', sizeBytes: 1000 } })
      );
    });

    expect(response?.error).toBeTruthy();
    expect(mockDeleteBoxPhoto).toHaveBeenCalledWith('user-1/abc.jpg');
  });

  it('does not create a box when the photo upload fails', async () => {
    mockUploadBoxPhoto.mockRejectedValue(new Error('upload failed'));

    const { result } = renderHook(() => useCreateBox());

    let response: { error: string | null } | undefined;
    await act(async () => {
      response = await result.current.createBox(
        baseInput({ photo: { uri: 'file://p.jpg', mimeType: 'image/jpeg', sizeBytes: 1000 } })
      );
    });

    expect(response?.error).toBeTruthy();
    expect(mockInsertBox).not.toHaveBeenCalled();
  });

  it('rolls back the photo and the box when insertBoxAttachment fails', async () => {
    mockUploadBoxPhoto.mockResolvedValue('user-1/abc.jpg');
    mockInsertBox.mockResolvedValue({ id: 'box-1' });
    mockInsertBoxAttachment.mockRejectedValue(new Error('attachment insert failed'));

    const { result } = renderHook(() => useCreateBox());

    let response: { error: string | null } | undefined;
    await act(async () => {
      response = await result.current.createBox(
        baseInput({ photo: { uri: 'file://p.jpg', mimeType: 'image/jpeg', sizeBytes: 1000 } })
      );
    });

    expect(response?.error).toBeTruthy();
    expect(mockDeleteBoxPhoto).toHaveBeenCalledWith('user-1/abc.jpg');
    expect(mockDeleteBox).toHaveBeenCalledWith('box-1');
  });
});
