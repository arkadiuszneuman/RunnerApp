'use client';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useSetAtom } from 'jotai';
import { useState } from 'react';
import { programAtom } from '../atoms';
import { parseProgram } from '@/services/programTextParser';

interface ImportProgramDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function ImportProgramDialog({ open, onClose }: ImportProgramDialogProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | undefined>();
  const setProgram = useSetAtom(programAtom);

  const handleConfirm = () => {
    try {
      const parsed = parseProgram(text);
      setProgram(parsed);
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
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Import program from text</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
        <TextField
          label="Program text"
          placeholder="e.g. 4x4:00@184"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(undefined);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleConfirm();
          }}
          error={!!error}
          autoFocus
          fullWidth
        />
        {error && (
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary">
          Format: <strong>NxMM:SS@BPM</strong> — e.g. <em>4x4:00@184</em> means 4 intervals of
          4 min at 184 BPM, surrounded by 10 min warmup and cooldown.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="secondary">
          Cancel
        </Button>
        <Button onClick={handleConfirm} variant="contained" color="primary" disabled={!text.trim()}>
          Import
        </Button>
      </DialogActions>
    </Dialog>
  );
}
