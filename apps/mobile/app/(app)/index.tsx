import { Box, Button, ButtonText, VStack } from '@gluestack-ui/themed';
import { activeProgramIdAtom, stagesAtom } from '@runner/core';
import { Link, useRouter } from 'expo-router';
import { useAtomValue } from 'jotai';
import { useEffect, useState } from 'react';
import { getProgram } from '@/api/programs';
import { RunnerText } from '@/components/RunnerText';
import useRunningLoop from '@/hooks/useRunningLoop';

export default function HomeScreen() {
  const router = useRouter();
  const stages = useAtomValue(stagesAtom);
  const activeProgramId = useAtomValue(activeProgramIdAtom);
  const [programName, setProgramName] = useState<string | null>(null);

  const runningLoop = useRunningLoop();

  useEffect(() => {
    if (!activeProgramId) {
      setProgramName(null);
      return;
    }
    getProgram(activeProgramId)
      .then((program) => setProgramName(program?.name ?? null))
      .catch(() => {});
  }, [activeProgramId]);

  const hasBmpStages = stages.some((stage) => stage.speedType === 'bmp');
  const startDisabled = stages.length === 0 || (hasBmpStages && !runningLoop.heartRateConnected());

  return (
    <Box flex={1} p={16}>
      <VStack space="md">
        <Button onPress={runningLoop.connectHeartRateMonitor}>
          <ButtonText>Connect heart rate</ButtonText>
        </Button>

        <Link href="/(app)/programs" asChild>
          <Button action="secondary">
            <ButtonText>Programs</ButtonText>
          </Button>
        </Link>

        <Button isDisabled={startDisabled} onPress={() => router.push('/(app)/running')}>
          <ButtonText>Start running</ButtonText>
        </Button>

        {programName ? (
          <RunnerText textTransform="none" remSize={0.85} style={{ opacity: 0.7 }}>
            Active program: {programName}
          </RunnerText>
        ) : (
          <RunnerText textTransform="none" remSize={0.85} style={{ opacity: 0.7 }}>
            No program selected — pick one on the Programs screen
          </RunnerText>
        )}
      </VStack>
    </Box>
  );
}
