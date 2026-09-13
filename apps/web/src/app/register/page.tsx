'use client';

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import axios from 'axios';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthCard from '../base/AuthCard';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await axios.post('/api/register', { name, email, password });
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data?.error ?? 'Registration failed')
        : 'Registration failed';
      setError(message);
      setLoading(false);
      return;
    }

    const result = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);

    if (result?.error) {
      router.push('/login');
    } else {
      router.push('/');
    }
  }

  return (
    <AuthCard
      title="Create account"
      footer={
        <>
          Already have an account? <Link href="/login">Sign in</Link>
        </>
      }
    >
      {error && (
        <Alert severity="error" sx={{ mb: 2, animation: 'fade-up 300ms var(--ease-out)' }}>
          {error}
        </Alert>
      )}

      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <TextField
          label="Name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          fullWidth
        />
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
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          fullWidth
          slotProps={{ htmlInput: { minLength: 8 } }}
          helperText="At least 8 characters"
        />
        <Button type="submit" size="large" variant="contained" disabled={loading} fullWidth>
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </Box>
    </AuthCard>
  );
}
