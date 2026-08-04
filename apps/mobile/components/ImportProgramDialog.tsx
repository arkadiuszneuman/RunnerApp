import {
  Button,
  ButtonText,
  Input,
  InputField,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  VStack,
} from '@gluestack-ui/themed';
import { parseProgram, programAtom } from '@runner/core';
import { useSetAtom } from 'jotai';
import { useState } from 'react';
import { RunnerText } from './RunnerText';

export function ImportProgramDialog({ isOpen, onClose }: Readonly<{ isOpen: boolean; onClose: () => void }>) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | undefined>();
  const setProgram = useSetAtom(programAtom);

  const handleConfirm = () => {
    try {
      setProgram(parseProgram(text));
      setText('');
      setError(undefined);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid format');
    }
  };

  const handleClose = () => {
    setText('');
    setError(undefined);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <ModalBackdrop />
      <ModalContent>
        <ModalHeader>
          <RunnerText textTransform="none" remSize={1.1}>
            Import program from text
          </RunnerText>
        </ModalHeader>
        <ModalBody>
          <VStack space="sm">
            <Input>
              <InputField
                placeholder="e.g. 4x4:00@184"
                value={text}
                onChangeText={(t) => {
                  setText(t);
                  setError(undefined);
                }}
                autoFocus
              />
            </Input>
            {error ? (
              <RunnerText textTransform="none" remSize={0.8} style={{ color: '#ff6b6b' }}>
                {error}
              </RunnerText>
            ) : null}
            <RunnerText textVariant="secondary" textTransform="none" remSize={0.75}>
              Format: NxMM:SS@BPM — e.g. 4x4:00@184 means 4 intervals of 4 min at 184 BPM,
              surrounded by 10 min warmup and cooldown.
            </RunnerText>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" action="secondary" onPress={handleClose} mr="$2">
            <ButtonText>Cancel</ButtonText>
          </Button>
          <Button onPress={handleConfirm} isDisabled={!text.trim()}>
            <ButtonText>Import</ButtonText>
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
