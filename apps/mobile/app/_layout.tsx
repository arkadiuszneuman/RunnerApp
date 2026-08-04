import {
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_700Bold,
  useFonts,
} from '@expo-google-fonts/barlow';
import { config } from '@gluestack-ui/config';
import { GluestackUIProvider } from '@gluestack-ui/themed';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useSegments, Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Provider as JotaiProvider } from 'jotai';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { store } from '@/store';

SplashScreen.preventAutoHideAsync();

// Mirrors the web app's page-level gradient background (src/app/layout.tsx).
const GRADIENT_COLORS = [
  'rgb(50,206,217)',
  'rgb(40,148,173)',
  'rgb(35,117,149)',
  'rgb(28,75,117)',
  'rgb(26,27,77)',
] as const;
const GRADIENT_LOCATIONS = [0, 0.13, 0.21, 0.37, 1] as const;

function RouteGuard() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(app)');
    }
  }, [isAuthenticated, isLoading, segments, router]);

  return <Slot />;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Barlow_400Regular, Barlow_500Medium, Barlow_700Bold });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GluestackUIProvider config={config} colorMode="dark">
      <LinearGradient
        colors={GRADIENT_COLORS}
        locations={GRADIENT_LOCATIONS}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.81 }}
        style={{ flex: 1 }}
      >
        <JotaiProvider store={store}>
          <AuthProvider>
            <RouteGuard />
          </AuthProvider>
        </JotaiProvider>
      </LinearGradient>
    </GluestackUIProvider>
  );
}
