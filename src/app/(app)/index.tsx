import { router } from 'expo-router';
import { Pressable, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AirmailStripe } from '@/components/paper/airmail-stripe';
import { PaperCard } from '@/components/paper/paper-card';
import { SectionLabel } from '@/components/paper/section-label';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useBoxList } from '@/hooks/use-box-list';
import type { BoxWithStatus } from '@/types/database';

const STATUS_LABEL: Record<BoxWithStatus['status'], string> = {
  locked: 'Đang niêm phong',
  ready: 'Sẵn sàng mở',
  opened: 'Đã bóc',
};

function firstLine(text: string): string {
  return text.split('\n')[0];
}

function openedMeta(box: BoxWithStatus): string | undefined {
  if (!box.follow_up_question || box.follow_up_answer === null) return undefined;
  return box.follow_up_answer ? 'ĐÃ TRẢ LỜI: CÓ' : 'ĐÃ TRẢ LỜI: CHƯA';
}

export default function BoxListScreen() {
  const { session } = useAuth();
  const { loading, refreshing, offline, locked, ready, opened, refresh } = useBoxList(session?.user.id);

  const sections = [
    { key: 'ready' as const, title: STATUS_LABEL.ready, data: ready },
    { key: 'locked' as const, title: STATUS_LABEL.locked, data: locked },
    { key: 'opened' as const, title: STATUS_LABEL.opened, data: opened },
  ].filter((section) => section.data.length > 0);

  const isEmpty = !loading && sections.length === 0;

  const handleBoxPress = (box: BoxWithStatus) => {
    router.push(`/(app)/box/${box.id}`);
  };

  return (
    <ThemedView style={styles.container}>
      <AirmailStripe />
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <View style={styles.header}>
          <ThemedText type="title">Hộp của tôi</ThemedText>
          <Pressable onPress={() => router.push('/(app)/settings')} hitSlop={8}>
            <ThemedText type="linkPrimary">Cài đặt</ThemedText>
          </Pressable>
        </View>

        {offline ? (
          <ThemedView type="paperDim" style={styles.offlineBanner}>
            <ThemedText type="small">Đang offline — dữ liệu có thể chưa mới nhất</ThemedText>
          </ThemedView>
        ) : null}

        {isEmpty ? (
          <View style={styles.emptyState}>
            <ThemedText type="default" themeColor="ink2" style={styles.emptyText}>
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
              <SectionLabel label={section.title} count={section.data.length} />
            )}
            renderItem={({ item }) => (
              <PaperCard
                status={item.status}
                title={firstLine(item.content_text)}
                openAt={item.open_at}
                meta={item.status === 'opened' ? openedMeta(item) : undefined}
                onPress={() => handleBoxPress(item)}
              />
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
    paddingTop: Spacing.three,
  },
  offlineBanner: {
    marginHorizontal: Spacing.four,
    marginTop: Spacing.two,
    padding: Spacing.two,
    borderRadius: Radius,
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
    backgroundColor: Colors.blue,
    borderRadius: Radius,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  emptyCtaLabel: {
    color: Colors.paper,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: Spacing.four,
    bottom: Spacing.five,
    width: 56,
    height: 56,
    borderRadius: Radius,
    backgroundColor: Colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabLabel: {
    color: Colors.paper,
    fontSize: 28,
    lineHeight: 32,
  },
});
