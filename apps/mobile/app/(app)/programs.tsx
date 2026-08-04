import { MaterialIcons } from '@expo/vector-icons';
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  Badge,
  BadgeText,
  Box,
  Button,
  ButtonIcon,
  ButtonText,
  HStack,
  Input,
  InputField,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Pressable,
  Spinner,
  VStack,
} from '@gluestack-ui/themed';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList } from 'react-native';
import {
  deleteProgram,
  getProgram,
  getUserSettings,
  listPrograms,
  createProgram,
  updateUserSettings,
  type ProgramSummary,
} from '@/api/programs';
import { RunnerText } from '@/components/RunnerText';
import { activeProgramIdAtom, programInternalAtom } from '@runner/core';
import { useSetAtom } from 'jotai';

export default function ProgramsScreen() {
  const router = useRouter();
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [activeProgramId, setActiveProgramIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const setActiveProgramIdAtom = useSetAtom(activeProgramIdAtom);
  const setProgramState = useSetAtom(programInternalAtom);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ProgramSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    Promise.all([listPrograms(), getUserSettings()])
      .then(([list, settings]) => {
        setPrograms(list ?? []);
        setActiveProgramIdState(settings?.activeProgramId ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  const setActive = async (id: string) => {
    await updateUserSettings({ activeProgramId: id });
    setActiveProgramIdState(id);
    setActiveProgramIdAtom(id);

    const program = await getProgram(id);
    if (program?.data) setProgramState(program.data);
  };

  const handleSelect = async (id: string) => {
    await setActive(id);
    router.push('/(app)');
  };

  const handleEdit = async (id: string) => {
    await setActive(id);
    router.push('/(app)/program-edit');
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const { id } = await createProgram(newName.trim());
      await setActive(id);
      setProgramState({ stages: [], cooldown: false });
      router.push('/(app)/program-edit');
    } finally {
      setCreating(false);
      setCreateOpen(false);
      setNewName('');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProgram(deleteTarget.id);
      const updated = programs.filter((p) => p.id !== deleteTarget.id);
      setPrograms(updated);
      if (activeProgramId === deleteTarget.id) {
        const next = updated[0]?.id ?? null;
        await updateUserSettings({ activeProgramId: next });
        setActiveProgramIdState(next);
        setActiveProgramIdAtom(next);
        if (next) {
          const program = await getProgram(next);
          if (program?.data) setProgramState(program.data);
        } else {
          setProgramState({ stages: [], cooldown: false });
        }
      }
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <Box flex={1} p={16}>
      <HStack justifyContent="space-between" alignItems="center" mb={16}>
        <RunnerText textTransform="none" remSize={1.25} fontWeight="600">
          Programs
        </RunnerText>
        <Button size="sm" onPress={() => setCreateOpen(true)}>
          <ButtonIcon as={() => <MaterialIcons name="add" size={16} color="white" />} mr="$1" />
          <ButtonText>New</ButtonText>
        </Button>
      </HStack>

      {loading && (
        <Box alignItems="center" mt={32}>
          <Spinner />
        </Box>
      )}

      {!loading && programs.length === 0 && (
        <RunnerText textTransform="none" textVariant="secondary" remSize={0.9}>
          No programs yet. Create one to get started.
        </RunnerText>
      )}

      {!loading && programs.length > 0 && (
        <FlatList
          data={programs}
          keyExtractor={(p) => p.id}
          ItemSeparatorComponent={() => <Box borderBottomWidth={1} borderBottomColor="rgba(255,255,255,0.1)" />}
          renderItem={({ item }) => (
            <Pressable onPress={() => handleSelect(item.id)} py={12}>
              <HStack justifyContent="space-between" alignItems="center">
                <VStack space="xs" flex={1}>
                  <HStack space="sm" alignItems="center">
                    <RunnerText textTransform="none" remSize={1}>
                      {item.name}
                    </RunnerText>
                    {item.id === activeProgramId && (
                      <Badge action="info" size="sm">
                        <BadgeText>Active</BadgeText>
                      </Badge>
                    )}
                  </HStack>
                  <RunnerText textTransform="none" textVariant="secondary" remSize={0.7}>
                    Updated {new Date(item.updatedAt).toLocaleDateString()}
                  </RunnerText>
                </VStack>
                <HStack space="sm">
                  <Pressable onPress={() => handleEdit(item.id)} p={6}>
                    <MaterialIcons name="edit" size={18} color="white" />
                  </Pressable>
                  <Pressable onPress={() => setDeleteTarget(item)} p={6}>
                    <MaterialIcons name="delete" size={18} color="white" />
                  </Pressable>
                </HStack>
              </HStack>
            </Pressable>
          )}
        />
      )}

      <Box mt={16}>
        <Button action="secondary" onPress={() => router.back()}>
          <ButtonText>Back</ButtonText>
        </Button>
      </Box>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)}>
        <ModalBackdrop />
        <ModalContent>
          <ModalHeader>
            <RunnerText textTransform="none" remSize={1.1}>
              New program
            </RunnerText>
          </ModalHeader>
          <ModalBody>
            <Input>
              <InputField placeholder="Program name" value={newName} onChangeText={setNewName} autoFocus />
            </Input>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="outline"
              action="secondary"
              mr="$2"
              onPress={() => {
                setCreateOpen(false);
                setNewName('');
              }}
            >
              <ButtonText>Cancel</ButtonText>
            </Button>
            <Button onPress={handleCreate} isDisabled={!newName.trim() || creating}>
              <ButtonText>Create</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <AlertDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <AlertDialogBackdrop />
        <AlertDialogContent>
          <AlertDialogHeader>
            <RunnerText textTransform="none" remSize={1.1}>
              Delete program?
            </RunnerText>
          </AlertDialogHeader>
          <AlertDialogBody>
            <RunnerText textTransform="none" remSize={0.9}>
              Delete &ldquo;{deleteTarget?.name}&rdquo;? This cannot be undone.
            </RunnerText>
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button variant="outline" action="secondary" mr="$2" onPress={() => setDeleteTarget(null)}>
              <ButtonText>Cancel</ButtonText>
            </Button>
            <Button action="negative" onPress={handleDelete} isDisabled={deleting}>
              <ButtonText>Delete</ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Box>
  );
}
