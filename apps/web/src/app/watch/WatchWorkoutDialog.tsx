'use client';

import { useEffect, useMemo, useState } from 'react';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import LinearProgress from '@mui/material/LinearProgress';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { calculateStages, parseWatchWorkout, type WatchWorkout } from '@runner/core';
import { useRouter } from 'next/navigation';
import { isBluetoothBlocked } from '../base/BluetoothNotice';
import StageStrip from '../base/StageStrip';
import { useBluetoothAvailability } from '../ble/bluetoothAvailability';
import { useHeartRateConnected } from '../ble/useDeviceConnection';
import { store } from '../store';
import { stageTypeColor, stageTypeName, tokens } from '../theme';
import type { OcrStage } from './ocr';
import { applyTemporaryProgram, autostartRunAtom, saveAsProgram } from './temporaryProgram';

const DEFAULT_NAME = 'Watch workout';

type Reading =
  | { state: 'reading'; stage: OcrStage; progress: number }
  | { state: 'read'; found: boolean }
  | { state: 'failed' };

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
}

/**
 * Reads the workout off a photo of the watch (on the device, see ocr.ts), shows what it read for
 * a check — or for typing it in when it couldn't — and starts it as a one-off program, optionally
 * saving it to the user's programs too.
 */
export default function WatchWorkoutDialog({
  photo,
  onClose,
  onRetake,
}: Readonly<{ photo: File | null; onClose: () => void; onRetake: () => void }>) {
  const router = useRouter();
  const [reading, setReading] = useState<Reading>({
    state: 'reading',
    stage: 'loading',
    progress: 0,
  });
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [save, setSave] = useState(false);
  const [busy, setBusy] = useState(false);

  const bluetooth = useBluetoothAvailability();
  const hrConnected = useHeartRateConnected();

  // The parent remounts this dialog (key) for every photo, so state starts fresh each time.
  const [photoUrl, setPhotoUrl] = useState<string>();
  useEffect(() => {
    if (!photo) return;
    const url = URL.createObjectURL(photo);
    // The URL has to be created and revoked by the same effect (StrictMode runs it twice).
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  useEffect(() => {
    if (!photo) return;
    let cancelled = false;
    (async () => {
      try {
        const { recognizeWatchPhoto } = await import('./ocr');
        const { workout } = await recognizeWatchPhoto(photo, (stage, progress) => {
          if (!cancelled) setReading({ state: 'reading', stage, progress });
        });
        if (cancelled) return;
        setName(workout?.name ?? '');
        setText(workout?.text ?? '');
        setReading({ state: 'read', found: !!workout });
      } catch (error) {
        console.warn('Reading the watch photo failed', error);
        if (!cancelled) setReading({ state: 'failed' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [photo]);

  const parsed = useMemo((): { workout?: WatchWorkout; error?: string } => {
    if (!text.trim()) return {};
    try {
      return { workout: parseWatchWorkout(text) };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Invalid workout' };
    }
  }, [text]);
  const stages = useMemo(
    () => (parsed.workout ? calculateStages(parsed.workout.stages) : []),
    [parsed.workout]
  );

  const workoutName = name.trim() || parsed.workout?.name || DEFAULT_NAME;
  // Same rule as the home screen's Start running: HR-guided stages need the monitor connected.
  const canStart =
    !isBluetoothBlocked(bluetooth) &&
    (hrConnected || (stages.length > 0 && stages.every((s) => s.speedType !== 'bmp')));
  const reviewing = reading.state !== 'reading';

  async function handleUse() {
    if (!parsed.workout) return;
    setBusy(true);
    try {
      if (save) {
        await saveAsProgram(workoutName, { stages: parsed.workout.stages, cooldown: false });
      } else {
        applyTemporaryProgram(workoutName, parsed.workout.stages);
      }
      onClose();
      if (canStart) {
        store.set(autostartRunAtom, true);
        router.push('/running');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!photo} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Workout from your watch</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', minWidth: 0 }}>
          {photoUrl && (
            <Box
              component="img"
              src={photoUrl}
              alt="Photo of the watch"
              sx={{
                width: 72,
                height: 72,
                objectFit: 'cover',
                borderRadius: '14px',
                flexShrink: 0,
                border: `1px solid ${tokens.border}`,
              }}
            />
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {reading.state === 'reading' ? (
              <>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  {reading.stage === 'loading'
                    ? 'Loading text recognition…'
                    : 'Reading the screen…'}
                </Typography>
                <LinearProgress
                  variant={reading.progress > 0 ? 'determinate' : 'indeterminate'}
                  value={reading.progress * 100}
                />
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {reading.state === 'read' && reading.found
                  ? 'Check it reads like your watch, then start.'
                  : 'Type the workout as your watch shows it.'}
              </Typography>
            )}
            {reviewing && (
              <Button
                size="small"
                variant="glass"
                startIcon={<PhotoCameraRoundedIcon />}
                onClick={onRetake}
                sx={{ mt: 1 }}
              >
                Retake
              </Button>
            )}
          </Box>
        </Box>

        {reading.state === 'read' && !reading.found && (
          <Alert severity="info">Couldn&apos;t read the workout from this photo.</Alert>
        )}
        {reading.state === 'failed' && (
          <Alert severity="warning">Text recognition didn&apos;t load — are you offline?</Alert>
        )}

        {reviewing && (
          <>
            <TextField
              label="Workout"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="21:00@169bpm 41:00"
              error={!!parsed.error}
              helperText={parsed.error ?? 'e.g. 21:00@169bpm 41:00 · 143bpm 31:00 · 4x4:00@184'}
              autoFocus={!text}
              fullWidth
              slotProps={{
                htmlInput: { autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false },
              }}
            />
            <TextField
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={parsed.workout?.name ?? DEFAULT_NAME}
              fullWidth
            />
          </>
        )}

        {stages.length > 0 && (
          <Box>
            <StageStrip stages={stages} height={48} />
            <Box component="ol" sx={{ listStyle: 'none', p: 0, m: 0, mt: 1.5 }}>
              {stages.map((stage, i) => (
                <Box
                  component="li"
                  key={i}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    py: 0.25,
                    fontSize: '0.9rem',
                  }}
                >
                  <Box
                    aria-hidden
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      flexShrink: 0,
                      bgcolor: stageTypeColor[stage.type],
                    }}
                  />
                  <Box component="span" sx={{ color: 'text.secondary', minWidth: 72 }}>
                    {stageTypeName[stage.type]}
                  </Box>
                  <span className="tabular">
                    {formatDuration(stage.to.totalMilliseconds - stage.from.totalMilliseconds)}
                  </span>
                  {stage.speedType === 'bmp' && (
                    <Box component="span" className="tabular" sx={{ ml: 'auto' }}>
                      {stage.bmp} bpm
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
            <Typography variant="body2" sx={{ mt: 1, fontWeight: 600 }} className="tabular">
              Total {formatDuration(stages[stages.length - 1].to.totalMilliseconds)}
            </Typography>
          </Box>
        )}

        {reviewing && parsed.workout && (
          <>
            <FormControlLabel
              control={<Checkbox checked={save} onChange={(e) => setSave(e.target.checked)} />}
              label="Also save to my programs"
            />
            {!canStart && (
              <Typography variant="caption" color="text.secondary">
                {isBluetoothBlocked(bluetooth)
                  ? "This browser can't reach the treadmill — it'll be ready on the home screen."
                  : 'Connect your heart-rate monitor on the home screen to start.'}
              </Typography>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions
        sx={{
          px: 3,
          pb: 2.5,
          flexWrap: 'wrap',
          gap: 1,
          '& > :not(style) ~ :not(style)': { ml: 0 },
        }}
      >
        <Button color="secondary" onClick={onClose} sx={{ mr: 'auto' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleUse}
          disabled={!parsed.workout || busy}
          startIcon={canStart ? <PlayArrowRoundedIcon /> : undefined}
        >
          {canStart ? 'Start' : 'Use workout'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
