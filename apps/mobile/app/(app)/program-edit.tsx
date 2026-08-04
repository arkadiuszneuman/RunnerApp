import { Box, Button, ButtonText, HStack, Input, InputField, VStack } from '@gluestack-ui/themed';
import { Timespan, activeProgramIdAtom } from '@runner/core';
import { useRouter } from 'expo-router';
import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { getProgram, updateProgram } from '@/api/programs';
import { EditStage } from '@/components/EditStage';
import { ImportProgramDialog } from '@/components/ImportProgramDialog';
import { ProgramTimeline } from '@/components/ProgramTimeline';
import { RunnerText } from '@/components/RunnerText';
import { editingSectionAtom } from '@/state/addProgramAtoms';

function ProgramNameEditor() {
  const activeProgramId = useAtomValue(activeProgramIdAtom);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!activeProgramId) return;
    getProgram(activeProgramId)
      .then((program) => {
        if (program?.name) setName(program.name);
      })
      .catch(() => {});
  }, [activeProgramId]);

  const save = () => {
    if (!activeProgramId || !name.trim()) return;
    updateProgram(activeProgramId, { name: name.trim() }).catch(() => {});
    setEditing(false);
  };

  if (!activeProgramId) {
    return (
      <RunnerText textTransform="none" textVariant="secondary" remSize={1.1}>
        No program selected
      </RunnerText>
    );
  }

  if (editing) {
    return (
      <Input>
        <InputField value={name} onChangeText={setName} onBlur={save} autoFocus />
      </Input>
    );
  }

  return (
    <Button variant="link" onPress={() => setEditing(true)}>
      <ButtonText>
        <RunnerText textTransform="none" remSize={1.1} fontWeight="600">
          {name || 'Unnamed program'}
        </RunnerText>
      </ButtonText>
    </Button>
  );
}

function AddStageButton() {
  const setEditingStage = useSetAtom(editingSectionAtom);
  return (
    <Button
      action="positive"
      onPress={() =>
        setEditingStage({
          times: 1,
          stages: [{ duration: Timespan.fromMinutes(10), bmp: 142, speedType: 'bmp', type: 'simple' }],
        })
      }
    >
      <ButtonText>Add Stage</ButtonText>
    </Button>
  );
}

export default function ProgramEditScreen() {
  const router = useRouter();
  const editingStage = useAtomValue(editingSectionAtom);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Box>
        {editingStage ? (
          <EditStage />
        ) : (
          <VStack space="lg">
            <ProgramNameEditor />
            <ProgramTimeline />
            <HStack space="sm">
              <Button action="secondary" onPress={() => router.back()}>
                <ButtonText>Back</ButtonText>
              </Button>
              <Button variant="outline" action="secondary" onPress={() => setImportOpen(true)}>
                <ButtonText>Import</ButtonText>
              </Button>
              <AddStageButton />
            </HStack>
            <ImportProgramDialog isOpen={importOpen} onClose={() => setImportOpen(false)} />
          </VStack>
        )}
      </Box>
    </ScrollView>
  );
}
