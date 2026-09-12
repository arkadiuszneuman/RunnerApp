import { Box, Button, ButtonText, HStack } from '@gluestack-ui/themed';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RunnerText } from '@/components/RunnerText';
import { useAuth } from '@/auth/AuthProvider';

function Header() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <HStack
      justifyContent="space-between"
      alignItems="center"
      px={16}
      py={8}
      borderBottomWidth={1}
      borderBottomColor="rgba(255,255,255,0.1)"
    >
      <RunnerText textTransform="none" remSize={0.85} style={{ opacity: 0.7 }}>
        {user.name ?? user.email}
      </RunnerText>
      <Button testID="header-sign-out-button" size="xs" variant="link" onPress={logout}>
        <ButtonText style={{ opacity: 0.7 }}>Sign out</ButtonText>
      </Button>
    </HStack>
  );
}

export default function AppLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Box flex={1} style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <Header />
      <Stack screenOptions={{ headerShown: false }} />
    </Box>
  );
}
