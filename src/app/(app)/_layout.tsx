import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="create-box" options={{ headerShown: true, title: 'Tạo hộp mới' }} />
    </Stack>
  );
}
