import { useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

// ponytail: placeholder — Feature #4 (Mở hộp thời gian) sẽ implement đầy đủ luồng mở hộp,
// countdown blocked state, follow-up Yes/No, hiệu ứng confetti ở màn này.
export default function BoxDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Hộp #{id}</ThemedText>
      <ThemedText type="default" themeColor="textSecondary">
        Màn chi tiết hộp sẽ được hoàn thiện ở Feature #4.
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
});
