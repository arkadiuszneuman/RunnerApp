'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import { useAtomValue } from 'jotai';
import { isRunningAtom, programInternalAtom, temporaryProgramAtom } from '../atoms';
import { discardTemporaryProgram, saveAsProgram } from './temporaryProgram';

/** Save / Discard for the watch workout shown in place of the active program on the home screen. */
export default function TemporaryProgramActions() {
  const temporary = useAtomValue(temporaryProgramAtom);
  const program = useAtomValue(programInternalAtom);
  const running = useAtomValue(isRunningAtom);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  if (!temporary) return null;

  async function handleSave() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await saveAsProgram(name.trim(), program);
      setSaveOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
        <Button
          size="small"
          variant="glass"
          disabled={running}
          onClick={() => {
            setName(temporary.name);
            setSaveOpen(true);
          }}
        >
          Save to programs
        </Button>
        <Button size="small" color="secondary" disabled={running} onClick={discardTemporaryProgram}>
          Discard
        </Button>
      </Box>

      <Dialog open={saveOpen} onClose={() => setSaveOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Save to programs</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Program name"
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="glass" onClick={() => setSaveOpen(false)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={!name.trim() || busy}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
