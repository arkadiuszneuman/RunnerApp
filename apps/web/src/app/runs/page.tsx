'use client';

import DeleteIcon from '@mui/icons-material/Delete';
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
import Typography from '@mui/material/Typography';
import axios from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Timespan, type RunSummary } from '@runner/core';

type RunListItem = {
  id: string;
  createdAt: string;
  startedAt: string;
  finishedAt?: string;
  programName?: string;
  summary: RunSummary;
};

export default function RunsPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<RunListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    axios
      .get('/api/runs', { transformResponse: [(data) => data] })
      .then(({ data }) => setRuns(JSON.parse(data, Timespan.reviver) ?? []))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/runs/${deleteTarget.id}`);
      setRuns((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', p: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
        Run history
      </Typography>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && runs.length === 0 && (
        <Typography color="text.secondary" sx={{ mt: 2 }}>
          No runs recorded yet — they&apos;re saved automatically once you start running.
        </Typography>
      )}

      {!loading && runs.length > 0 && (
        <List disablePadding>
          {runs.map((run) => {
            const noData = run.summary.durationSeconds === 0;
            return (
              <ListItem
                key={run.id}
                disablePadding
                secondaryAction={
                  <IconButton size="small" onClick={() => setDeleteTarget(run)} title="Delete">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                }
                sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
              >
                <ListItemButton
                  onClick={() => router.push(`/runs/${run.id}`)}
                  sx={{ pr: 6, opacity: noData ? 0.6 : 1 }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        {new Date(run.startedAt).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                        {run.programName && <Chip label={run.programName} size="small" />}
                      </Box>
                    }
                    secondary={
                      noData
                        ? 'No data recorded'
                        : [
                            Timespan.fromSeconds(run.summary.durationSeconds).toString(
                              run.summary.durationSeconds < 3600 ? 'mm:ss' : 'hh:mm:ss'
                            ),
                            `${run.summary.distanceKm.toFixed(2)} km`,
                            run.summary.avgHr > 0 ? `${Math.round(run.summary.avgHr)} bpm avg` : null,
                            run.summary.hrTarget
                              ? `${Math.round(run.summary.hrTarget.pctInTarget)}% in target`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')
                    }
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      )}

      <Box sx={{ mt: 2 }}>
        <Button
          variant="contained"
          href="/"
          LinkComponent={Link}
          sx={{
            backgroundColor: 'rgba(255,255,255,0.15)',
            color: 'white',
            '&:hover': { backgroundColor: 'rgba(255,255,255,0.25)' },
          }}
        >
          Back
        </Button>
      </Box>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Delete run?</DialogTitle>
        <DialogContent>
          <Typography>
            Delete the run from{' '}
            {deleteTarget && new Date(deleteTarget.startedAt).toLocaleString()}? This cannot be undone.
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
