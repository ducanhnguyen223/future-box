import { Stack } from 'expo-router';

import { useAuth } from '@/hooks/use-auth';
import { usePushRegistration } from '@/hooks/use-push-registration';

export default function AppLayout() {
  const { session } = useAuth();
  usePushRegistration(session?.user.id);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="create-box" options={{ headerShown: true, title: 'Tạo hộp mới' }} />
      <Stack.Screen name="box/[id]" options={{ headerShown: true, title: 'Chi tiết hộp' }} />
      <Stack.Screen name="box/[id]/edit" options={{ headerShown: true, title: 'Sửa hộp' }} />
    </Stack>
  );
}
