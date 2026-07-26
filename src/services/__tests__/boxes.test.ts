const mockUpload = jest.fn();
const mockRemove = jest.fn();
const mockStorageFrom = jest.fn((..._args: unknown[]) => ({ upload: mockUpload, remove: mockRemove }));

const mockSingle = jest.fn();
const mockOrder = jest.fn();
const mockQueryEq = jest.fn(() => ({ order: mockOrder }));
const mockSelect = jest.fn(() => ({ single: mockSingle, eq: mockQueryEq }));
const mockInsert = jest.fn(() => ({ select: mockSelect }));
const mockEq = jest.fn();
const mockDelete = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn((..._args: unknown[]) => ({ insert: mockInsert, delete: mockDelete, select: mockSelect }));

// Wrap in closures (not direct references) so the mock factory doesn't capture
// these consts' values before they're initialized — jest hoists jest.mock()
// (and the imports that trigger it) above these declarations.
jest.mock('@/lib/supabase', () => ({
  supabase: {
    storage: { from: (...args: unknown[]) => mockStorageFrom(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import {
  deleteBox,
  deleteBoxPhoto,
  fetchBoxesWithStatus,
  insertBox,
  insertBoxAttachment,
  uploadBoxPhoto,
} from '@/services/boxes';

describe('boxes service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = jest.fn().mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
  });

  describe('uploadBoxPhoto', () => {
    it('uploads under a userId-prefixed path with the correct content type', async () => {
      mockUpload.mockResolvedValue({ data: { path: 'x' }, error: null });

      const path = await uploadBoxPhoto({ userId: 'user-1', uri: 'file://photo.jpg', mimeType: 'image/jpeg' });

      expect(mockStorageFrom).toHaveBeenCalledWith('box-photos');
      expect(path.startsWith('user-1/')).toBe(true);
      expect(path.endsWith('.jpg')).toBe(true);
      expect(mockUpload).toHaveBeenCalledWith(
        path,
        expect.any(ArrayBuffer),
        expect.objectContaining({ contentType: 'image/jpeg', upsert: false })
      );
    });

    it('uses .png extension for PNG images', async () => {
      mockUpload.mockResolvedValue({ data: { path: 'x' }, error: null });

      const path = await uploadBoxPhoto({ userId: 'user-1', uri: 'file://photo.png', mimeType: 'image/png' });

      expect(path.endsWith('.png')).toBe(true);
    });

    it('throws when the storage upload fails (no box should be created afterwards)', async () => {
      mockUpload.mockResolvedValue({ data: null, error: new Error('storage down') });

      await expect(
        uploadBoxPhoto({ userId: 'user-1', uri: 'file://photo.jpg', mimeType: 'image/jpeg' })
      ).rejects.toThrow('storage down');
    });
  });

  it('deleteBoxPhoto removes the given path from the bucket', async () => {
    mockRemove.mockResolvedValue({ data: null, error: null });

    await deleteBoxPhoto('user-1/abc.jpg');

    expect(mockStorageFrom).toHaveBeenCalledWith('box-photos');
    expect(mockRemove).toHaveBeenCalledWith(['user-1/abc.jpg']);
  });

  describe('insertBox', () => {
    it('inserts a row and returns the created box', async () => {
      const box = { id: 'box-1', user_id: 'user-1', content_text: 'hello' };
      mockSingle.mockResolvedValue({ data: box, error: null });

      const result = await insertBox({
        userId: 'user-1',
        contentText: 'hello',
        openAt: '2030-01-01T00:00:00.000Z',
        followUpQuestion: null,
      });

      expect(mockFrom).toHaveBeenCalledWith('boxes');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'user-1', content_text: 'hello', follow_up_question: null })
      );
      expect(result).toEqual(box);
    });

    it('throws on insert failure (e.g. network error)', async () => {
      mockSingle.mockResolvedValue({ data: null, error: new Error('network request failed') });

      await expect(
        insertBox({ userId: 'user-1', contentText: 'hello', openAt: '2030-01-01T00:00:00.000Z', followUpQuestion: null })
      ).rejects.toThrow('network request failed');
    });
  });

  it('insertBoxAttachment inserts a row referencing the box and returns it', async () => {
    const attachment = { id: 'att-1', box_id: 'box-1', storage_path: 'user-1/abc.jpg' };
    mockSingle.mockResolvedValue({ data: attachment, error: null });

    const result = await insertBoxAttachment({
      boxId: 'box-1',
      userId: 'user-1',
      storagePath: 'user-1/abc.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
    });

    expect(mockFrom).toHaveBeenCalledWith('box_attachments');
    expect(result).toEqual(attachment);
  });

  describe('fetchBoxesWithStatus', () => {
    it('queries boxes_with_status filtered by user and ordered by open_at', async () => {
      const boxes = [{ id: 'box-1', status: 'locked' }];
      mockOrder.mockResolvedValue({ data: boxes, error: null });

      const result = await fetchBoxesWithStatus('user-1');

      expect(mockFrom).toHaveBeenCalledWith('boxes_with_status');
      expect(mockQueryEq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockOrder).toHaveBeenCalledWith('open_at', { ascending: true });
      expect(result).toEqual(boxes);
    });

    it('returns an empty array when there is no data', async () => {
      mockOrder.mockResolvedValue({ data: null, error: null });

      const result = await fetchBoxesWithStatus('user-1');

      expect(result).toEqual([]);
    });

    it('throws on query failure', async () => {
      mockOrder.mockResolvedValue({ data: null, error: new Error('network request failed') });

      await expect(fetchBoxesWithStatus('user-1')).rejects.toThrow('network request failed');
    });
  });

  it('deleteBox removes the box row by id', async () => {
    mockEq.mockResolvedValue({ data: null, error: null });

    await deleteBox('box-1');

    expect(mockFrom).toHaveBeenCalledWith('boxes');
    expect(mockDelete).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith('id', 'box-1');
  });
});
