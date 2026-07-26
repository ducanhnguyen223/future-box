import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { fetchBoxesWithStatus } from '@/services/boxes';
import type { BoxWithStatus } from '@/types/database';

function cacheKey(userId: string): string {
  return `boxes_cache_${userId}`;
}

async function loadCache(userId: string): Promise<BoxWithStatus[]> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId));
    return raw ? (JSON.parse(raw) as BoxWithStatus[]) : [];
  } catch {
    return [];
  }
}

// ponytail: không phân biệt "mất mạng" với "query lỗi" — cả 2 đều rơi về cache, đúng activity diagram 03.
async function saveCache(userId: string, boxes: BoxWithStatus[]): Promise<void> {
  await AsyncStorage.setItem(cacheKey(userId), JSON.stringify(boxes)).catch(() => {});
}

/**
 * Fetch + cache offline + nhóm theo status cho màn Danh sách hộp (Feature #3).
 * Fetch lỗi (mất mạng hoặc query fail) -> dùng cache gần nhất + báo offline.
 */
export function useBoxList(userId: string | undefined) {
  const [boxes, setBoxes] = useState<BoxWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);

  const load = useCallback(
    async (isRefresh: boolean) => {
      if (!userId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const fresh = await fetchBoxesWithStatus(userId);
        setBoxes(fresh);
        setOffline(false);
        await saveCache(userId, fresh);
      } catch {
        const cached = await loadCache(userId);
        setBoxes(cached);
        setOffline(true);
      } finally {
        if (isRefresh) setRefreshing(false);
        else setLoading(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return {
    loading,
    refreshing,
    offline,
    boxes,
    locked: boxes.filter((box) => box.status === 'locked'),
    ready: boxes.filter((box) => box.status === 'ready'),
    opened: boxes.filter((box) => box.status === 'opened'),
    refresh,
  };
}
