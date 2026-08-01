import { useEffect } from 'react';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Lora_400Regular, Lora_600SemiBold, useFonts } from '@expo-google-fonts/lora';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';

SplashScreen.preventAutoHideAsync();

const AirmailNavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Colors.ground,
    card: Colors.ground,
    text: Colors.ink,
    primary: Colors.blue,
    border: Colors.rule,
  },
};

export default function RootLayout() {
  const { session, initializing } = useAuth();
  const [fontsLoaded] = useFonts({ Lora_400Regular, Lora_600SemiBold });
  const ready = !initializing && fontsLoaded;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <ThemeProvider value={AirmailNavigationTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>

        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
