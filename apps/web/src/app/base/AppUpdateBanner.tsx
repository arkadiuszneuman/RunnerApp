'use client';

import { useState } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SystemUpdateRoundedIcon from '@mui/icons-material/SystemUpdateRounded';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import type { SxProps, Theme } from '@mui/material/styles';
import { downloadAndroidUpdate, useAndroidAppVersion } from '../androidApp';

const DISMISSED_KEY = 'runner.appUpdateDismissed';

function readDismissed(): number | undefined {
  try {
    return Number(localStorage.getItem(DISMISSED_KEY)) || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Inside the Android app, when a newer APK has been published: offers it on the home screen.
 * Closing it hides it until the next build comes out; Settings keeps the update button
 * (settings/InstallAppCard.tsx).
 */
export default function AppUpdateBanner({ sx }: Readonly<{ sx?: SxProps<Theme> }>) {
  const update = useAndroidAppVersion()?.update;
  // Only read once an update is known (client-side), so SSR never touches localStorage.
  const [dismissed, setDismissed] = useState<number>();
  if (!update) return null;
  if ((dismissed ?? readDismissed()) === update.versionCode) return null;

  const dismiss = () => {
    setDismissed(update.versionCode);
    try {
      localStorage.setItem(DISMISSED_KEY, String(update.versionCode));
    } catch {}
  };

  return (
    <Alert
      severity="info"
      variant="outlined"
      icon={<SystemUpdateRoundedIcon />}
      action={
        <IconButton aria-label="Dismiss" color="inherit" size="small" onClick={dismiss}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      }
      sx={{ borderRadius: '16px', ...sx }}
    >
      A new version of the app is out ({update.versionName}). Download it, then open the file to
      install it over this one.
      <Button
        variant="contained"
        size="small"
        onClick={() => void downloadAndroidUpdate()}
        sx={{ display: 'flex', width: 'fit-content', mt: 1 }}
      >
        Update
      </Button>
    </Alert>
  );
}
