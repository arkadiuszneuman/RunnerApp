'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import InputBase from '@mui/material/InputBase';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import axios from 'axios';
import { useAtom, useAtomValue } from 'jotai';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import EditStage from './EditStage';
import ImportProgramDialog from './ImportProgramDialog';
import Program from './Program';
import { editingSectionAtom } from './atoms';
import { Timespan } from '@/services/Timespan';
import { activeProgramIdAtom } from '../atoms';

function ProgramNameEditor() {
  const activeProgramId = useAtomValue(activeProgramIdAtom);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!activeProgramId) return;
    axios
      .get(`/api/programs/${activeProgramId}`)
      .then(({ data }) => { if (data?.name) setName(data.name); })
      .catch(() => {});
  }, [activeProgramId]);

  const save = () => {
    if (!activeProgramId || !name.trim()) return;
    axios.put(`/api/programs/${activeProgramId}`, { name: name.trim() }).catch(() => {});
    setEditing(false);
  };

  if (!activeProgramId) return <Typography variant="h6" sx={{ color: 'text.secondary' }}>No program selected</Typography>;

  if (editing) {
    return (
      <InputBase
        inputRef={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        autoFocus
        sx={{ fontSize: '1.25rem', fontWeight: 600, borderBottom: '1px solid', borderColor: 'primary.main' }}
      />
    );
  }

  return (
    <Typography
      variant="h6"
      sx={{ fontWeight: 600, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
      onClick={() => setEditing(true)}
      title="Click to rename"
    >
      {name || 'Unnamed program'}
    </Typography>
  );
}

export default function AddProgram() {
  const [editingStage, setEditingStage] = useAtom(editingSectionAtom);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <Box sx={{ gap: 2, display: 'flex', flexDirection: 'column', margin: 2 }}>
      {editingStage && <EditStage />}
      {!editingStage && (
        <>
          <ProgramNameEditor />
          <Program />
          <Stack direction="row" spacing={1}>
            <Button variant="contained" color="secondary" href="/" LinkComponent={Link}>
              Back
            </Button>
            <Button variant="outlined" color="info" onClick={() => setImportOpen(true)}>
              Import
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
          <ImportProgramDialog open={importOpen} onClose={() => setImportOpen(false)} />
        </>
      )}
    </Box>
  );
}
