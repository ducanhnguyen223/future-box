import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';

import { upsertPushToken } from '@/services/push-tokens';

const DEVICE_ID_STORAGE_KEY = 'futurebox_device_id';

/**
 * ponytail: push_tokens.device_id chỉ cần ổn định theo từng lượt cài app để phân biệt
 * nhiều thiết bị của cùng 1 user — không cần expo-application/native device id (bị giới hạn
 * quyền trên Android, đổi theo vendor trên iOS). Một id ngẫu nhiên lưu AsyncStorage là đủ,
 * tái dùng dependency đã có sẵn trong repo (xem use-box-list.ts).
 */
async function getOrCreateDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing) return existing;

  const generated = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
  return generated;
}

/**
 * Xin quyền notification (nếu chưa có) rồi lấy Expo push token và lưu vào push_tokens.
 * Trả về true nếu quyền được cấp (kể cả khi đã cấp sẵn từ trước), false nếu user từ chối.
 * Từ chối quyền: không lấy token, không upsert, không lỗi/crash (đúng AC #6).
 */
export async function registerPushToken(userId: string): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    ({ status: finalStatus } = await Notifications.requestPermissionsAsync());
  }
  if (finalStatus !== 'granted') return false;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  const deviceId = await getOrCreateDeviceId();

  await upsertPushToken({ userId, expoPushToken, deviceId });
  return true;
}

/**
 * Feature #6 (activity diagram 06 - AppSide): xin quyền + đăng ký push token khi user đã
 * đăng nhập, và điều hướng vào chi tiết hộp khi user tap push notification (data.boxId).
 * Gọi 1 lần cho mỗi userId (StrictMode-safe qua ref) — không hỏi lại quyền nếu đã có/đã từ chối.
 */
export function usePushRegistration(userId: string | undefined): void {
  const registeredForUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || registeredForUserId.current === userId) return;
    registeredForUserId.current = userId;

    registerPushToken(userId).catch(() => {
      // ponytail: đăng ký push là phụ trợ — lỗi mạng/permission không được làm crash app.
    });
  }, [userId]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const boxId = response.notification.request.content.data?.boxId;
      if (typeof boxId === 'string') {
        router.push(`/(app)/box/${boxId}`);
      }
    });
    return () => subscription.remove();
  }, []);
}

/**
 * Cho màn Cài đặt: đọc trạng thái quyền notification hiện tại + cho user chủ động bật.
 * Không thể tắt quyền từ trong app (hệ điều hành không cho) — nếu đã cấp, dẫn ra Cài đặt hệ thống.
 */
export function useNotificationPermission(userId: string | undefined) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setEnabled(status === 'granted');
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const granted = await registerPushToken(userId);
      setEnabled(granted);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const openSystemSettings = useCallback(() => {
    Linking.openSettings();
  }, []);

  return { enabled, loading, enable, openSystemSettings, refresh };
}
