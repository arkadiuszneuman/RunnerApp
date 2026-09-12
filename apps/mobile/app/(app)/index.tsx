import { MaterialIcons } from '@expo/vector-icons';
import { Box, Button, ButtonIcon, ButtonText, Card, VStack } from '@gluestack-ui/themed';
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
    if (!activeProgramId) return;
    let cancelled = false;
    getProgram(activeProgramId)
      .then((program) => {
        if (!cancelled) setProgramName(program?.name ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeProgramId]);

  const displayProgramName = activeProgramId ? programName : null;
  const hasBmpStages = stages.some((stage) => stage.speedType === 'bmp');
  const heartRateConnected = runningLoop.heartRateConnected();
  const startDisabled = stages.length === 0 || (hasBmpStages && !heartRateConnected);

  return (
    <Box flex={1} p={16} justifyContent="space-between">
      <VStack space="md">
        <RunnerText remSize={1.4} textTransform="none" fontWeight="700">
          Ready to run?
        </RunnerText>

        <Card testID="home-active-program-card">
          <VStack space="xs">
            <RunnerText textVariant="secondary" remSize={0.75}>
              Active program
            </RunnerText>
            {displayProgramName ? (
              <RunnerText textTransform="none" remSize={1.1}>
                {displayProgramName}
              </RunnerText>
            ) : (
              <RunnerText textTransform="none" remSize={0.95} style={{ opacity: 0.7 }}>
                No program selected
              </RunnerText>
            )}
          </VStack>
        </Card>

        <Link href="/(app)/programs" asChild>
          <Button testID="home-programs-button" action="secondary" variant="outline" size="sm">
            <ButtonText>{displayProgramName ? 'Change program' : 'Choose a program'}</ButtonText>
          </Button>
        </Link>
      </VStack>

      <VStack space="sm">
        {hasBmpStages && (
          <>
            {!heartRateConnected && (
              <RunnerText textVariant="secondary" textTransform="none" remSize={0.8} style={{ opacity: 0.85 }}>
                This program needs a heart rate monitor to start.
              </RunnerText>
            )}
            <Button
              testID="home-connect-heart-rate-button"
              variant="outline"
              action="secondary"
              onPress={runningLoop.connectHeartRateMonitor}
            >
              <ButtonIcon
                as={() => (
                  <MaterialIcons
                    name="monitor-heart"
                    size={16}
                    color={heartRateConnected ? '#3CF8C8' : 'white'}
                  />
                )}
                mr="$2"
              />
              <ButtonText>{heartRateConnected ? 'Heart rate connected' : 'Connect heart rate'}</ButtonText>
            </Button>
          </>
        )}

        <Button
          testID="home-start-button"
          size="xl"
          isDisabled={startDisabled}
          onPress={() => router.push('/(app)/running')}
        >
          <ButtonText>Start running</ButtonText>
        </Button>
      </VStack>
    </Box>
  );
}
