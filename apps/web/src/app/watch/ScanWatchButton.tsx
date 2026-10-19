'use client';

import { useRef, useState } from 'react';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import Button, { type ButtonProps } from '@mui/material/Button';
import { useAtomValue } from 'jotai';
import { isRunningAtom } from '../atoms';
import { userSettingsLoadedAtom } from '../userData';
import WatchWorkoutDialog from './WatchWorkoutDialog';

/**
 * Opens the camera (Android's camera app via Capacitor's file chooser, or the phone browser's;
 * a plain file picker on desktop) for a photo of the watch's workout screen, then the dialog
 * that reads it.
 */
export default function ScanWatchButton({
  label = 'Scan watch',
  ...props
}: Readonly<{ label?: string } & Pick<ButtonProps, 'variant' | 'size' | 'sx'>>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [scan, setScan] = useState(0);
  const running = useAtomValue(isRunningAtom);
  // Until the saved active program has loaded, its load could still replace the workout.
  const settingsLoaded = useAtomValue(userSettingsLoadedAtom);

  return (
    <>
      <Button
        {...props}
        startIcon={<PhotoCameraRoundedIcon />}
        disabled={running || !settingsLoaded}
        onClick={() => inputRef.current?.click()}
      >
        {label}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setScan((n) => n + 1);
          setPhoto(file);
        }}
      />
      {photo && (
        <WatchWorkoutDialog
          key={scan}
          photo={photo}
          onClose={() => setPhoto(null)}
          onRetake={() => inputRef.current?.click()}
        />
      )}
    </>
  );
}
