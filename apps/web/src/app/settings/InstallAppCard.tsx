'use client';

import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import {
  ANDROID_APK_URL,
  downloadAndroidUpdate,
  useAndroidAppVersion,
  useInstallPlatform,
} from '../androidApp';
import { displayFont, enter } from '../theme';

const titleSx = { fontFamily: displayFont, fontWeight: 600, fontSize: '1.2rem', mb: 0.5 };

/**
 * The Android app (apps/android): in a browser, its download link; inside the app, the installed
 * version and an update button once a newer build is published.
 */
export default function InstallAppCard({ index }: Readonly<{ index: number }>) {
  const platform = useInstallPlatform();
  const version = useAndroidAppVersion();

  if (!platform) return null;
  if (platform === 'native') {
    if (!version) return null;
    const { installed, update } = version;
    return (
      <Paper variant="outlined" sx={{ p: 2.5, mb: 1.5, ...enter(index) }}>
        <Typography sx={titleSx}>Android app</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: update ? 1.5 : 0 }}>
          Version {installed.versionName}.{' '}
          {update
            ? `${update.versionName} is out: download it, then open the file to install it over this one.`
            : 'Up to date.'}
        </Typography>
        {update && (
          <Button variant="contained" onClick={() => void downloadAndroidUpdate()}>
            Update to {update.versionName}
          </Button>
        )}
      </Paper>
    );
  }
  return (
    <Paper variant="outlined" sx={{ p: 2.5, mb: 1.5, ...enter(index) }}>
      <Typography sx={titleSx}>Android app</Typography>
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
