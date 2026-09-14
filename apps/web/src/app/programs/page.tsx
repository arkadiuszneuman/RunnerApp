'use client';

import { useState } from 'react';
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
import Snackbar from '@mui/material/Snackbar';
import { useAtom, useAtomValue } from 'jotai';
import { useRouter } from 'next/navigation';
import { activeProgramIdAtom } from '../atoms';
import EmptyState from '../base/EmptyState';
import Page from '../base/Page';
import PulseDot from '../base/PulseDot';
import type { ProgramData } from '../offline/overlay';
import { writes } from '../offline/requests';
import { enqueueWrite } from '../offline/sync';
import { displayFont, ENTER_DURATION_MS, enter, enterDelayMs, pressable, tokens } from '../theme';
import {
  cacheProgramData,
  getCachedProgramData,
  loadProgramData,
  programsAtom,
  removeProgramFromCache,
  setProgramFromServer,
  upsertProgram,
  type ProgramSummary,
} from '../userData';

const EMPTY_PROGRAM: ProgramData = { stages: [], cooldown: false };

export default function ProgramsPage() {
  const router = useRouter();
  const programsData = useAtomValue(programsAtom);
  const loading = programsData === undefined;
  const programs = programsData ?? [];
  const [activeProgramId, setActiveProgramId] = useAtom(activeProgramIdAtom);
  const [notice, setNotice] = useState('');

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<ProgramSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  /**
   * Loads the program's data *before* switching to it: if it can't be loaded
   * (offline, never cached) the editor must not end up showing the previous
   * program's stages under the new id, where the next edit would save them
   * over it. Writes go through the offline queue.
   *
   * `getCachedProgramData` (warmed for every program once /programs loads —
   * see refreshPrograms in userData.ts) lets this skip the await entirely
   * for a program that's already been fetched this session: still the exact
   * same data loadProgramData would resolve to, just already in hand, so the
   * guarantee above still holds — there's no window where the previous
   * program's stages could show under the new id.
   */
  const setActive = async (id: string, knownData?: ProgramData) => {
    const cached = knownData ?? getCachedProgramData(id);
    const data = cached ?? (await loadProgramData(id));
    if (knownData) cacheProgramData(id, knownData);
    void enqueueWrite(writes.setActiveProgram(id));
    setActiveProgramId(id);
    if (data) setProgramFromServer(data);
  };

  const trySetActive = async (id: string): Promise<boolean> => {
    try {
      await setActive(id);
      return true;
    } catch {
      setNotice("This program isn't available offline yet — connect once to load it.");
      return false;
    }
  };

  const handleSelect = async (id: string) => {
    if (await trySetActive(id)) router.push('/');
  };

  const handleEdit = async (id: string) => {
    if (await trySetActive(id)) router.push('/add-program');
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const id = crypto.randomUUID();
      void enqueueWrite(writes.createProgram(id, name));
      // So /add-program's name editor (which reads from this same cache) has
      // a name to show immediately, instead of momentarily "Unnamed program".
      upsertProgram({ id, name, updatedAt: new Date().toISOString() });
      await setActive(id, EMPTY_PROGRAM);
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
      void enqueueWrite(writes.deleteProgram(deleteTarget.id));
      removeProgramFromCache(deleteTarget.id);
      if (activeProgramId === deleteTarget.id) {
        const next = programs.filter((p) => p.id !== deleteTarget.id)[0]?.id ?? null;
        const nextData = next ? await loadProgramData(next).catch(() => undefined) : undefined;
        if (next && nextData !== undefined) {
          await setActive(next, nextData ?? EMPTY_PROGRAM);
        } else {
          // No other program, or it can't be loaded right now: fall back to none active.
          void enqueueWrite(writes.setActiveProgram(null));
          setActiveProgramId(null);
          setProgramFromServer(EMPTY_PROGRAM);
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
                position: 'relative',
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
                }),
              }}
            >
              {active && (
                // A glow as a plain boxShadow on the row itself would paint
                // OVER the row below it while that row is still fading in
                // (its opacity animation hasn't started painting yet, so
                // there's nothing there yet to occlude the shadow's
                // overflow) — then flip to being hidden behind it once that
                // row finishes appearing, i.e. it visibly jumps mid-animation.
                // Delaying the glow's own fade-in until after the next row's
                // entrance has finished means the paint order the glow ends
                // up in (behind that row) is the only one it's ever seen in.
                <Box
                  aria-hidden
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 'inherit',
                    boxShadow: `0 12px 40px -20px ${alpha(tokens.volt, 0.7)}`,
                    pointerEvents: 'none',
                    zIndex: -1,
                    // Base state is the settled end state (opacity 1) — the
                    // `backwards`-filled animation below only overrides this
                    // during its delay, holding the glow invisible until
                    // then; without `forwards`, the animation's own effect
                    // stops once it completes, and *this* value is what's
                    // left showing afterwards.
                    opacity: 1,
                    animation: `fade-in 300ms ease ${enterDelayMs(i + 1) + ENTER_DURATION_MS}ms backwards`,
                  }}
                />
              )}
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

      <Snackbar
        open={!!notice}
        message={notice}
        autoHideDuration={5000}
        onClose={() => setNotice('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      />

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
