'use client';

import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { ANDROID_APK_URL, useInstallPlatform } from '../androidApp';
import { displayFont, enter } from '../theme';

/**
 * Download link for the Android app (apps/android), shown only in a browser — inside the app
 * itself there's nothing to install.
 */
export default function InstallAppCard({ index }: Readonly<{ index: number }>) {
  const platform = useInstallPlatform();

  if (!platform || platform === 'native') return null;
  return (
    <Paper variant="outlined" sx={{ p: 2.5, mb: 1.5, ...enter(index) }}>
      <Typography sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: '1.2rem', mb: 0.5 }}>
        Android app
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Same app, but it connects to the treadmill and heart-rate strap on its own and keeps the run
        going with the screen off.{' '}
        {platform === 'android'
          ? 'Open the downloaded file and allow installing apps from this browser if asked.'
          : 'Open this page on your Android phone to install it.'}
      </Typography>
      <Button variant="contained" href={ANDROID_APK_URL} download>
        Download for Android
      </Button>
    </Paper>
  );
}
