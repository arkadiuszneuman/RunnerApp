'use client';

import { ReactNode } from 'react';
import {
  actualTreadmillSpeedAtom,
  currentStageAtom,
  currentStageIndexAtom,
  heartRateAtom,
  isManualSpeedActiveAtom,
  isPausedAtom,
  runningStateAtom,
  stagesAtom,
} from '@/app/atoms';
import StageStrip from '@/app/base/StageStrip';
import { displayFont, enter, stageTypeColor, stageTypeName, tokens } from '@/app/theme';
import DirectionsRunRoundedIcon from '@mui/icons-material/DirectionsRunRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import LandscapeRoundedIcon from '@mui/icons-material/LandscapeRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { Stage, Timespan } from '@runner/core';
import { useAtomValue } from 'jotai';
import Timer from './Timer/Timer';

const labelSx = {
  fontSize: '0.68rem',
  fontWeight: 600,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: tokens.textMuted,
} as const;

function formatClock(t: Timespan): string {
  return t.toString(t.totalSeconds >= 3600 ? 'hh:mm:ss' : 'mm:ss');
}

function stageTarget(stage: Stage): string {
  return stage.speedType === 'bmp' ? `${stage.bmp} bpm` : `${stage.tempo.toString('mm:ss')} /km`;
}

/** Same ±5 bpm band the run analysis uses for "time in target". */
function hrZone(hr: number | undefined, target: number | undefined) {
  if (hr === undefined || target === undefined) return { color: tokens.heart, label: undefined };
  const diff = hr - target;
  if (Math.abs(diff) <= 5) return { color: tokens.volt, label: 'In zone' };
  return diff < 0
    ? { color: tokens.cyan, label: `${-diff} below` }
    : { color: tokens.heart, label: `${diff} above` };
}

function Metric(
  props: Readonly<{
    label: string;
    icon: ReactNode;
    value: string | number;
    unit?: string;
    accent: string;
    index: number;
    /** Re-run a small pop animation whenever the value changes. */
    popOnChange?: boolean;
    children?: ReactNode;
  }>
) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 1.75, position: 'relative', overflow: 'hidden', ...enter(props.index) }}
    >
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          right: '-35%',
          bottom: '-70%',
          width: '90%',
          aspectRatio: '1',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(props.accent, 0.24)}, transparent 65%)`,
          transition: 'background 600ms ease',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          mb: 0.5,
          color: props.accent,
          transition: 'color 600ms ease',
          '& svg': { fontSize: 16 },
        }}
      >
        {props.icon}
        <Typography sx={labelSx}>{props.label}</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
        <Typography
          component="span"
          className="tabular"
          sx={{
            fontFamily: displayFont,
            fontWeight: 700,
            fontSize: 'clamp(2.1rem, 11vw, 2.9rem)',
            lineHeight: 1,
          }}
        >
          <Box
            component="span"
            key={props.popOnChange ? String(props.value) : undefined}
            sx={{ display: 'inline-block', animation: props.popOnChange ? 'pop 320ms var(--ease-out)' : 'none' }}
          >
            {props.value}
          </Box>
        </Typography>
        {props.unit && (
          <Typography component="span" sx={{ color: tokens.textMuted, fontWeight: 500 }}>
            {props.unit}
          </Typography>
        )}
      </Box>
      {props.children}
    </Paper>
  );
}

export default function RunInfo({ onResetManualSpeed }: Readonly<{ onResetManualSpeed?: () => void }>) {
  const heartRate = useAtomValue(heartRateAtom);
  const runningState = useAtomValue(runningStateAtom);
  const currentStage = useAtomValue(currentStageAtom);
  const currentStageIndex = useAtomValue(currentStageIndexAtom);
  const stages = useAtomValue(stagesAtom);
  const isManualSpeedActive = useAtomValue(isManualSpeedActiveAtom);
  const actualTreadmillSpeed = useAtomValue(actualTreadmillSpeedAtom);
  const isPaused = useAtomValue(isPausedAtom);

  const running = runningState.running;
  const runningTime = running ? runningState.runningTime : new Timespan();
  const displaySpeed = running ? runningState.treadmillOptions.speed : 0;
  const incline = running ? runningState.treadmillOptions.incline : 0;

  const timeLeft = running && currentStage ? currentStage.to.subtract(runningTime) : undefined;
  const progress =
    running && currentStage && timeLeft
      ? (currentStage.duration.subtract(timeLeft).totalMilliseconds * 100) /
        currentStage.duration.totalMilliseconds
      : 0;

  const stageColor = currentStage ? stageTypeColor[currentStage.type] : tokens.volt;
  const targetBpm = currentStage?.speedType === 'bmp' ? currentStage.bmp : undefined;
  const zone = hrZone(heartRate, targetBpm);
  const inCooldown = running && !currentStage && stages.length > 0;

  const nextStage = running
    ? currentStageIndex !== undefined
      ? stages[currentStageIndex]
      : undefined
    : stages[0];
  const programTotal = stages.at(-1)?.to;

  // Marker position on a ±25 bpm gauge; the in-zone (±5) band spans 40%–60%.
  const gaugePos =
    targetBpm !== undefined && heartRate !== undefined
      ? Math.min(100, Math.max(0, ((heartRate - (targetBpm - 25)) / 50) * 100))
      : 50;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={enter(0)}>
        <Timer
          primaryText={timeLeft ? timeLeft.toString('mm:ss') : inCooldown ? formatClock(runningTime) : '00:00'}
          primaryTextInfo={isPaused ? 'Paused' : inCooldown ? 'Cooldown' : 'Time left'}
          secondaryText={currentStage ? `${currentStageIndex ?? 0}/${stages.length}` : `0/${stages.length}`}
          secondaryTextInfo="Stage"
          progress={progress}
          colors={[stageColor, tokens.volt]}
          dimmed={isPaused}
        >
          {currentStage && (
            <Box
              key={currentStageIndex}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '1.6cqi',
                px: '3.5cqi',
                py: '1.2cqi',
                borderRadius: 999,
                fontSize: '4.4cqi',
                fontWeight: 600,
                color: stageColor,
                background: alpha(stageColor, 0.14),
                border: `1px solid ${alpha(stageColor, 0.35)}`,
                animation: 'scale-in 450ms var(--ease-spring) backwards',
              }}
            >
              {stageTypeName[currentStage.type]} · {stageTarget(currentStage)}
            </Box>
          )}
        </Timer>
      </Box>

      <Box sx={{ px: 0.5, ...enter(1) }}>
        <StageStrip stages={stages} height={34} elapsedMs={runningTime.totalMilliseconds} />
        <Box
          className="tabular"
          sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.75, ...labelSx, letterSpacing: '0.08em' }}
        >
          <span>{formatClock(runningTime)}</span>
          <span>{programTotal ? formatClock(programTotal) : '00:00'}</span>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
        <Metric
          label="Heart rate"
          icon={
            <FavoriteRoundedIcon
              sx={{ animation: heartRate ? `heartbeat ${60 / heartRate}s ease-in-out infinite` : 'none' }}
            />
          }
          value={heartRate ?? '--'}
          unit="bpm"
          accent={zone.color}
          index={2}
        >
          {targetBpm !== undefined ? (
            <Box sx={{ mt: 1.25, position: 'relative' }}>
              <Box
                sx={{
                  position: 'relative',
                  height: 6,
                  borderRadius: 3,
                  background: `linear-gradient(90deg, ${alpha(tokens.cyan, 0.4)} 0%, ${alpha(tokens.volt, 0.55)} 40%, ${alpha(tokens.volt, 0.55)} 60%, ${alpha(tokens.heart, 0.5)} 100%)`,
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: `${gaugePos}%`,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: '#fff',
                    transform: 'translate(-50%, -50%)',
                    boxShadow: `0 0 0 3px ${alpha(zone.color, 0.45)}, 0 0 12px ${zone.color}`,
                    transition: 'left 800ms var(--ease-out), box-shadow 600ms ease',
                  }}
                />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                Target {targetBpm}
                {zone.label && (
                  <Box component="span" sx={{ color: zone.color, fontWeight: 600 }}>
                    {' · '}
                    {zone.label}
                  </Box>
                )}
              </Typography>
            </Box>
          ) : (
            currentStage?.speedType === 'tempo' && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Target tempo {currentStage.tempo.toString('mm:ss')} /km
              </Typography>
            )
          )}
        </Metric>

        <Metric
          label="Speed"
          icon={<DirectionsRunRoundedIcon />}
          value={isManualSpeedActive ? actualTreadmillSpeed : displaySpeed}
          unit="km/h"
          accent={isManualSpeedActive ? tokens.amber : tokens.cyan}
          index={3}
          popOnChange
        >
          {isManualSpeedActive && (
            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.75 }}>
              <Typography variant="caption" sx={{ color: tokens.amber, fontWeight: 600 }}>
                Manual · program {displaySpeed}
              </Typography>
              {onResetManualSpeed && (
                <Button
                  size="small"
                  variant="glass"
                  startIcon={<RestartAltRoundedIcon />}
                  onClick={onResetManualSpeed}
                >
                  Reset
                </Button>
              )}
            </Box>
          )}
        </Metric>

        <Metric
          label="Incline"
          icon={<LandscapeRoundedIcon />}
          value={incline}
          unit="%"
          accent={tokens.violet}
          index={4}
          popOnChange
        />

        <Metric
          label="Duration"
          icon={<TimerOutlinedIcon />}
          value={formatClock(runningTime)}
          accent={tokens.volt}
          index={5}
        />
      </Box>

      {nextStage && (
        <Paper
          variant="outlined"
          key={currentStageIndex}
          sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, ...enter(6) }}
        >
          <Box
            sx={{
              width: 4,
              alignSelf: 'stretch',
              borderRadius: 2,
              bgcolor: stageTypeColor[nextStage.type],
              boxShadow: `0 0 12px ${stageTypeColor[nextStage.type]}`,
            }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={labelSx}>{running ? 'Up next' : 'First up'}</Typography>
            <Typography sx={{ fontWeight: 600 }}>
              {stageTypeName[nextStage.type]} ·{' '}
              <span className="tabular">{nextStage.duration.toString('mm:ss')}</span>
            </Typography>
          </Box>
          <Typography className="tabular" sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.25rem' }}>
            {stageTarget(nextStage)}
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
