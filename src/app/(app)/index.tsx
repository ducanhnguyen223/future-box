import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';

// ponytail: placeholder cho Feature #3 (Danh sách hộp), chỉ đủ để test luồng auth end-to-end.
export default function BoxListScreen() {
  const { signOut } = useAuth();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">Hộp của tôi</ThemedText>
        <Pressable onPress={signOut} style={styles.logoutButton}>
          <ThemedText type="linkPrimary">Đăng xuất</ThemedText>
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
  },
  logoutButton: {
    padding: Spacing.two,
  },
});
