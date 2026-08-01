import { router } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useNotificationPermission } from '@/hooks/use-push-registration';

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const { enabled, loading, enable, openSystemSettings } = useNotificationPermission(session?.user.id);

  const handleToggle = (next: boolean) => {
    if (next) {
      enable();
    } else {
      // Hệ điều hành không cho app tự thu hồi quyền — dẫn user ra Cài đặt hệ thống nếu muốn tắt.
      openSystemSettings();
    }
  };

  const handleSignOut = () => {
    Alert.alert('Đăng xuất?', 'Bạn sẽ cần đăng nhập lại để tiếp tục dùng FutureBoxes.', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.content}>
          <View style={styles.field}>
            <ThemedText type="monoLabel" themeColor="ink3">
              Tài khoản
            </ThemedText>
            <ThemedView type="paperDim" style={styles.accountRow}>
              <ThemedText type="default">{session?.user.email ?? '—'}</ThemedText>
            </ThemedView>
          </View>

          <View style={[styles.field, styles.notificationRow]}>
            <View style={styles.notificationText}>
              <ThemedText type="smallBold">Thông báo đẩy</ThemedText>
              <ThemedText type="small" themeColor="ink2">
                Nhắc khi có hộp đến ngày mở
              </ThemedText>
            </View>
            {loading ? (
              <ActivityIndicator color={Colors.blue} />
            ) : (
              <Switch
                value={enabled}
                onValueChange={handleToggle}
                trackColor={{ false: Colors.rule, true: Colors.blue }}
              />
            )}
          </View>

          <Pressable onPress={handleSignOut} style={styles.signOutButton}>
            <ThemedText type="default" style={styles.signOutLabel}>
              Đăng xuất
            </ThemedText>
          </Pressable>

          <Pressable onPress={() => router.back()} style={styles.secondaryButton}>
            <ThemedText type="default" themeColor="ink3">
              Quay lại
            </ThemedText>
          </Pressable>
        </View>
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
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.four,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  field: {
    gap: Spacing.two,
  },
  accountRow: {
    padding: Spacing.three,
    borderRadius: Radius,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notificationText: {
    flex: 1,
    gap: Spacing.half,
  },
  signOutButton: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.red,
    borderRadius: Radius,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  signOutLabel: {
    color: Colors.red,
    fontWeight: '600',
  },
  secondaryButton: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
});
