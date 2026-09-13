'use client';

import { useEffect, useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import ViewAgendaRoundedIcon from '@mui/icons-material/ViewAgendaRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { Timespan } from '@runner/core';
import axios from 'axios';
import { useSetAtom } from 'jotai';
import { useRouter } from 'next/navigation';
import { activeProgramIdAtom, programInternalAtom } from '../atoms';
import EmptyState from '../base/EmptyState';
import Page from '../base/Page';
import PulseDot from '../base/PulseDot';
import { displayFont, enter, pressable, tokens } from '../theme';

type ProgramSummary = { id: string; name: string; updatedAt: string };

export default function ProgramsPage() {
  const router = useRouter();
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [activeProgramId, setActiveProgramIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const setActiveProgramIdAtom = useSetAtom(activeProgramIdAtom);
  const setProgramState = useSetAtom(programInternalAtom);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<ProgramSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    Promise.all([
      axios.get('/api/programs').then(({ data }) => data),
      axios.get('/api/user-settings').then(({ data }) => data),
    ])
      .then(([list, settings]) => {
        setPrograms(list ?? []);
        setActiveProgramIdState(settings?.activeProgramId ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  const setActive = async (id: string) => {
    await axios.put('/api/user-settings', { activeProgramId: id });
    setActiveProgramIdState(id);
    setActiveProgramIdAtom(id);

    // Load the program into the atom
    const { data: text } = await axios.get(`/api/programs/${id}`, {
      transformResponse: [(d) => d],
    });
    const program = JSON.parse(text, Timespan.reviver);
    if (program?.data) setProgramState(program.data);
  };

  const handleSelect = async (id: string) => {
    await setActive(id);
    router.push('/');
  };

  const handleEdit = async (id: string) => {
    await setActive(id);
    router.push('/add-program');
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const { data } = await axios.post('/api/programs', { name: newName.trim() });
      await setActive(data.id);
      // Reset program data for new empty program
      setProgramState({ stages: [], cooldown: false });
      router.push('/add-program');
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
      await axios.delete(`/api/programs/${deleteTarget.id}`);
      const updated = programs.filter((p) => p.id !== deleteTarget.id);
      setPrograms(updated);
      if (activeProgramId === deleteTarget.id) {
        const next = updated[0]?.id ?? null;
        await axios.put('/api/user-settings', { activeProgramId: next });
        setActiveProgramIdState(next);
        setActiveProgramIdAtom(next);
        if (next) {
          const { data: text } = await axios.get(`/api/programs/${next}`, {
            transformResponse: [(d) => d],
          });
          const program = JSON.parse(text, Timespan.reviver);
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
    <Page
      eyebrow={loading ? 'Library' : `${programs.length} saved`}
      title="Programs"
      action={
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setCreateOpen(true)}>
          New
        </Button>
      }
    >
      {loading &&
        [0, 1, 2].map((i) => (
          <Skeleton key={i} variant="rounded" height={76} sx={{ mb: 1.25, borderRadius: '20px' }} />
        ))}

      {!loading && programs.length === 0 && (
        <EmptyState
          icon={<ViewAgendaRoundedIcon />}
          title="No programs yet"
          text="Create a program to plan your intervals, heart-rate targets and tempo runs."
          action={
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setCreateOpen(true)}>
              Create program
            </Button>
          }
        />
      )}

      {!loading &&
        programs.map((p, i) => {
          const active = p.id === activeProgramId;
          return (
            <Paper
              key={p.id}
              variant="outlined"
              onClick={() => handleSelect(p.id)}
              sx={{
                mb: 1.25,
                p: 1.5,
                pl: 1.75,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                ...pressable,
                ...enter(i),
                ...(active && {
                  borderColor: alpha(tokens.volt, 0.45),
                  background: `linear-gradient(135deg, ${alpha(tokens.volt, 0.1)}, ${alpha(tokens.cyan, 0.03)})`,
                  boxShadow: `0 12px 40px -20px ${alpha(tokens.volt, 0.7)}`,
                }),
              }}
            >
              <Box
                sx={{
                  width: 46,
                  height: 46,
                  flexShrink: 0,
                  borderRadius: '14px',
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: displayFont,
                  fontWeight: 700,
                  fontSize: '1.4rem',
                  color: active ? '#0b1200' : tokens.text,
                  background: active
                    ? `linear-gradient(135deg, ${tokens.volt}, ${tokens.cyan})`
                    : tokens.surfaceHover,
                }}
              >
                {p.name.charAt(0).toUpperCase()}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600 }} noWrap>
                  {p.name}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {active && (
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.75,
                        color: tokens.volt,
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                      }}
                    >
                      <PulseDot size={6} />
                      Active
                    </Box>
                  )}
                  <Typography variant="caption" color="text.secondary" noWrap>
                    Updated {new Date(p.updatedAt).toLocaleDateString()}
                  </Typography>
                </Box>
              </Box>
              <IconButton
                size="small"
                title="Edit"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(p.id);
                }}
              >
                <EditRoundedIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                title="Delete"
                sx={{ color: 'text.secondary' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(p);
                }}
              >
                <DeleteOutlineRoundedIcon fontSize="small" />
              </IconButton>
            </Paper>
          );
        })}

      {/* Create dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>New program</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Program name"
            fullWidth
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="glass" onClick={() => { setCreateOpen(false); setNewName(''); }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleCreate} disabled={!newName.trim() || creating}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Delete program?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            Delete &ldquo;{deleteTarget?.name}&rdquo;? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="glass" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Page>
  );
}
