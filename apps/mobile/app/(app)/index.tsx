import { Box, Button, ButtonText, Heading, Text, VStack } from '@gluestack-ui/themed';
import { useAuth } from '@/auth/AuthProvider';

/**
 * Placeholder home screen — the real BleConnector-equivalent (connect HR,
 * connect treadmill, start run) lands in Phase 6, built against FakeTreadmill.
 * This exists now to prove the auth/navigation loop closes end to end.
 */
export default function HomeScreen() {
  const { user, logout } = useAuth();

  return (
    <Box flex={1} alignItems="center" justifyContent="center" px={24}>
      <VStack space="md" alignItems="center">
        <Heading size="2xl" color="$white">
          RunnerApp
        </Heading>
        <Text color="$white">{user?.name ?? user?.email}</Text>
        <Button onPress={logout} action="secondary">
          <ButtonText>Sign out</ButtonText>
        </Button>
      </VStack>
    </Box>
  );
}
