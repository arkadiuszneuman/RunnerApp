'use client';

import { ReactNode, useEffect, useState } from 'react';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DirectionsRunRoundedIcon from '@mui/icons-material/DirectionsRunRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import StraightenRoundedIcon from '@mui/icons-material/StraightenRounded';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { Timespan, type RunSummary } from '@runner/core';
import axios from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import EmptyState from '../base/EmptyState';
import Page from '../base/Page';
import ProgressRing from '../base/ProgressRing';
import { displayFont, enter, pressable, tokens } from '../theme';

type RunListItem = {
  id: string;
  createdAt: string;
  startedAt: string;
  finishedAt?: string;
  programName?: string;
  summary: RunSummary;
};

function Stat({ icon, children, color }: Readonly<{ icon: ReactNode; children: ReactNode; color?: string }>) {
  return (
    <Box
      component="span"
      className="tabular"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        fontSize: '0.85rem',
        color: tokens.textMuted,
        '& svg': { fontSize: 15, color: color ?? tokens.textFaint },
      }}
    >
      {icon}
      {children}
    </Box>
  );
}

function DateBadge({ date }: Readonly<{ date: Date }>) {
  return (
    <Box
      sx={{
        width: 52,
        height: 56,
        flexShrink: 0,
        borderRadius: '14px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: tokens.surfaceHover,
        border: `1px solid ${tokens.border}`,
      }}
    >
      <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em', color: tokens.volt, textTransform: 'uppercase' }}>
        {date.toLocaleDateString(undefined, { month: 'short' })}
      </Typography>
      <Typography sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.6rem', lineHeight: 1 }}>
        {date.getDate()}
      </Typography>
    </Box>
  );
}

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
    <Page
      eyebrow={loading ? 'Your training' : `${runs.length} ${runs.length === 1 ? 'run' : 'runs'}`}
      title="History"
    >
      {loading &&
        [0, 1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={84} sx={{ mb: 1.25, borderRadius: '20px' }} />
        ))}

      {!loading && runs.length === 0 && (
        <EmptyState
          icon={<DirectionsRunRoundedIcon />}
          title="No runs yet"
          text="Runs are saved automatically once you start running."
          action={
            <Button variant="contained" href="/" LinkComponent={Link}>
              Start a run
            </Button>
          }
        />
      )}

      {!loading &&
        runs.map((run, i) => {
          const noData = run.summary.durationSeconds === 0;
          const date = new Date(run.startedAt);
          return (
            <Paper
              key={run.id}
              variant="outlined"
              onClick={() => router.push(`/runs/${run.id}`)}
              sx={{
                mb: 1.25,
                p: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                ...pressable,
                ...enter(i),
                opacity: noData ? 0.6 : 1,
              }}
            >
              <DateBadge date={date} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600 }} noWrap>
                  {run.programName ?? date.toLocaleDateString(undefined, { weekday: 'long' })}
                </Typography>
                <Typography variant="caption" color="text.secondary" component="p" noWrap>
                  {date.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                </Typography>
                {noData ? (
                  <Typography variant="caption" color="text.secondary">
                    No data recorded
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 1.5, mt: 0.25 }}>
                    <Stat icon={<TimerOutlinedIcon />}>
                      {Timespan.fromSeconds(run.summary.durationSeconds).toString(
                        run.summary.durationSeconds < 3600 ? 'mm:ss' : 'hh:mm:ss'
                      )}
                    </Stat>
                    <Stat icon={<StraightenRoundedIcon />} color={tokens.cyan}>
                      {run.summary.distanceKm.toFixed(2)} km
                    </Stat>
                    {run.summary.avgHr > 0 && (
                      <Stat icon={<FavoriteRoundedIcon />} color={tokens.heart}>
                        {Math.round(run.summary.avgHr)} bpm
                      </Stat>
                    )}
                  </Box>
                )}
              </Box>
              {!noData && run.summary.hrTarget && (
                <ProgressRing value={run.summary.hrTarget.pctInTarget} size={46}>
                  <Typography className="tabular" sx={{ fontSize: '0.7rem', fontWeight: 700 }}>
                    {Math.round(run.summary.hrTarget.pctInTarget)}%
                  </Typography>
                </ProgressRing>
              )}
              <IconButton
                size="small"
                title="Delete"
                sx={{ color: 'text.secondary' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(run);
                }}
              >
                <DeleteOutlineRoundedIcon fontSize="small" />
              </IconButton>
            </Paper>
          );
        })}

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Delete run?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            Delete the run from{' '}
            {deleteTarget && new Date(deleteTarget.startedAt).toLocaleString()}? This cannot be undone.
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
