'use client';

import { ReactElement, useEffect, useState } from 'react';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useAtomValue } from 'jotai';
import Link from 'next/link';
import { isPausedAtom, runningStateAtom, stagesAtom } from '../atoms';
import ActionBar from '../base/ActionBar';
import BluetoothNotice, { isBluetoothBlocked } from '../base/BluetoothNotice';
import { useBluetoothAvailability } from '../ble/bluetoothAvailability';
import { syncToneIcon, useSyncSummary } from '../offline/SyncIndicator';
import { glass, tokens } from '../theme';
import useRunningLoop from '../useRunningLoop';
import RunInfo from './RunInfo/RunInfo';

function StatusIcon({
  active,
  title,
  icon,
}: Readonly<{ active: boolean; title: string; icon: ReactElement }>) {
  return (
    <Tooltip title={title}>
      <Box
        sx={{
          position: 'relative',
          width: 38,
          height: 38,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          ...glass,
          color: active ? tokens.volt : tokens.textFaint,
          transition: 'color 400ms ease',
          '& svg': { fontSize: 18 },
        }}
      >
        {icon}
        {active && (
          <Box
            sx={{
              position: 'absolute',
              top: 7,
              right: 7,
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: tokens.volt,
              boxShadow: `0 0 8px ${tokens.volt}`,
            }}
          />
        )}
      </Box>
    </Tooltip>
  );
}

export default function Run() {
  const runningLoop = useRunningLoop();
  const runningState = useAtomValue(runningStateAtom);
  const isPaused = useAtomValue(isPausedAtom);
  const stages = useAtomValue(stagesAtom);
  const [mounted, setMounted] = useState(false);
  // Standard hydration-mismatch guard: wakeLock support/status can only be
  // read client-side, so this flips true one render after mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const wakeLockSupported = mounted && runningLoop.wakeLock.isWakeLockSupported;
  const wakeLockActive = mounted && runningLoop.wakeLock.wakeLockStatus === 'requested';
  const heartConnected = mounted && runningLoop.heartRateConnected();
  const bluetooth = useBluetoothAvailability();
  const bluetoothBlocked = isBluetoothBlocked(bluetooth);
  // A run never needs the network: this only tells the runner whether it's uploading live yet.
  const sync = useSyncSummary();
  const SyncIcon = syncToneIcon[sync.tone];

  return (
    // Fixed to the viewport (rather than a normal in-flow page) so the run dashboard is exactly
    // one screen: no vertical scroll, ever. AppShell's <main> padding doesn't apply to a fixed
    // child, so the safe-area padding below re-states it. See useFitPriority.ts for how the
    // content between the header and ActionBar decides what fits.
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 520,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          px: 2,
          pt: 'calc(12px + env(safe-area-inset-top))',
          pb: 'calc(12px + env(safe-area-inset-bottom))',
          animation: 'fade-in 400ms ease backwards',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexShrink: 0 }}>
          <IconButton
            component={Link}
            href="/"
            aria-label="Back"
            disabled={runningState.running}
            sx={{ ...glass, width: 40, height: 40, '&.Mui-disabled': { opacity: 0.35 } }}
          >
            <ArrowBackRoundedIcon fontSize="small" />
          </IconButton>
          <Typography
            variant="overline"
            sx={{ flex: 1, textAlign: 'center', color: 'text.secondary' }}
          >
            {runningState.running ? (isPaused ? 'Paused' : 'Workout') : 'Ready'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            <StatusIcon
              active={heartConnected}
              title={`Heart rate monitor: ${heartConnected ? 'connected' : 'disconnected'}`}
              icon={<FavoriteRoundedIcon />}
            />
            <StatusIcon
              active={wakeLockActive}
              title={`Screen keep-awake: ${wakeLockSupported ? runningLoop.wakeLock.wakeLockStatus : 'not supported'}`}
              icon={<LightModeRoundedIcon />}
            />
            <StatusIcon
              active={mounted && (sync.tone === 'ok' || sync.tone === 'syncing')}
              title={`${sync.label}: ${sync.detail}`}
              icon={<SyncIcon />}
            />
          </Box>
        </Box>

        {mounted && <BluetoothNotice availability={bluetooth} sx={{ mb: 1.5, flexShrink: 0 }} />}

        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <RunInfo onResetManualSpeed={runningLoop.resetManualSpeed} />
        </Box>

        <ActionBar>
          {!runningState.running ? (
            <Tooltip
              title={
                bluetoothBlocked
                  ? "The treadmill can't be reached from this browser"
                  : stages.length === 0
                    ? 'Add at least one stage to your program first'
                    : ''
              }
            >
              <Box component="span" sx={{ flex: 1, display: 'flex' }}>
                <Button
                  fullWidth
                  size="large"
                  variant="contained"
                  startIcon={<PlayArrowRoundedIcon />}
                  onClick={runningLoop.start}
                  disabled={stages.length === 0 || bluetoothBlocked}
                >
                  Start
                </Button>
              </Box>
            </Tooltip>
          ) : (
            <>
              <Button
                size="large"
                variant="glass"
                onClick={runningLoop.stop}
                startIcon={<StopRoundedIcon sx={{ color: tokens.heart }} />}
                sx={{ flex: '0 0 38%' }}
              >
                Stop
              </Button>
              <Button
                fullWidth
                size="large"
                variant="contained"
                onClick={isPaused ? runningLoop.resume : runningLoop.pause}
                startIcon={isPaused ? <PlayArrowRoundedIcon /> : <PauseRoundedIcon />}
              >
                {isPaused ? 'Resume' : 'Pause'}
              </Button>
            </>
          )}
        </ActionBar>
      </Box>
    </Box>
  );
}
