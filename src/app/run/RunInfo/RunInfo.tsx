import { ReactNode } from 'react';
import { currentStageAtom, heartRateAtom, runningStateAtom, stagesAtom } from '@/app/atoms';
import RunnerTypography, { RunnerTypographyProps } from '@/app/base/RunnerTypography';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import FavoriteIcon from '@mui/icons-material/Favorite';
import LandscapeIcon from '@mui/icons-material/Landscape';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import { Grid2 } from '@mui/material';
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

function Tile(props: {
  categoryName: string;
  runInfoData: string | number;
  runInfoUnit: string;
  icon?: ReactNode;
}) {
  return (
    <Grid2 container direction="column" size={6} spacing={0.5}>
      <Grid2 container direction="row" spacing={0.5}>
        <Grid2>
          <RunInfoCategory textVariant="secondary">{props.icon}</RunInfoCategory>
        </Grid2>
        <Grid2>
          <RunInfoCategory textVariant="secondary">{props.categoryName}</RunInfoCategory>
        </Grid2>
      </Grid2>
      <Grid2 container spacing={0.5} alignItems="end">
        <Grid2>
          <RunInfoData>{props.runInfoData}</RunInfoData>
        </Grid2>
        <Grid2>
          <RunInfoUnit>{props.runInfoUnit}</RunInfoUnit>
        </Grid2>
      </Grid2>
    </Grid2>
  );
}

export default function RunInfo() {
  const heartRate = useAtomValue(heartRateAtom);
  const runningState = useAtomValue(runningStateAtom);
  const currentStage = useAtomValue(currentStageAtom);
  const stages = useAtomValue(stagesAtom);

  return (
    <Grid2 container rowSpacing={2} justifyContent="center">
      <Grid2 size="auto">
        {runningState.running ? (
          <Timer
            primaryText={currentStage?.to.subtract(runningState.runningTime).toString('mm:ss')}
            primaryTextInfo="Time left"
            secondaryText={
              currentStage ? `${stages.indexOf(currentStage) + 1}/${stages.length}` : ''
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
              currentStage ? `${stages.indexOf(currentStage) + 1}/${stages.length}` : '0/0'
            }
            secondaryTextInfo="Stage"
            progress={0}
          />
        )}
      </Grid2>
      <Grid2 container rowSpacing={4}>
        <Tile
          categoryName="Speed"
          runInfoData={runningState.running ? runningState.treadmillOptions.speed : 0}
          runInfoUnit="km/h"
          icon={<DirectionsRunIcon sx={{ fontSize: '0.8rem' }} />}
        />
        <Tile
          categoryName="Incline"
          runInfoData={runningState.running ? runningState.treadmillOptions.incline : 0}
          runInfoUnit="%"
          icon={<LandscapeIcon sx={{ fontSize: '0.8rem' }} />}
        />
        <Tile
          categoryName="Heart rate"
          runInfoData={heartRate ?? 0}
          runInfoUnit="bmp"
          icon={<MonitorHeartIcon sx={{ fontSize: '0.8rem' }} />}
        />
        {currentStage && 'bmp' in currentStage && (
          <Tile
            categoryName="Target HR"
            runInfoData={currentStage.bmp}
            runInfoUnit="bmp"
            icon={<FavoriteIcon sx={{ fontSize: '0.8rem' }} />}
          />
        )}
        {currentStage && 'tempo' in currentStage && (
          <Tile
            categoryName="Target tempo"
            runInfoData={currentStage.tempo.toString('mm:ss')}
            runInfoUnit="min/km"
            icon={<FavoriteIcon sx={{ fontSize: '0.8rem' }} />}
          />
        )}
        <Tile
          categoryName="Duration"
          runInfoData={runningState.running ? runningState.runningTime.toString('mm:ss') : '00:00'}
          runInfoUnit="min"
          icon={<AccessTimeIcon sx={{ fontSize: '0.8rem' }} />}
        />
        <Grid2 size={6}></Grid2>
      </Grid2>
    </Grid2>
  );
}
