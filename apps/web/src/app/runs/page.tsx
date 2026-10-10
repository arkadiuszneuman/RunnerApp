'use client';

import { Fragment, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DirectionsRunRoundedIcon from '@mui/icons-material/DirectionsRunRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded';
import StraightenRoundedIcon from '@mui/icons-material/StraightenRounded';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import WatchRoundedIcon from '@mui/icons-material/WatchRounded';
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
import { useAtomValue } from 'jotai';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDuration, formatKm, sportLabel } from '../activities/format';
import EmptyState from '../base/EmptyState';
import Page from '../base/Page';
import ProgressRing from '../base/ProgressRing';
import { SpeedControllerBadge } from '../base/SpeedControllerPicker';
import { writes } from '../offline/requests';
import { enqueueWrite } from '../offline/sync';
import { displayFont, enter, MAX_STAGGER, pressable, tokens } from '../theme';
import { applyFilter } from '@runner/core';
import StatsFilterBar, { isDefaultFilter } from '../stats/StatsFilterBar';
import {
  HISTORY_DEFAULT_FILTER,
  historyFilterAtom,
  nowLocalMs,
  useStatsActivities,
  yearsOf,
} from '../stats/statsState';
import { historyAtom, removeRunFromCache, type HistoryItem } from '../userData';

function Stat({
  icon,
  children,
  color,
}: Readonly<{ icon: ReactNode; children: ReactNode; color?: string }>) {
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
      <Typography
        sx={{
          fontSize: '0.62rem',
          fontWeight: 700,
          letterSpacing: '0.12em',
          color: tokens.volt,
          textTransform: 'uppercase',
        }}
      >
        {date.toLocaleDateString(undefined, { month: 'short' })}
      </Typography>
      <Typography
        sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.6rem', lineHeight: 1 }}
      >
        {date.getDate()}
      </Typography>
    </Box>
  );
}

/** Rows rendered up front; more are added as the list is scrolled. */
const PAGE_SIZE = 40;

function monthKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

function itemKm(item: HistoryItem): number {
  return item.kind === 'run' ? item.run.summary.distanceKm : item.activity.metrics.distanceM / 1000;
}

function MonthHeader({ ms, items }: Readonly<{ ms: number; items: HistoryItem[] }>) {
  const km = items.reduce((sum, item) => sum + itemKm(item), 0);
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        mt: 2.5,
        mb: 1,
        px: 0.5,
      }}
    >
      <Typography sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.1rem' }}>
        {new Date(ms).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
      </Typography>
      <Typography variant="caption" className="tabular" color="text.secondary">
        {items.length} {items.length === 1 ? 'run' : 'runs'} · {km.toFixed(1)} km
      </Typography>
    </Box>
  );
}

function RunRow({
  item,
  index,
  onDelete,
}: Readonly<{ item: Extract<HistoryItem, { kind: 'run' }>; index: number; onDelete: () => void }>) {
  const router = useRouter();
  const { run, activity } = item;
  const noData = run.summary.durationSeconds === 0;
  const date = new Date(item.startMs);
  return (
    <Paper
      variant="outlined"
      onClick={() => router.push(`/runs/${run.id}`)}
      sx={{
        mb: 1.25,
        p: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        ...pressable,
        ...enter(Math.min(index, MAX_STAGGER)),
        opacity: noData ? 0.6 : 1,
      }}
    >
      <DateBadge date={date} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600, minWidth: 0 }} noWrap>
            {run.programName ?? date.toLocaleDateString(undefined, { weekday: 'long' })}
          </Typography>
          {run.controller && <SpeedControllerBadge kind={run.controller} />}
          {activity && (
            <WatchRoundedIcon
              titleAccess="Linked to a watch activity"
              sx={{ fontSize: 16, color: tokens.volt, flexShrink: 0 }}
            />
          )}
        </Box>
        <Typography variant="caption" color="text.secondary" component="p" noWrap>
          {date.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
        </Typography>
        {noData ? (
          <Typography variant="caption" color="text.secondary">
            No data recorded
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 1.5, mt: 0.25 }}>
            <Stat icon={<TimerOutlinedIcon />}>{formatDuration(run.summary.durationSeconds)}</Stat>
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
          onDelete();
        }}
      >
        <DeleteOutlineRoundedIcon fontSize="small" />
      </IconButton>
    </Paper>
  );
}

function ActivityRow({
  item,
  index,
}: Readonly<{ item: Extract<HistoryItem, { kind: 'activity' }>; index: number }>) {
  const router = useRouter();
  const { activity } = item;
  const m = activity.metrics;
  const date = new Date(item.startMs);
  return (
    <Paper
      variant="outlined"
      onClick={() => router.push(`/activities/${activity.id}`)}
      sx={{
        mb: 1.25,
        p: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        ...pressable,
        ...enter(Math.min(index, MAX_STAGGER)),
      }}
    >
      <DateBadge date={date} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600, minWidth: 0 }} noWrap>
            {activity.name ?? sportLabel[activity.sport]}
          </Typography>
          <WatchRoundedIcon
            titleAccess="Recorded on the watch"
            sx={{ fontSize: 16, color: tokens.violet, flexShrink: 0 }}
          />
        </Box>
        <Typography variant="caption" color="text.secondary" component="p" noWrap>
          {date.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
          {activity.device && ` · ${activity.device}`}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 1.5, mt: 0.25 }}>
          <Stat icon={<TimerOutlinedIcon />}>{formatDuration(m.movingS)}</Stat>
          <Stat icon={<StraightenRoundedIcon />} color={tokens.cyan}>
            {formatKm(m.distanceM)} km
          </Stat>
          {m.avgHr !== undefined && (
            <Stat icon={<FavoriteRoundedIcon />} color={tokens.heart}>
              {Math.round(m.avgHr)} bpm
            </Stat>
          )}
        </Box>
      </Box>
    </Paper>
  );
}

export default function RunsPage() {
  const history = useAtomValue(historyAtom);
  const filter = useAtomValue(historyFilterAtom);
  const statsActivities = useStatsActivities(true);
  const loading = history === undefined;
  const filtered = !isDefaultFilter(filter, HISTORY_DEFAULT_FILTER);
  const [showFilters, setShowFilters] = useState(filtered);
  // Matched through the same merged view of runs as Stats (see statsState.ts), so a linked pair
  // is filtered as one run.
  const items = useMemo(() => {
    if (!history || !statsActivities || !filtered) return history ?? [];
    const keys = new Set(applyFilter(statsActivities, filter, nowLocalMs()).map((a) => a.key));
    return history.filter((item) =>
      keys.has(item.kind === 'run' ? `run:${item.id}` : `watch:${item.id}`)
    );
  }, [history, statsActivities, filter, filtered]);
  const [shown, setShown] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<Extract<HistoryItem, { kind: 'run' }> | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setShown((n) => n + PAGE_SIZE);
      },
      { rootMargin: '600px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
    // Re-observing after each page fires again if the sentinel is still in view.
  }, [loading, shown]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await enqueueWrite(writes.deleteRun(deleteTarget.id));
      removeRunFromCache(deleteTarget.id);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const visible = items.slice(0, shown);
  const monthItems = new Map<string, HistoryItem[]>();
  for (const item of items) {
    const key = monthKey(item.startMs);
    monthItems.set(key, [...(monthItems.get(key) ?? []), item]);
  }

  return (
    <Page
      eyebrow={loading ? 'Your training' : `${items.length} ${items.length === 1 ? 'run' : 'runs'}`}
      title="History"
      action={
        <IconButton
          title="Filter runs"
          onClick={() => setShowFilters((v) => !v)}
          sx={{ color: filtered ? 'primary.main' : 'text.secondary' }}
        >
          <FilterListRoundedIcon />
        </IconButton>
      }
    >
      {showFilters && (
        <StatsFilterBar
          atom={historyFilterAtom}
          defaults={HISTORY_DEFAULT_FILTER}
          years={yearsOf(statsActivities)}
        />
      )}
      {loading &&
        [0, 1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={84} sx={{ mb: 1.25, borderRadius: '20px' }} />
        ))}

      {!loading && items.length === 0 && filtered && (
        <Typography color="text.secondary" sx={{ mt: 2 }}>
          No runs match these filters.
        </Typography>
      )}

      {!loading && items.length === 0 && !filtered && (
        <EmptyState
          icon={<DirectionsRunRoundedIcon />}
          title="No runs yet"
          text="Runs are saved automatically once you start running. Runs from your Garmin watch can be imported in Settings."
          action={
            <Button variant="contained" href="/" LinkComponent={Link}>
              Start a run
            </Button>
          }
        />
      )}

      {visible.map((item, i) => {
        const key = monthKey(item.startMs);
        const firstOfMonth = i === 0 || monthKey(visible[i - 1].startMs) !== key;
        return (
          <Fragment key={item.id}>
            {firstOfMonth && <MonthHeader ms={item.startMs} items={monthItems.get(key) ?? []} />}
            {item.kind === 'run' ? (
              <RunRow item={item} index={i} onDelete={() => setDeleteTarget(item)} />
            ) : (
              <ActivityRow item={item} index={i} />
            )}
          </Fragment>
        );
      })}
      {shown < items.length && <Box ref={sentinelRef} sx={{ height: 1 }} />}

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Delete run?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            Delete the run from {deleteTarget && new Date(deleteTarget.startMs).toLocaleString()}?
            This cannot be undone.
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
