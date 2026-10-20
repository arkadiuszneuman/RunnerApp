'use client';

import { useState } from 'react';
import AndroidRoundedIcon from '@mui/icons-material/AndroidRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import type { SxProps, Theme } from '@mui/material/styles';
import { ANDROID_APK_URL, useInstallPlatform } from '../androidApp';

const DISMISSED_KEY = 'runner.installAppBannerDismissed';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Home-screen nudge to install the Android app, only in an Android browser. Closing it hides it
 * for good on this device; Settings keeps the download card (settings/InstallAppCard.tsx).
 */
export default function InstallAppBanner({ sx }: Readonly<{ sx?: SxProps<Theme> }>) {
  const platform = useInstallPlatform();
  // Only read once the platform is known (client-side), so SSR never touches localStorage.
  const [dismissed, setDismissed] = useState<boolean>();
  if (platform !== 'android') return null;
  if (dismissed ?? readDismissed()) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {}
  };

  return (
    <Alert
      severity="info"
      variant="outlined"
      icon={<AndroidRoundedIcon />}
      action={
        <IconButton aria-label="Dismiss" color="inherit" size="small" onClick={dismiss}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      }
      sx={{ borderRadius: '16px', ...sx }}
    >
      Get the Android app: it connects to the treadmill and heart-rate strap on its own and keeps
      the run going with the screen off.
      <Button
        variant="contained"
        size="small"
        href={ANDROID_APK_URL}
        download
        sx={{ display: 'flex', width: 'fit-content', mt: 1 }}
      >
        Download
      </Button>
    </Alert>
  );
}
