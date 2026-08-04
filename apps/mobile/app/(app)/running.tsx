import { MaterialIcons } from '@expo/vector-icons';
import { Box, Button, ButtonText, HStack, VStack } from '@gluestack-ui/themed';
import { isPausedAtom, runningStateAtom } from '@runner/core';
import { useRouter } from 'expo-router';
import { useAtomValue } from 'jotai';
import { RunInfo } from '@/components/RunInfo';
import useRunningLoop from '@/hooks/useRunningLoop';

export default function RunningScreen() {
  const router = useRouter();
  const runningLoop = useRunningLoop();
  const runningState = useAtomValue(runningStateAtom);
  const isPaused = useAtomValue(isPausedAtom);

  const heartConnected = runningLoop.heartRateConnected();

  return (
    <Box flex={1} p={16}>
      <VStack space="xl">
        <RunInfo onResetManualSpeed={runningLoop.resetManualSpeed} />

        <HStack space="sm">
          <Button onPress={runningLoop.start} isDisabled={runningState.running}>
            <ButtonText>Start</ButtonText>
          </Button>
          {runningState.running && (
            <Button onPress={isPaused ? runningLoop.resume : runningLoop.pause}>
              <ButtonText>{isPaused ? 'Resume' : 'Pause'}</ButtonText>
            </Button>
          )}
          <Button onPress={runningLoop.stop} isDisabled={!runningState.running} action="negative">
            <ButtonText>Stop</ButtonText>
          </Button>
          <Box flex={1} />
          <Button
            onPress={() => router.back()}
            isDisabled={runningState.running}
            action="negative"
            variant="outline"
          >
            <ButtonText>Back</ButtonText>
          </Button>
        </HStack>

        <HStack space="md" alignItems="center">
          <MaterialIcons name="wb-sunny" size={20} color="white" />
          <MaterialIcons
            name="monitor-heart"
            size={20}
            color={heartConnected ? 'white' : 'rgba(255,255,255,0.25)'}
          />
        </HStack>
      </VStack>
    </Box>
  );
}
