import {
  Alert,
  AlertText,
  Box,
  Button,
  ButtonSpinner,
  ButtonText,
  FormControl,
  FormControlHelper,
  FormControlHelperText,
  Heading,
  Input,
  InputField,
  Text,
  VStack,
} from '@gluestack-ui/themed';
import axios from 'axios';
import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    setError('');
    try {
      await register(name, email, password);
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? ((err.response?.data as { error?: string } | undefined)?.error ?? 'Registration failed')
        : 'Registration failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <Box flex={1} justifyContent="center" px={24}>
        <Heading size="2xl" color="$white" mb={24}>
          Create account
        </Heading>

        {error ? (
          <Alert testID="register-error-alert" action="error" mb={16}>
            <AlertText>{error}</AlertText>
          </Alert>
        ) : null}

        <VStack space="md">
          <FormControl>
            <Input>
              <InputField testID="register-name-input" placeholder="Name" value={name} onChangeText={setName} />
            </Input>
          </FormControl>
          <FormControl>
            <Input>
              <InputField
                testID="register-email-input"
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
                testID="register-password-input"
                placeholder="Password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </Input>
            <FormControlHelper>
              <FormControlHelperText>At least 8 characters</FormControlHelperText>
            </FormControlHelper>
          </FormControl>
          <Button testID="register-submit-button" onPress={handleSubmit} isDisabled={loading}>
            {loading ? <ButtonSpinner /> : <ButtonText>Create account</ButtonText>}
          </Button>
        </VStack>

        <Text color="$white" mt={16} textAlign="center">
          Already have an account?{' '}
          <Link href="/(auth)/login">
            <Text testID="register-login-link" color="$white" textDecorationLine="underline">
              Sign in
            </Text>
          </Link>
        </Text>
      </Box>
    </KeyboardAvoidingView>
  );
}
