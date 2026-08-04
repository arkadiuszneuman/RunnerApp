import { Box, Checkbox, CheckboxIcon, CheckboxIndicator, CheckboxLabel, VStack } from '@gluestack-ui/themed';
import {
  programAtom,
  programCooldownAtom,
  type MultiplyStage,
  type Stage,
  type StageType,
} from '@runner/core';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { RunnerText } from './RunnerText';
import { editingSectionAtom } from '@/state/addProgramAtoms';

const STAGE_TYPE_NAMES: Record<StageType, string> = {
  simple: 'Run',
  sprint: 'Sprint',
  regeneration: 'Regeneration',
};

function Section({ section, hovered, manyTimes }: Readonly<{ section: Stage; hovered: boolean; manyTimes: boolean }>) {
  return (
    <LinearGradient
      colors={hovered ? ['rgba(155,42,42,1)', 'rgba(237,221,83,0)'] : ['rgba(36,92,114,1)', 'rgba(237,221,83,0)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{
        padding: 8,
        borderRadius: 4,
        transform: [{ skewX: '-15deg' }],
        marginLeft: manyTimes ? 32 : 0,
      }}
    >
      <Box style={{ transform: [{ skewX: '15deg' }], paddingLeft: 8 }}>
        <RunnerText style={{ marginBottom: 4 }}>
          {STAGE_TYPE_NAMES[section.type]} {section.duration.toString('mm:ss')}
        </RunnerText>
        {section.speedType === 'bmp' && <RunnerText>{section.bmp}bmp</RunnerText>}
        {section.speedType === 'tempo' && <RunnerText>{section.tempo.toString('mm:ss')} min/km</RunnerText>}
      </Box>
    </LinearGradient>
  );
}

/** Mirrors apps/web/src/app/add-program/Program.tsx. */
export function ProgramTimeline() {
  const [hoveredStage, setHoveredStage] = useState<Stage | MultiplyStage | undefined>();
  const [programCooldown, setProgramCooldown] = useAtom(programCooldownAtom);
  const setEditingStage = useSetAtom(editingSectionAtom);
  const program = useAtomValue(programAtom);

  return (
    <VStack space="sm" alignItems="flex-start">
      <Checkbox
        value="cooldown"
        isChecked={programCooldown}
        onChange={(isChecked) => setProgramCooldown(isChecked)}
      >
        <CheckboxIndicator mr="$2">
          <CheckboxIcon as={() => <MaterialIcons name="check" size={14} color="white" />} />
        </CheckboxIndicator>
        <CheckboxLabel>
          <RunnerText textTransform="none">Cooldown (4km/h, 0%)</RunnerText>
        </CheckboxLabel>
      </Checkbox>

      {program.map((section, programIndex) => (
        <VStack key={programIndex} space="sm">
          {section.times > 1 && (
            <RunnerText remSize={0.75} style={{ position: 'absolute', zIndex: 1, marginLeft: 40, marginTop: -10 }}>
              Times {section.times}x
            </RunnerText>
          )}
          <Pressable
            onPressIn={() => setHoveredStage(section)}
            onPressOut={() => setHoveredStage(undefined)}
            onPress={() => 'times' in section && setEditingStage(section)}
          >
            <VStack space="sm">
              {section.stages.map((stage, stageIndex) => (
                <Section
                  key={stageIndex}
                  section={stage}
                  hovered={hoveredStage === section}
                  manyTimes={section.times > 1}
                />
              ))}
            </VStack>
          </Pressable>
        </VStack>
      ))}
    </VStack>
  );
}
