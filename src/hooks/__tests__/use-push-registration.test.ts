import { renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockGetPermissionsAsync = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockGetExpoPushTokenAsync = jest.fn();
const mockAddNotificationResponseReceivedListener = jest.fn((..._args: unknown[]) => ({ remove: jest.fn() }));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
  getExpoPushTokenAsync: (...args: unknown[]) => mockGetExpoPushTokenAsync(...args),
  addNotificationResponseReceivedListener: (...args: unknown[]) =>
    mockAddNotificationResponseReceivedListener(...args),
}));

const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockRouterPush(...args) },
}));

const mockUpsertPushToken = jest.fn();
jest.mock('@/services/push-tokens', () => ({
  upsertPushToken: (...args: unknown[]) => mockUpsertPushToken(...args),
}));

import { usePushRegistration } from '@/hooks/use-push-registration';

const USER_ID = 'user-1';

describe('usePushRegistration', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockUpsertPushToken.mockResolvedValue({ id: 'token-1' });
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
    await AsyncStorage.clear();
  });

  it('registers the token when permission is already granted', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });

    renderHook(() => usePushRegistration(USER_ID));

    await waitFor(() => expect(mockUpsertPushToken).toHaveBeenCalledTimes(1));
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockUpsertPushToken).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, expoPushToken: 'ExponentPushToken[abc]' })
    );
  });

  it('requests permission and registers the token when granted after asking', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted' });

    renderHook(() => usePushRegistration(USER_ID));

    await waitFor(() => expect(mockUpsertPushToken).toHaveBeenCalledTimes(1));
    expect(mockRequestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the user denies permission (no token fetch, no upsert, no throw)', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'denied' });

    renderHook(() => usePushRegistration(USER_ID));

    await waitFor(() => expect(mockRequestPermissionsAsync).toHaveBeenCalledTimes(1));
    expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(mockUpsertPushToken).not.toHaveBeenCalled();
  });

  it('does not throw or crash when the upsert fails with a network error', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockUpsertPushToken.mockRejectedValue(new Error('network request failed'));

    expect(() => renderHook(() => usePushRegistration(USER_ID))).not.toThrow();

    await waitFor(() => expect(mockUpsertPushToken).toHaveBeenCalledTimes(1));
  });

  it('does not register anything when there is no logged-in user yet', async () => {
    renderHook(() => usePushRegistration(undefined));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockGetPermissionsAsync).not.toHaveBeenCalled();
    expect(mockUpsertPushToken).not.toHaveBeenCalled();
  });

  it('registers a listener for notification taps and navigates to the box on tap', () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });

    renderHook(() => usePushRegistration(USER_ID));

    expect(mockAddNotificationResponseReceivedListener).toHaveBeenCalledTimes(1);
    const listener = mockAddNotificationResponseReceivedListener.mock.calls[0][0] as (response: unknown) => void;

    listener({ notification: { request: { content: { data: { boxId: 'box-42' } } } } });

    expect(mockRouterPush).toHaveBeenCalledWith('/(app)/box/box-42');
  });
});
