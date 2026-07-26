import { supabase } from '@/lib/supabase';
import type { PushToken } from '@/types/database';

export type UpsertPushTokenParams = {
  userId: string;
  expoPushToken: string;
  deviceId: string;
};

/**
 * Upsert push token (Feature #6): unique(user_id, device_id) trong schema đảm bảo mỗi
 * thiết bị của user chỉ có 1 row, cập nhật token mới nhất nếu app reinstall/token đổi.
 */
export async function upsertPushToken(params: UpsertPushTokenParams): Promise<PushToken> {
  const { data, error } = await supabase
    .from('push_tokens')
    .upsert(
      { user_id: params.userId, expo_push_token: params.expoPushToken, device_id: params.deviceId },
      { onConflict: 'user_id,device_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data as PushToken;
}
