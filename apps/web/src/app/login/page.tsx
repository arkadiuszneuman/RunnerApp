'use client';

import { useState } from 'react';
import GoogleIcon from '@mui/icons-material/Google';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthCard from '../base/AuthCard';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await signIn('credentials', { email, password, redirect: false });

    setLoading(false);

    if (result?.error) {
      setError('Invalid email or password');
    } else {
      router.push('/');
    }
  }

  return (
    <AuthCard
      title="Sign in"
      footer={
        <>
          No account? <Link href="/register">Create one</Link>
        </>
      }
    >
      <Button
        fullWidth
        size="large"
        variant="contained"
        startIcon={<GoogleIcon />}
        onClick={() => signIn('google', { callbackUrl: '/' })}
        sx={{
          bgcolor: '#ffffff',
          color: '#10131a',
          boxShadow: 'none',
          '&:hover': { bgcolor: '#e8ecf4', boxShadow: 'none' },
        }}
      >
        Continue with Google
      </Button>

      <Divider sx={{ my: 2.5, color: 'text.secondary', fontSize: '0.8rem' }}>or</Divider>

      {error && (
        <Alert severity="error" sx={{ mb: 2, animation: 'fade-up 300ms var(--ease-out)' }}>
          {error}
        </Alert>
      )}

      <Box
        component="form"
        onSubmit={handleCredentials}
        sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          fullWidth
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          fullWidth
        />
        <Button type="submit" size="large" variant="contained" disabled={loading} fullWidth>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </Box>
    </AuthCard>
  );
}
