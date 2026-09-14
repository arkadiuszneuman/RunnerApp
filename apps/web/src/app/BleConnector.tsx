'use client';

import { ReactNode, useEffect, useState } from 'react';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import DirectionsRunRoundedIcon from '@mui/icons-material/DirectionsRunRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import LayersRoundedIcon from '@mui/icons-material/LayersRounded';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import ViewAgendaRoundedIcon from '@mui/icons-material/ViewAgendaRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { useAtomValue } from 'jotai';
import Link from 'next/link';
import { heartRateAtom, isRunningAtom, stagesAtom } from './atoms';
import BluetoothNotice, { isBluetoothBlocked } from './base/BluetoothNotice';
import DeviceCard from './base/DeviceCard';
import Page from './base/Page';
import SpeedControllerPicker from './base/SpeedControllerPicker';
import StageStrip from './base/StageStrip';
import BleManager from './BleManager';
import { isChooserCancelled, useBluetoothAvailability } from './ble/bluetoothAvailability';
import {
  useHeartRateConnected,
  useHeartRateRemembered,
  useTreadmillConnected,
  useTreadmillRemembered,
} from './ble/useDeviceConnection';
import HeartRateManager from './HeartRateManager';
import { displayFont, enter, pressable, tokens } from './theme';
import { activeProgramNameAtom } from './userData';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Night owl mode';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function ProgramStat({ icon, children }: Readonly<{ icon: ReactNode; children: ReactNode }>) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        color: tokens.textMuted,
        fontSize: '0.9rem',
        '& svg': { fontSize: 18 },
      }}
    >
      {icon}
      <span className="tabular">{children}</span>
    </Box>
  );
}

function QuickLink(
  props: Readonly<{
    href: string;
    label: string;
    sub: string;
    icon: ReactNode;
    color: string;
    index: number;
  }>
) {
  return (
    <Paper
      variant="outlined"
      component={Link}
      href={props.href}
      sx={{
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        ...pressable,
        ...enter(props.index),
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: '12px',
          display: 'grid',
          placeItems: 'center',
          color: props.color,
          background: alpha(props.color, 0.14),
        }}
      >
        {props.icon}
      </Box>
      <Box>
        <Typography sx={{ fontWeight: 600 }}>{props.label}</Typography>
        <Typography variant="caption" color="text.secondary">
          {props.sub}
        </Typography>
      </Box>
    </Paper>
  );
}

export default function BleConnector() {
  const stages = useAtomValue(stagesAtom);
  // undefined = still loading (settings and/or the programs list); null = no
  // active program — see userData.ts. Avoids flashing "No program selected"
  // before either has come back.
  const programName = useAtomValue(activeProgramNameAtom);
  const heartRate = useAtomValue(heartRateAtom);
  const running = useAtomValue(isRunningAtom);

  const bluetooth = useBluetoothAvailability();
  const bluetoothBlocked = isBluetoothBlocked(bluetooth);

  const hrConnected = useHeartRateConnected();
  const hrRemembered = useHeartRateRemembered();
  const treadmillConnected = useTreadmillConnected();
  const treadmillRemembered = useTreadmillRemembered();

  const [hrConnecting, setHrConnecting] = useState(false);
  const [treadmillConnecting, setTreadmillConnecting] = useState(false);

  // Reconnect both remembered devices as soon as the home screen mounts, so the app is
  // ready to run without the user re-picking a device every time. Silent — no picker,
  // no-op if nothing is remembered. `getDevices()` needs no user gesture.
  useEffect(() => {
    if (bluetooth !== 'available') return;
    if (HeartRateManager.hasRemembered() && !hrConnected) {
      setHrConnecting(true);
      HeartRateManager.connectRemembered()
        .catch((error) => console.warn('Heart-rate monitor reconnect failed', error))
        .finally(() => setHrConnecting(false));
    }
    if (BleManager.hasRemembered() && !treadmillConnected) {
      setTreadmillConnecting(true);
      BleManager.connectRemembered()
        .catch((error) => console.warn('Treadmill reconnect failed', error))
        .finally(() => setTreadmillConnecting(false));
    }
    // Only ever run once, on mount — this is a startup reconnect, not a reactive effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bluetooth]);

  async function connectHeartRate() {
    setHrConnecting(true);
    try {
      await HeartRateManager.connect();
    } catch (error) {
      if (!isChooserCancelled(error)) console.warn('Heart-rate monitor connection failed', error);
    } finally {
      setHrConnecting(false);
    }
  }

  async function changeHeartRate() {
    setHrConnecting(true);
    try {
      await HeartRateManager.changeDevice();
    } catch (error) {
      if (!isChooserCancelled(error)) console.warn('Heart-rate monitor connection failed', error);
    } finally {
      setHrConnecting(false);
    }
  }

  async function forgetHeartRate() {
    try {
      await HeartRateManager.forgetDevice();
    } catch (error) {
      console.warn('Forgetting the heart-rate monitor failed', error);
    }
  }

  async function connectTreadmill() {
    setTreadmillConnecting(true);
    try {
      await BleManager.connect();
    } catch (error) {
      if (!isChooserCancelled(error)) console.warn('Treadmill connection failed', error);
    } finally {
      setTreadmillConnecting(false);
    }
  }

  async function changeTreadmill() {
    setTreadmillConnecting(true);
    try {
      await BleManager.changeDevice();
    } catch (error) {
      if (!isChooserCancelled(error)) console.warn('Treadmill connection failed', error);
    } finally {
      setTreadmillConnecting(false);
    }
  }

  async function forgetTreadmill() {
    try {
      await BleManager.forgetDevice();
    } catch (error) {
      console.warn('Forgetting the treadmill failed', error);
    }
  }

  const hasHrStages = stages.some((x) => x.speedType === 'bmp');
  const canStart = !bluetoothBlocked && stages.length > 0 && (!hasHrStages || hrConnected);
  const total = stages.at(-1)?.to;
  const beat = heartRate ? 60 / heartRate : 1;

  const startHint = bluetoothBlocked
    ? "The treadmill can't be reached from this browser"
    : stages.length === 0
      ? 'Choose a program with at least one stage'
      : !canStart
        ? 'Connect your heart-rate monitor to start'
        : treadmillConnected
          ? 'Ready to go'
          : 'The treadmill pairs on the next screen';

  const hrStatus = hrConnected ? (
    heartRate ? (
      <>
        <Box component="span" className="tabular" sx={{ color: 'text.primary', fontWeight: 700 }}>
          {heartRate}
        </Box>{' '}
        bpm
      </>
    ) : (
      'Connected'
    )
  ) : hrConnecting ? (
    'Connecting…'
  ) : hrRemembered ? (
    `${hrRemembered.name || 'Remembered sensor'} — not connected`
  ) : hasHrStages ? (
    'Required to start'
  ) : (
    'Optional for tempo'
  );

  const treadmillStatus = treadmillConnected
    ? 'Connected'
    : treadmillConnecting
      ? 'Connecting…'
      : treadmillRemembered
        ? `${treadmillRemembered.name || 'Remembered treadmill'} — not connected`
        : 'Pairs when you connect';

  return (
    <Page eyebrow={<span suppressHydrationWarning>{greeting()}</span>} title="Ready to run?">
      {/* Active program */}
      <Paper
        variant="outlined"
        sx={{ p: 2.5, mb: 1.5, position: 'relative', overflow: 'hidden', ...enter(1) }}
      >
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            top: '-60%',
            right: '-30%',
            width: '80%',
            aspectRatio: '1',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${alpha(tokens.volt, 0.16)}, transparent 65%)`,
            pointerEvents: 'none',
          }}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="overline" color="text.secondary">
            Active program
          </Typography>
          {programName && (
            <Button size="small" variant="glass" href="/programs" LinkComponent={Link}>
              Change
            </Button>
          )}
        </Box>

        {programName === undefined ? (
          <Box sx={{ py: 0.5 }}>
            <Skeleton variant="text" width="60%" height={38} />
            <Skeleton variant="text" width="40%" />
          </Box>
        ) : programName ? (
          <>
            <Typography variant="h5" component="h2" sx={{ fontSize: '1.9rem', mb: 1 }}>
              {programName}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
              <ProgramStat icon={<TimerOutlinedIcon />}>
                {total
                  ? total.toString(total.totalSeconds >= 3600 ? 'hh:mm:ss' : 'mm:ss')
                  : '00:00'}
              </ProgramStat>
              <ProgramStat icon={<LayersRoundedIcon />}>
                {stages.length} {stages.length === 1 ? 'stage' : 'stages'}
              </ProgramStat>
              {hasHrStages && (
                <ProgramStat icon={<FavoriteRoundedIcon sx={{ color: tokens.heart }} />}>
                  HR guided
                </ProgramStat>
              )}
            </Box>
            <StageStrip stages={stages} height={64} />
          </>
        ) : (
          <Box sx={{ py: 1 }}>
            <Typography variant="h6" sx={{ mb: 0.5 }}>
              No program selected
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Pick a saved program or build a new one.
            </Typography>
            <Button variant="contained" href="/programs" LinkComponent={Link}>
              Choose a program
            </Button>
          </Box>
        )}
      </Paper>

      <BluetoothNotice availability={bluetooth} sx={{ mb: 1.5, ...enter(2) }} />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <DeviceCard
          icon={
            <>
              {hrConnected && (
                <Box
                  aria-hidden
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    border: `2px solid ${alpha(tokens.heart, 0.5)}`,
                    animation: `ping ${beat * 2}s var(--ease-out) infinite`,
                  }}
                />
              )}
              <FavoriteRoundedIcon
                sx={{ animation: hrConnected ? `heartbeat ${beat}s ease-in-out infinite` : 'none' }}
              />
            </>
          }
          color={tokens.heart}
          title="Heart-rate monitor"
          status={hrStatus}
          connected={hrConnected}
          connecting={hrConnecting}
          remembered={!!hrRemembered}
          disabled={bluetoothBlocked}
          menuDisabled={running}
          index={2}
          onConnect={connectHeartRate}
          onChange={changeHeartRate}
          onForget={forgetHeartRate}
        />

        <DeviceCard
          icon={<DirectionsRunRoundedIcon />}
          color={tokens.cyan}
          title="Treadmill"
          status={treadmillStatus}
          connected={treadmillConnected}
          connecting={treadmillConnecting}
          remembered={!!treadmillRemembered}
          disabled={bluetoothBlocked}
          menuDisabled={running}
          index={2}
          onConnect={connectTreadmill}
          onChange={changeTreadmill}
          onForget={forgetTreadmill}
        />
      </Box>

      <Box sx={{ mt: 1.5 }}>
        <SpeedControllerPicker index={3} />
      </Box>

      {/* Primary CTA */}
      <Box sx={{ mt: 3, ...enter(3) }}>
        <Button
          fullWidth
          size="large"
          variant="contained"
          href="/running"
          LinkComponent={Link}
          disabled={!canStart}
          endIcon={<ArrowForwardRoundedIcon />}
          sx={{
            minHeight: 64,
            fontFamily: displayFont,
            fontSize: '1.35rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            '& .MuiButton-endIcon': { transition: 'transform 300ms var(--ease-spring)' },
            '&:hover .MuiButton-endIcon': { transform: 'translateX(5px)' },
          }}
        >
          Start running
        </Button>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', textAlign: 'center', mt: 1 }}
        >
          {startHint}
        </Typography>
      </Box>

      {/* Quick links */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mt: 3 }}>
        <QuickLink
          href="/programs"
          label="Programs"
          sub="Build & manage"
          icon={<ViewAgendaRoundedIcon />}
          color={tokens.violet}
          index={4}
        />
        <QuickLink
          href="/runs"
          label="History"
          sub="Analyze past runs"
          icon={<HistoryRoundedIcon />}
          color={tokens.cyan}
          index={5}
        />
      </Box>
    </Page>
  );
}
