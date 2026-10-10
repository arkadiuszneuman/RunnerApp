'use client';

import { useEffect, useState } from 'react';
import WatchRoundedIcon from '@mui/icons-material/WatchRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { useAtomValue } from 'jotai';
import Link from 'next/link';
import { formatKm, sportLabel } from '../../activities/format';
import LinkDialog from '../../activities/LinkDialog';
import { activityCandidates, setLink } from '../../activities/linking';
import { statLabelSx } from '../../base/StatTile';
import {
  intervalsStatusAtom,
  intervalsSyncAtom,
  loadIntervalsStatus,
  runIntervalsSync,
} from '../../integrations/intervalsSync';
import { displayFont, enter, tokens } from '../../theme';
import { activitiesAtom, runsAtom } from '../../userData';

function Figure({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <Box>
      <Typography sx={statLabelSx}>{label}</Typography>
      <Typography
        className="tabular"
        sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.2rem' }}
      >
        {value}
      </Typography>
    </Box>
  );
}

/**
 * The watch activity recorded alongside this run (linked automatically by time overlap, or by
 * hand), compared with what the treadmill measured. Hidden for accounts that never imported any
 * watch activity, so it doesn't nag people without a watch.
 */
export default function WatchCard({
  runId,
  beltKm,
  index,
}: Readonly<{ runId: string; beltKm: number; index: number }>) {
  const activities = useAtomValue(activitiesAtom);
  const run = useAtomValue(runsAtom)?.find((r) => r.id === runId);
  const intervals = useAtomValue(intervalsStatusAtom);
  const sync = useAtomValue(intervalsSyncAtom);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (intervals === undefined) void loadIntervalsStatus();
  }, [intervals]);

  const connected = intervals?.connected === true;
  // Without imported activities or a connection there's nothing to show or do here.
  if (!run || ((!activities || activities.length === 0) && !connected)) return null;

  const activity = activities?.find((a) => a.linkedRunId === runId);
  const m = activity?.metrics;
  const diffPct = m && beltKm > 0 ? ((m.distanceM / 1000 - beltKm) / beltKm) * 100 : undefined;

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 1.5, ...enter(index) }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
        <WatchRoundedIcon sx={{ color: activity ? tokens.volt : tokens.textFaint }} />
        <Box sx={{ flex: 1, minWidth: 160 }}>
          <Typography sx={{ fontWeight: 600 }}>
            {activity ? (activity.device ?? 'Watch activity') : 'No watch activity linked'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {activity
              ? `${activity.name ?? sportLabel[activity.sport]} · ${activity.linkMode === 'manual' ? 'linked by you' : 'matched by time'}`
              : connected
                ? 'Sync to fetch it from intervals.icu, or link one recorded around the same time.'
                : 'Import it from Garmin in Settings, or link one recorded around the same time.'}
          </Typography>
        </Box>
        {activity && (
          <Button variant="glass" component={Link} href={`/activities/${activity.id}`}>
            Open
          </Button>
        )}
        {!activity && connected && (
          <Button
            variant="glass"
            disabled={sync.running}
            onClick={() => void runIntervalsSync()}
            startIcon={sync.running ? <CircularProgress size={14} color="inherit" /> : undefined}
          >
            Sync
          </Button>
        )}
        <Button variant="glass" onClick={() => setOpen(true)}>
          {activity ? 'Change' : 'Link'}
        </Button>
      </Box>
      {m && (
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mt: 1.5 }}>
          <Figure
            label="Watch distance"
            value={`${formatKm(m.distanceM)} km${diffPct !== undefined ? ` (${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(1)}%)` : ''}`}
          />
          {m.avgHr !== undefined && (
            <Figure label="Watch HR" value={`${Math.round(m.avgHr)} / ${m.maxHr ?? '—'}`} />
          )}
          {m.cadenceSpm !== undefined && (
            <Figure label="Cadence" value={`${Math.round(m.cadenceSpm)} spm`} />
          )}
          {m.calories !== undefined && <Figure label="Calories" value={`${m.calories} kcal`} />}
          {m.trainingEffect !== undefined && (
            <Figure label="Training effect" value={m.trainingEffect.toFixed(1)} />
          )}
        </Box>
      )}
      <LinkDialog
        open={open}
        title="Link a watch activity"
        candidates={activityCandidates(run, activities ?? [])}
        emptyText="No watch activity was recorded within 12 hours of this run."
        linked={!!activity}
        onSelect={(activityId) => {
          setOpen(false);
          void setLink(activityId, runId);
        }}
        onUnlink={() => {
          setOpen(false);
          if (activity) void setLink(activity.id, null);
        }}
        onClose={() => setOpen(false)}
      />
    </Paper>
  );
}
