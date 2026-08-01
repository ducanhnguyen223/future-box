import { useEffect, useState } from 'react';
import type { StyleProp, TextStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';

function formatCountdown(openAt: string): string {
  const diffMs = new Date(openAt).getTime() - Date.now();
  if (diffMs <= 0) return 'ĐÃ TỚI NGÀY';

  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days >= 1) return `CÒN ${days} NGÀY`;

  const hours = Math.max(1, Math.floor(diffMs / (60 * 60 * 1000)));
  return `CÒN ${hours} GIỜ`;
}

type CountdownLabelProps = {
  openAt: string;
  style?: StyleProp<TextStyle>;
};

/** Chỉ để hiển thị — điều kiện mở hộp thật sự luôn do server (RPC open_box) quyết định. */
export function CountdownLabel({ openAt, style }: CountdownLabelProps) {
  const [label, setLabel] = useState(() => formatCountdown(openAt));

  useEffect(() => {
    setLabel(formatCountdown(openAt));
    const id = setInterval(() => setLabel(formatCountdown(openAt)), 60_000);
    return () => clearInterval(id);
  }, [openAt]);

  return (
    <ThemedText type="monoLabel" themeColor="ink3" style={style}>
      {label}
    </ThemedText>
  );
}
