import { ReactNode } from 'react';
import { actualTreadmillSpeedAtom, currentStageAtom, currentStageIndexAtom, heartRateAtom, isManualSpeedActiveAtom, runningStateAtom, stagesAtom } from '@/app/atoms';
import RunnerTypography, { RunnerTypographyProps } from '@/app/base/RunnerTypography';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import FavoriteIcon from '@mui/icons-material/Favorite';
import LandscapeIcon from '@mui/icons-material/Landscape';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { Button, Chip, Grid } from '@mui/material';
import { useAtomValue } from 'jotai';
import Timer from './Timer/Timer';

function RunInfoCategory(props: RunnerTypographyProps) {
  return <RunnerTypography {...props} sx={{ fontSize: '0.8rem', ...props.sx }} />;
}

function RunInfoData(props: RunnerTypographyProps) {
  return <RunnerTypography {...props} sx={{ fontSize: '1.5rem', fontWeight: 400, ...props.sx }} />;
}

function RunInfoUnit(props: RunnerTypographyProps) {
  return (
    <RunnerTypography
      {...props}
      sx={{ fontSize: '0.8rem', textTransform: 'lowercase', ...props.sx }}
    />
  );
}

function Tile(
  props: Readonly<{
    categoryName: string;
    runInfoData: string | number;
    runInfoUnit: string;
    icon?: ReactNode;
  }>
) {
  return (
    <Grid container sx={{ display: 'flex', flexDirection: 'column' }} spacing={0.5} size={4}>
      <Grid container direction="row" spacing={0.5}>
        <Grid>
          <RunInfoCategory textVariant="secondary">{props.icon}</RunInfoCategory>
        </Grid>
        <Grid>
          <RunInfoCategory textVariant="secondary">{props.categoryName}</RunInfoCategory>
        </Grid>
      </Grid>
      <Grid container spacing={0.5} sx={{ alignItems: 'end' }}>
        <Grid>
          <RunInfoData>{props.runInfoData}</RunInfoData>
        </Grid>
        <Grid>
          <RunInfoUnit>{props.runInfoUnit}</RunInfoUnit>
        </Grid>
      </Grid>
    </Grid>
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

  const displaySpeed = runningState.running ? runningState.treadmillOptions.speed : 0;

  return (
    <Grid container rowSpacing={2} sx={{ justifyContent: 'center' }}>
      <Grid size="auto">
        {runningState.running ? (
          <Timer
            primaryText={currentStage?.to.subtract(runningState.runningTime).toString('mm:ss')}
            primaryTextInfo="Time left"
            secondaryText={
              currentStage ? `${currentStageIndex ?? 0}/${stages.length}` : ''
            }
            secondaryTextInfo="Stage"
            progress={
              currentStage
                ? (currentStage.duration.subtract(
                    currentStage.to.subtract(runningState.runningTime)
                  ).totalMilliseconds *
                    100) /
                  currentStage.duration.totalMilliseconds
                : 0
            }
          />
        ) : (
          <Timer
            primaryText="00:00"
            primaryTextInfo="Time left"
            secondaryText={
              currentStage ? `${currentStageIndex ?? 0}/${stages.length}` : '0/0'
            }
            secondaryTextInfo="Stage"
            progress={0}
          />
        )}
      </Grid>
      <Grid container rowSpacing={4}>
        <Grid size={2}></Grid>
        {isManualSpeedActive ? (
          <Grid container sx={{ display: 'flex', flexDirection: 'column' }} spacing={0.5} size={4}>
            <Grid container direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <Grid>
                <RunInfoCategory textVariant="secondary">
                  <DirectionsRunIcon sx={{ fontSize: '0.8rem' }} />
                </RunInfoCategory>
              </Grid>
              <Grid>
                <RunInfoCategory textVariant="secondary">Speed</RunInfoCategory>
              </Grid>
              <Grid>
                <Chip label="MANUAL" size="small" color="warning" sx={{ fontSize: '0.6rem', height: '16px' }} />
              </Grid>
            </Grid>
            <Grid container spacing={0.5} sx={{ alignItems: 'end' }}>
              <Grid>
                <RunInfoData>{actualTreadmillSpeed}</RunInfoData>
              </Grid>
              <Grid>
                <RunInfoUnit>km/h</RunInfoUnit>
              </Grid>
            </Grid>
            <Grid>
              <RunnerTypography sx={{ fontSize: '0.75rem' }} textVariant="secondary">
                Program: {displaySpeed} km/h
              </RunnerTypography>
            </Grid>
            {onResetManualSpeed && (
              <Grid>
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  startIcon={<RestartAltIcon />}
                  onClick={onResetManualSpeed}
                  sx={{ fontSize: '0.7rem', py: 0.25 }}
                >
                  Reset
                </Button>
              </Grid>
            )}
          </Grid>
        ) : (
          <Tile
            categoryName="Speed"
            runInfoData={displaySpeed}
            runInfoUnit="km/h"
            icon={<DirectionsRunIcon sx={{ fontSize: '0.8rem' }} />}
          />
        )}
        <Tile
          categoryName="Incline"
          runInfoData={runningState.running ? runningState.treadmillOptions.incline : 0}
          runInfoUnit="%"
          icon={<LandscapeIcon sx={{ fontSize: '0.8rem' }} />}
        />
        <Grid size={2}></Grid>
        <Grid size={2}></Grid>
        <Tile
          categoryName="Heart rate"
          runInfoData={heartRate ?? 0}
          runInfoUnit="bmp"
          icon={<MonitorHeartIcon sx={{ fontSize: '0.8rem' }} />}
        />
        {currentStage?.speedType === 'bmp' && (
          <Tile
            categoryName="Target HR"
            runInfoData={currentStage.bmp}
            runInfoUnit="bmp"
            icon={<FavoriteIcon sx={{ fontSize: '0.8rem' }} />}
          />
        )}
        {currentStage?.speedType === 'tempo' && (
          <Tile
            categoryName="Target tempo"
            runInfoData={currentStage.tempo.toString('mm:ss')}
            runInfoUnit="min/km"
            icon={<FavoriteIcon sx={{ fontSize: '0.8rem' }} />}
          />
        )}
        <Grid size={2}></Grid>
        <Grid size={4}></Grid>
        <Tile
          categoryName="Duration"
          runInfoData={runningState.running ? runningState.runningTime.toString('mm:ss') : '00:00'}
          runInfoUnit="min"
          icon={<AccessTimeIcon sx={{ fontSize: '0.8rem' }} />}
        />
        <Grid size={4}></Grid>
      </Grid>
    </Grid>
  );
}
