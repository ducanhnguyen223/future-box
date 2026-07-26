import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockFetchBoxesWithStatus = jest.fn();

jest.mock('@/services/boxes', () => ({
  fetchBoxesWithStatus: (...args: unknown[]) => mockFetchBoxesWithStatus(...args),
}));

import { useBoxList } from '@/hooks/use-box-list';
import type { BoxWithStatus } from '@/types/database';

const USER_ID = 'user-1';

function makeBox(overrides: Partial<BoxWithStatus>): BoxWithStatus {
  return {
    id: 'box-1',
    user_id: USER_ID,
    content_text: 'hello',
    open_at: '2030-01-01T00:00:00.000Z',
    opened_at: null,
    follow_up_question: null,
    follow_up_answer: null,
    follow_up_answered_at: null,
    notified_at: null,
    created_at: '2029-01-01T00:00:00.000Z',
    updated_at: '2029-01-01T00:00:00.000Z',
    status: 'locked',
    ...overrides,
  };
}

describe('useBoxList', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('fetches successfully and groups boxes by status', async () => {
    const boxes = [
      makeBox({ id: 'b-locked', status: 'locked' }),
      makeBox({ id: 'b-ready', status: 'ready' }),
      makeBox({ id: 'b-opened', status: 'opened' }),
    ];
    mockFetchBoxesWithStatus.mockResolvedValue(boxes);

    const { result } = renderHook(() => useBoxList(USER_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.offline).toBe(false);
    expect(result.current.locked.map((b) => b.id)).toEqual(['b-locked']);
    expect(result.current.ready.map((b) => b.id)).toEqual(['b-ready']);
    expect(result.current.opened.map((b) => b.id)).toEqual(['b-opened']);
  });

  it('falls back to cache and marks offline when fetch fails', async () => {
    const cached = [makeBox({ id: 'b-cached', status: 'ready' })];
    await AsyncStorage.setItem(`boxes_cache_${USER_ID}`, JSON.stringify(cached));
    mockFetchBoxesWithStatus.mockRejectedValue(new Error('network request failed'));

    const { result } = renderHook(() => useBoxList(USER_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.offline).toBe(true);
    expect(result.current.ready.map((b) => b.id)).toEqual(['b-cached']);
  });

  it('has no network: uses cache from a previous successful load on refresh', async () => {
    const first = [makeBox({ id: 'b-1', status: 'opened' })];
    mockFetchBoxesWithStatus.mockResolvedValueOnce(first);

    const { result } = renderHook(() => useBoxList(USER_ID));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.offline).toBe(false);

    mockFetchBoxesWithStatus.mockRejectedValueOnce(new Error('network request failed'));
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.offline).toBe(true);
    expect(result.current.opened.map((b) => b.id)).toEqual(['b-1']);
  });

  it('returns an empty list when the user has no boxes', async () => {
    mockFetchBoxesWithStatus.mockResolvedValue([]);

    const { result } = renderHook(() => useBoxList(USER_ID));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.boxes).toEqual([]);
    expect(result.current.locked).toEqual([]);
    expect(result.current.ready).toEqual([]);
    expect(result.current.opened).toEqual([]);
    expect(result.current.offline).toBe(false);
  });
});
