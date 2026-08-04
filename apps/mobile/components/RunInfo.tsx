import {
  actualTreadmillSpeedAtom,
  currentStageAtom,
  currentStageIndexAtom,
  heartRateAtom,
  isManualSpeedActiveAtom,
  runningStateAtom,
  stagesAtom,
} from '@runner/core';
import { MaterialIcons } from '@expo/vector-icons';
import { Badge, BadgeText, Box, Button, ButtonIcon, ButtonText, HStack, VStack } from '@gluestack-ui/themed';
import { useAtomValue } from 'jotai';
import type { ReactNode } from 'react';
import { RunnerText } from './RunnerText';
import { Timer } from './Timer';

function RunInfoCategory({ children }: { children?: ReactNode }) {
  return (
    <RunnerText textVariant="secondary" remSize={0.8}>
      {children}
    </RunnerText>
  );
}

function RunInfoData({ children }: { children?: ReactNode }) {
  return (
    <RunnerText remSize={1.5} fontWeight="400">
      {children}
    </RunnerText>
  );
}

function RunInfoUnit({ children }: { children?: ReactNode }) {
  return (
    <RunnerText remSize={0.8} textTransform="lowercase">
      {children}
    </RunnerText>
  );
}

function Tile({
  categoryName,
  runInfoData,
  runInfoUnit,
  icon,
}: Readonly<{ categoryName: string; runInfoData: string | number; runInfoUnit: string; icon?: ReactNode }>) {
  return (
    <VStack space="xs" width="33%">
      <HStack space="xs" alignItems="center">
        {icon}
        <RunInfoCategory>{categoryName}</RunInfoCategory>
      </HStack>
      <HStack space="xs" alignItems="flex-end">
        <RunInfoData>{runInfoData}</RunInfoData>
        <RunInfoUnit>{runInfoUnit}</RunInfoUnit>
      </HStack>
    </VStack>
  );
}

const tileIcon = (name: keyof typeof MaterialIcons.glyphMap) => (
  <MaterialIcons name={name} size={13} color="rgba(160,189,255,0.46)" />
);

export function RunInfo({ onResetManualSpeed }: Readonly<{ onResetManualSpeed?: () => void }>) {
  const heartRate = useAtomValue(heartRateAtom);
  const runningState = useAtomValue(runningStateAtom);
  const currentStage = useAtomValue(currentStageAtom);
  const currentStageIndex = useAtomValue(currentStageIndexAtom);
  const stages = useAtomValue(stagesAtom);
  const isManualSpeedActive = useAtomValue(isManualSpeedActiveAtom);
  const actualTreadmillSpeed = useAtomValue(actualTreadmillSpeedAtom);

  const displaySpeed = runningState.running ? runningState.treadmillOptions.speed : 0;

  return (
    <VStack space="lg" alignItems="center">
      {runningState.running ? (
        <Timer
          primaryText={currentStage?.to.subtract(runningState.runningTime).toString('mm:ss')}
          primaryTextInfo="Time left"
          secondaryText={currentStage ? `${currentStageIndex ?? 0}/${stages.length}` : ''}
          secondaryTextInfo="Stage"
          progress={
            currentStage
              ? (currentStage.duration.subtract(currentStage.to.subtract(runningState.runningTime))
                  .totalMilliseconds *
                  100) /
                currentStage.duration.totalMilliseconds
              : 0
          }
        />
      ) : (
        <Timer
          primaryText="00:00"
          primaryTextInfo="Time left"
          secondaryText={currentStage ? `${currentStageIndex ?? 0}/${stages.length}` : '0/0'}
          secondaryTextInfo="Stage"
          progress={0}
        />
      )}

      <HStack flexWrap="wrap" width="100%" rowGap={16}>
        {isManualSpeedActive ? (
          <VStack space="xs" width="33%">
            <HStack space="xs" alignItems="center">
              {tileIcon('directions-run')}
              <RunInfoCategory>Speed</RunInfoCategory>
              <Badge action="warning" size="sm">
                <BadgeText>MANUAL</BadgeText>
              </Badge>
            </HStack>
            <HStack space="xs" alignItems="flex-end">
              <RunInfoData>{actualTreadmillSpeed}</RunInfoData>
              <RunInfoUnit>km/h</RunInfoUnit>
            </HStack>
            <RunnerText textVariant="secondary" remSize={0.75}>
              Program: {displaySpeed} km/h
            </RunnerText>
            {onResetManualSpeed && (
              <Button size="xs" variant="outline" action="secondary" onPress={onResetManualSpeed}>
                <ButtonIcon as={() => <MaterialIcons name="restart-alt" size={14} color="white" />} mr="$1" />
                <ButtonText>Reset</ButtonText>
              </Button>
            )}
          </VStack>
        ) : (
          <Tile categoryName="Speed" runInfoData={displaySpeed} runInfoUnit="km/h" icon={tileIcon('directions-run')} />
        )}

        <Tile
          categoryName="Incline"
          runInfoData={runningState.running ? runningState.treadmillOptions.incline : 0}
          runInfoUnit="%"
          icon={tileIcon('landscape')}
        />

        <Box width="33%" />

        <Tile categoryName="Heart rate" runInfoData={heartRate ?? 0} runInfoUnit="bmp" icon={tileIcon('monitor-heart')} />

        {currentStage?.speedType === 'bmp' && (
          <Tile categoryName="Target HR" runInfoData={currentStage.bmp} runInfoUnit="bmp" icon={tileIcon('favorite')} />
        )}
        {currentStage?.speedType === 'tempo' && (
          <Tile
            categoryName="Target tempo"
            runInfoData={currentStage.tempo.toString('mm:ss')}
            runInfoUnit="min/km"
            icon={tileIcon('favorite')}
          />
        )}

        <Box width="33%" />

        <Tile
          categoryName="Duration"
          runInfoData={runningState.running ? runningState.runningTime.toString('mm:ss') : '00:00'}
          runInfoUnit="min"
          icon={tileIcon('access-time')}
        />
      </HStack>
    </VStack>
  );
}
