import { Box, Button, ButtonText, HStack } from '@gluestack-ui/themed';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native';
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
      <Button size="xs" variant="link" onPress={logout}>
        <ButtonText style={{ opacity: 0.7 }}>Sign out</ButtonText>
      </Button>
    </HStack>
  );
}

export default function AppLayout() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Box flex={1}>
        <Header />
        <Stack screenOptions={{ headerShown: false }} />
      </Box>
    </SafeAreaView>
  );
}
