'use client';

import { useEffect, useRef, useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ContentPasteRoundedIcon from '@mui/icons-material/ContentPasteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import Typography from '@mui/material/Typography';
import { Timespan } from '@runner/core';
import { useAtom, useAtomValue } from 'jotai';
import Link from 'next/link';
import { activeProgramIdAtom } from '../atoms';
import ActionBar from '../base/ActionBar';
import Page from '../base/Page';
import { writes } from '../offline/requests';
import { enqueueWrite } from '../offline/sync';
import { displayFont, glass, tokens } from '../theme';
import { activeProgramNameAtom, upsertProgram } from '../userData';
import EditStage from './EditStage';
import ImportProgramDialog from './ImportProgramDialog';
import Program from './Program';
import { editingSectionAtom } from './atoms';

const titleSx = { fontFamily: displayFont, fontWeight: 700, fontSize: '2rem', lineHeight: 1.1 } as const;

function ProgramNameEditor() {
  const activeProgramId = useAtomValue(activeProgramIdAtom);
  // Sourced from the same programs-list cache as /programs, rather than its
  // own fetch, so a program created moments ago (or renamed elsewhere) shows
  // up here without a round trip.
  const cachedName = useAtomValue(activeProgramNameAtom);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Syncing from the cache (an external source, populated asynchronously)
    // rather than deriving during render: the whole point is to pick up a
    // cachedName that arrives *after* this component has already mounted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cachedName) setName(cachedName);
  }, [cachedName]);

  const save = () => {
    if (!activeProgramId || !name.trim()) return;
    const trimmed = name.trim();
    void enqueueWrite(writes.updateProgram(activeProgramId, { name: trimmed }));
    upsertProgram({ id: activeProgramId, name: trimmed, updatedAt: new Date().toISOString() });
    setEditing(false);
  };

  if (!activeProgramId) return <Typography sx={{ ...titleSx, color: 'text.secondary' }}>No program selected</Typography>;

  if (editing) {
    return (
      <InputBase
        inputRef={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        autoFocus
        fullWidth
        sx={{ ...titleSx, borderBottom: '2px solid', borderColor: 'primary.main' }}
      />
    );
  }

  return (
    <Box
      component="button"
      type="button"
      onClick={() => setEditing(true)}
      title="Click to rename"
      sx={{
        all: 'unset',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        maxWidth: '100%',
        '& .edit-hint': { opacity: 0.4, transition: 'opacity 200ms ease' },
        '&:hover .edit-hint, &:focus-visible .edit-hint': { opacity: 1 },
      }}
    >
      <Typography component="h1" sx={titleSx} noWrap>
        {name || 'Unnamed program'}
      </Typography>
      <EditRoundedIcon className="edit-hint" sx={{ fontSize: 20, color: tokens.textMuted }} />
    </Box>
  );
}

export default function AddProgram() {
  const [editingStage, setEditingStage] = useAtom(editingSectionAtom);
  const [importOpen, setImportOpen] = useState(false);

  if (editingStage) return <EditStage />;

  return (
    <Page>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1, mb: 2.5 }}>
        <IconButton component={Link} href="/programs" aria-label="Back" sx={{ ...glass, width: 40, height: 40 }}>
          <ArrowBackRoundedIcon fontSize="small" />
        </IconButton>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="overline" component="p" sx={{ color: 'primary.main' }}>
            Program builder
          </Typography>
          <ProgramNameEditor />
        </Box>
      </Box>

      <Program />

      <ActionBar>
        <Button
          size="large"
          variant="glass"
          startIcon={<ContentPasteRoundedIcon />}
          onClick={() => setImportOpen(true)}
        >
          Import
        </Button>
        <Button
          fullWidth
          size="large"
          variant="contained"
          startIcon={<AddRoundedIcon />}
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
          Add block
        </Button>
      </ActionBar>
      <ImportProgramDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </Page>
  );
}
