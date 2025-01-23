'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useAtom, useAtomValue } from 'jotai';
import Link from 'next/link';
import { programAtom } from '../atoms';
import EditStage from './EditStage';
import Section from './Section';
import { editingSectionAtom } from './atoms';

export default function AddProgram() {
  const program = useAtomValue(programAtom);
  const [editingStage, setEditingStage] = useAtom(editingSectionAtom);

  return (
    <Box>
      {program.map((stage, index) => (
        <Section key={index} section={stage} />
      ))}
      {editingStage && <EditStage />}
      {!editingStage && (
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" href="/" LinkComponent={Link}>
            Back
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={() =>
              setEditingStage({
                times: 1,
                stages: [],
              })
            }
          >
            Add Stage
          </Button>
        </Stack>
      )}
    </Box>
  );
}
