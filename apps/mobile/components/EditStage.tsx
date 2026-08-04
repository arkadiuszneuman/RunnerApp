import { MaterialIcons } from '@expo/vector-icons';
import {
  Box,
  Button,
  ButtonText,
  HStack,
  Input,
  InputField,
  Select,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicator,
  SelectDragIndicatorWrapper,
  SelectIcon,
  SelectInput,
  SelectItem,
  SelectPortal,
  SelectTrigger,
  VStack,
} from '@gluestack-ui/themed';
import {
  Timespan,
  programAtom,
  type MultiplyStage,
  type Stage,
  type StageType,
} from '@runner/core';
import { useAtom, useSetAtom } from 'jotai';
import * as Crypto from 'expo-crypto';
import { DurationInput } from './DurationInput';
import { RunnerText } from './RunnerText';
import { editingSectionAtom } from '@/state/addProgramAtoms';

function SelectChevron() {
  return <MaterialIcons name="expand-more" size={18} color="rgba(160,189,255,0.7)" />;
}

function StageEdit({
  stage,
  onStageChanged,
}: Readonly<{ stage: Stage; onStageChanged: (stage: Stage) => void }>) {
  const onBasedOnChanged = (value: 'bmp' | 'tempo') => {
    if (value === 'bmp') {
      onStageChanged({
        ...stage,
        speedType: 'bmp',
        bmp: stage.speedType === 'bmp' ? stage.bmp : 142,
      } as Stage);
    } else {
      onStageChanged({
        ...stage,
        speedType: 'tempo',
        tempo: stage.speedType === 'tempo' ? stage.tempo : Timespan.fromMinutes(5),
      } as Stage);
    }
  };

  return (
    <VStack space="sm" borderWidth={1} borderColor="rgba(255,255,255,0.1)" borderRadius="$md" p={12}>
      <VStack space="xs">
        <RunnerText remSize={0.7} textVariant="secondary">
          Type
        </RunnerText>
        <Select
          selectedValue={stage.type}
          onValueChange={(v) => onStageChanged({ ...stage, type: v as StageType })}
        >
          <SelectTrigger variant="outline" size="sm">
            <SelectInput placeholder="Type" />
            <SelectIcon mr="$2" as={SelectChevron} />
          </SelectTrigger>
          <SelectPortal>
            <SelectBackdrop />
            <SelectContent>
              <SelectDragIndicatorWrapper>
                <SelectDragIndicator />
              </SelectDragIndicatorWrapper>
              <SelectItem label="Run" value="simple" />
              <SelectItem label="Sprint" value="sprint" />
              <SelectItem label="Regeneration" value="regeneration" />
            </SelectContent>
          </SelectPortal>
        </Select>
      </VStack>

      <VStack space="xs">
        <RunnerText remSize={0.7} textVariant="secondary">
          Segment time
        </RunnerText>
        <DurationInput
          value={stage.duration}
          fields={3}
          onChange={(duration) => onStageChanged({ ...stage, duration } as Stage)}
        />
      </VStack>

      <VStack space="xs">
        <RunnerText remSize={0.7} textVariant="secondary">
          Based on
        </RunnerText>
        <Select selectedValue={stage.speedType} onValueChange={(v) => onBasedOnChanged(v as 'bmp' | 'tempo')}>
          <SelectTrigger variant="outline" size="sm">
            <SelectInput placeholder="Based on" />
            <SelectIcon mr="$2" as={SelectChevron} />
          </SelectTrigger>
          <SelectPortal>
            <SelectBackdrop />
            <SelectContent>
              <SelectDragIndicatorWrapper>
                <SelectDragIndicator />
              </SelectDragIndicatorWrapper>
              <SelectItem label="Tempo" value="tempo" />
              <SelectItem label="Bmp" value="bmp" />
            </SelectContent>
          </SelectPortal>
        </Select>
      </VStack>

      {stage.speedType === 'bmp' && (
        <VStack space="xs">
          <RunnerText remSize={0.7} textVariant="secondary">
            BPM
          </RunnerText>
          <Input>
            <InputField
              keyboardType="number-pad"
              value={String(stage.bmp)}
              onChangeText={(text) => onStageChanged({ ...stage, bmp: Number(text) || 0 } as Stage)}
            />
          </Input>
        </VStack>
      )}

      {stage.speedType === 'tempo' && (
        <VStack space="xs">
          <RunnerText remSize={0.7} textVariant="secondary">
            Tempo min/km
          </RunnerText>
          <DurationInput
            value={stage.tempo}
            fields={2}
            onChange={(tempo) => onStageChanged({ ...stage, tempo } as Stage)}
          />
        </VStack>
      )}
    </VStack>
  );
}

function MultiplyStageEdit({
  stage,
  onChange,
}: Readonly<{ stage: MultiplyStage; onChange: (stage: MultiplyStage) => void }>) {
  return (
    <VStack space="md">
      <VStack space="xs">
        <RunnerText remSize={0.7} textVariant="secondary">
          Times
        </RunnerText>
        <Input>
          <InputField
            keyboardType="number-pad"
            value={String(stage.times)}
            onChangeText={(text) => onChange({ ...stage, times: Number(text) || 1 })}
          />
        </Input>
      </VStack>

      {stage.stages.map((s, index) => (
        <StageEdit
          key={index}
          stage={s}
          onStageChanged={(edited) =>
            onChange({ ...stage, stages: stage.stages.map((x, i) => (i === index ? edited : x)) })
          }
        />
      ))}

      <Button
        action="secondary"
        onPress={() =>
          onChange({
            ...stage,
            stages: [
              ...stage.stages,
              { type: 'simple', duration: Timespan.fromMinutes(1), speedType: 'bmp', bmp: 142 } as Stage,
            ],
          })
        }
      >
        <ButtonText>Add Stage</ButtonText>
      </Button>
    </VStack>
  );
}

export function EditStage() {
  const [editingStage, setEditingStage] = useAtom(editingSectionAtom);
  const setProgram = useSetAtom(programAtom);

  if (!editingStage) return null;

  const handleSubmit = () => {
    setProgram((prev) =>
      editingStage.id
        ? prev.map((stage) => (stage.id === editingStage.id ? editingStage : stage))
        : [...prev, { ...editingStage, id: Crypto.randomUUID() }]
    );
    setEditingStage(undefined);
  };

  const handleDelete = () => {
    if (editingStage.id) {
      setProgram((prev) => prev.filter((stage) => stage.id !== editingStage.id));
    }
    setEditingStage(undefined);
  };

  return (
    <VStack space="md">
      <MultiplyStageEdit stage={editingStage} onChange={setEditingStage} />

      <HStack space="sm">
        <Button action="secondary" variant="outline" onPress={() => setEditingStage(undefined)}>
          <ButtonText>Cancel</ButtonText>
        </Button>
        <Button action="secondary" onPress={handleSubmit}>
          <ButtonText>{editingStage.id ? 'Update' : 'Add to program'}</ButtonText>
        </Button>
        <Box flex={1} />
        <Button action="negative" onPress={handleDelete}>
          <ButtonText>Delete</ButtonText>
        </Button>
      </HStack>
    </VStack>
  );
}
