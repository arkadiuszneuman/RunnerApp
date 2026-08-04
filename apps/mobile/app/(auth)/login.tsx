import {
  Alert,
  AlertText,
  Box,
  Button,
  ButtonSpinner,
  ButtonText,
  Divider,
  FormControl,
  Heading,
  Input,
  InputField,
  Text,
  VStack,
} from '@gluestack-ui/themed';
import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';

export default function LoginScreen() {
  const { loginWithCredentials, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleCredentials() {
    setLoading(true);
    setError('');
    try {
      await loginWithCredentials(email, password);
    } catch {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    setError('');
    try {
      await loginWithGoogle();
    } catch {
      setError('Google sign-in failed');
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <Box flex={1} justifyContent="center" px={24}>
        <Heading size="2xl" color="$white" mb={24}>
          Sign in
        </Heading>

        <Button onPress={handleGoogle} isDisabled={googleLoading} mb={16}>
          {googleLoading ? <ButtonSpinner /> : <ButtonText>Sign in with Google</ButtonText>}
        </Button>

        <Divider my={16} />

        {error ? (
          <Alert action="error" mb={16}>
            <AlertText>{error}</AlertText>
          </Alert>
        ) : null}

        <VStack space="md">
          <FormControl>
            <Input>
              <InputField
                placeholder="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </Input>
          </FormControl>
          <FormControl>
            <Input>
              <InputField
                placeholder="Password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </Input>
          </FormControl>
          <Button onPress={handleCredentials} isDisabled={loading}>
            {loading ? <ButtonSpinner /> : <ButtonText>Sign in</ButtonText>}
          </Button>
        </VStack>

        <Text color="$white" mt={16} textAlign="center">
          No account?{' '}
          <Link href="/(auth)/register">
            <Text color="$white" textDecorationLine="underline">
              Register
            </Text>
          </Link>
        </Text>
      </Box>
    </KeyboardAvoidingView>
  );
}
