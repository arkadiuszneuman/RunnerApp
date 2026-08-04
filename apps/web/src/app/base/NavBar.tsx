'use client';

import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { useSession, signOut } from 'next-auth/react';

export default function NavBar() {
  const { data: session } = useSession();

  if (!session) return null;

  return (
    <AppBar
      position="static"
      color="transparent"
      elevation={0}
      sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
    >
      <Toolbar variant="dense">
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            {session.user?.name ?? session.user?.email}
          </Typography>
        </Box>
        <Button
          size="small"
          color="inherit"
          onClick={() => signOut({ callbackUrl: '/login' })}
          sx={{ opacity: 0.7 }}
        >
          Sign out
        </Button>
      </Toolbar>
    </AppBar>
  );
}
