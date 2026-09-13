import { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { BrandMark } from './AppShell';

export default function AuthCard({
  title,
  footer,
  children,
}: Readonly<{ title: string; footer: ReactNode; children: ReactNode }>) {
  return (
    <Box
      sx={{
        minHeight: 'calc(100dvh - 48px)',
        maxWidth: 420,
        mx: 'auto',
        py: 4,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <Box sx={{ textAlign: 'center', mb: 3, animation: 'fade-up 700ms var(--ease-out) backwards' }}>
        <Box sx={{ display: 'inline-block', animation: 'float 5s ease-in-out infinite' }}>
          <BrandMark size={64} />
        </Box>
        <Typography
          variant="h3"
          component="p"
          sx={{ mt: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}
        >
          Runner
        </Typography>
        <Typography color="text.secondary">Heart-rate guided treadmill training</Typography>
      </Box>
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2.5, sm: 3.5 },
          borderRadius: '28px',
          animation: 'scale-in 600ms var(--ease-out) 120ms backwards',
        }}
      >
        <Typography variant="h5" component="h1" sx={{ mb: 2.5 }}>
          {title}
        </Typography>
        {children}
      </Paper>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          mt: 3,
          textAlign: 'center',
          animation: 'fade-in 600ms ease 400ms backwards',
          '& a': { color: 'primary.main', fontWeight: 600 },
        }}
      >
        {footer}
      </Typography>
    </Box>
  );
}
