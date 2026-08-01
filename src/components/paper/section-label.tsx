import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

type SectionLabelProps = {
  label: string;
  count?: number;
};

export function SectionLabel({ label, count }: SectionLabelProps) {
  return (
    <View style={styles.row}>
      <ThemedText type="monoLabel" themeColor="ink3">
        {label}
      </ThemedText>
      {count !== undefined ? (
        <ThemedText type="monoLabel" themeColor="ink3">
          {count}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.four,
    marginBottom: Spacing.two,
  },
});
