import { router } from 'expo-router';
import { Alert, Pressable, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useBoxList } from '@/hooks/use-box-list';
import type { BoxWithStatus } from '@/types/database';

const STATUS_LABEL: Record<BoxWithStatus['status'], string> = {
  locked: 'Đang khóa',
  ready: 'Sẵn sàng mở',
  opened: 'Đã mở',
};

const STATUS_ICON: Record<BoxWithStatus['status'], string> = {
  locked: '🔒',
  ready: '🔔',
  opened: '📬',
};

/** Chỉ để hiển thị "còn bao lâu" cho hộp đang khóa — điều kiện mở thật sự luôn do server (status) quyết định. */
function formatRemaining(openAt: string): string {
  const diffMs = new Date(openAt).getTime() - Date.now();
  if (diffMs <= 0) return 'Sắp đến giờ mở.';

  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days >= 1) return `Còn ${days} ngày nữa mới mở được.`;

  const hours = Math.max(1, Math.floor(diffMs / (60 * 60 * 1000)));
  return `Còn khoảng ${hours} giờ nữa mới mở được.`;
}

function formatOpenAt(openAt: string): string {
  return new Date(openAt).toLocaleDateString('vi-VN');
}

export default function BoxListScreen() {
  const { session, signOut } = useAuth();
  const { loading, refreshing, offline, locked, ready, opened, refresh } = useBoxList(session?.user.id);

  const sections = [
    { key: 'locked' as const, title: STATUS_LABEL.locked, data: locked },
    { key: 'ready' as const, title: STATUS_LABEL.ready, data: ready },
    { key: 'opened' as const, title: STATUS_LABEL.opened, data: opened },
  ].filter((section) => section.data.length > 0);

  const isEmpty = !loading && sections.length === 0;

  const handleBoxPress = (box: BoxWithStatus) => {
    if (box.status === 'locked') {
      Alert.alert('Hộp đang khóa', formatRemaining(box.open_at));
      return;
    }
    router.push(`/(app)/box/${box.id}`);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText type="title">Hộp của tôi</ThemedText>
          <Pressable onPress={signOut} hitSlop={8}>
            <ThemedText type="linkPrimary">Đăng xuất</ThemedText>
          </Pressable>
        </View>

        {offline ? (
          <ThemedView type="backgroundElement" style={styles.offlineBanner}>
            <ThemedText type="small">Đang offline - dữ liệu có thể chưa mới nhất</ThemedText>
          </ThemedView>
        ) : null}

        {isEmpty ? (
          <View style={styles.emptyState}>
            <ThemedText type="default" themeColor="textSecondary" style={styles.emptyText}>
              Chưa có hộp nào. Tạo hộp đầu tiên để gửi cho tương lai của bạn!
            </ThemedText>
            <Pressable onPress={() => router.push('/(app)/create-box')} style={styles.emptyCta}>
              <ThemedText type="default" style={styles.emptyCtaLabel}>
                Tạo hộp mới
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          <SectionList
            style={styles.list}
            contentContainerStyle={styles.listContent}
            sections={sections}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
            renderSectionHeader={({ section }) => (
              <ThemedView style={styles.sectionHeader}>
                <ThemedText type="smallBold">
                  {section.title} ({section.data.length})
                </ThemedText>
              </ThemedView>
            )}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleBoxPress(item)}
                style={[styles.card, item.status === 'locked' && styles.cardLocked]}
              >
                <ThemedText type="default">{STATUS_ICON[item.status]} {formatOpenAt(item.open_at)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {STATUS_LABEL[item.status]}
                </ThemedText>
              </Pressable>
            )}
          />
        )}

        <Pressable onPress={() => router.push('/(app)/create-box')} style={styles.fab} hitSlop={8}>
          <ThemedText type="title" style={styles.fabLabel}>
            +
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  offlineBanner: {
    marginHorizontal: Spacing.four,
    marginTop: Spacing.two,
    padding: Spacing.two,
    borderRadius: Spacing.two,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  sectionHeader: {
    paddingVertical: Spacing.two,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: '#F0F0F3',
    marginBottom: Spacing.two,
    gap: Spacing.half,
  },
  cardLocked: {
    opacity: 0.7,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
  },
  emptyText: {
    textAlign: 'center',
  },
  emptyCta: {
    backgroundColor: '#208AEF',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  emptyCtaLabel: {
    color: '#ffffff',
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: Spacing.four,
    bottom: Spacing.five,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabLabel: {
    color: '#ffffff',
    fontSize: 28,
    lineHeight: 32,
  },
});
