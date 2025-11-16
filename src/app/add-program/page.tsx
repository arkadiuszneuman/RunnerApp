'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useAtom } from 'jotai';
import Link from 'next/link';
import EditStage from './EditStage';
import Program from './Program';
import { editingSectionAtom } from './atoms';
import { Timespan } from '@/services/Timespan';

export default function AddProgram() {
  const [editingStage, setEditingStage] = useAtom(editingSectionAtom);

  return (
    <Box sx={{ gap: 2, display: 'flex', flexDirection: 'column', margin: 2 }}>
      {editingStage && <EditStage />}
      {!editingStage && (
        <>
          <Program />
          <Stack direction="row" spacing={1}>
            <Button variant="contained" color="secondary" href="/" LinkComponent={Link}>
              Back
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={() =>
                setEditingStage({
                  times: 1,
                  stages: [
                    {
                      duration: Timespan.fromMinutes(10),
                      bmp: 142,
                      speedType: 'bmp',
                      type: 'simple',
                    },
                  ],
                })
              }
            >
              Add Stage
            </Button>
          </Stack>
        </>
      )}
    </Box>
  );
}
