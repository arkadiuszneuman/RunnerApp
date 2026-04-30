'use client';

import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import axios from 'axios';
import { useSetAtom } from 'jotai';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Timespan } from '@/services/Timespan';
import { activeProgramIdAtom, programInternalAtom } from '../atoms';

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
    <Box sx={{ maxWidth: 600, mx: 'auto', p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Programs
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          New
        </Button>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && programs.length === 0 && (
        <Typography color="text.secondary" sx={{ mt: 2 }}>
          No programs yet. Create one to get started.
        </Typography>
      )}

      {!loading && programs.length > 0 && (
        <List disablePadding>
          {programs.map((p) => (
            <ListItem
              key={p.id}
              disablePadding
              secondaryAction={
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <IconButton size="small" onClick={() => handleEdit(p.id)} title="Edit">
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => setDeleteTarget(p)} title="Delete">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              }
              sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
            >
              <ListItemButton onClick={() => handleSelect(p.id)} sx={{ pr: 10 }}>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {p.name}
                      {p.id === activeProgramId && (
                        <Chip label="Active" size="small" color="primary" />
                      )}
                    </Box>
                  }
                  secondary={`Updated ${new Date(p.updatedAt).toLocaleDateString()}`}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      )}

      <Box sx={{ mt: 2 }}>
        <Button
          variant="contained"
          href="/"
          LinkComponent={Link}
          sx={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white', '&:hover': { backgroundColor: 'rgba(255,255,255,0.25)' } }}
        >
          Back
        </Button>
      </Box>

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
        <DialogActions>
          <Button onClick={() => { setCreateOpen(false); setNewName(''); }}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!newName.trim() || creating}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Delete program?</DialogTitle>
        <DialogContent>
          <Typography>
            Delete &ldquo;{deleteTarget?.name}&rdquo;? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
