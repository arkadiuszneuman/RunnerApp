'use client';

import { useEffect, useMemo, useState } from 'react';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DirectionsRunRoundedIcon from '@mui/icons-material/DirectionsRunRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import TerrainRoundedIcon from '@mui/icons-material/TerrainRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { EFFORT_DISTANCES, EFFORT_KEYS } from '@runner/core';
import axios from 'axios';
import { useAtomValue } from 'jotai';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { chartColors } from '@/app/charts/chartSetup';
import type { ActivityDetail } from '@/lib/activities/types';
import ChartCard from '../../base/ChartCard';
import Page from '../../base/Page';
import StatTile, { statLabelSx } from '../../base/StatTile';
import { writes } from '../../offline/requests';
import { enqueueWrite } from '../../offline/sync';
import { displayFont, enter, glass, tokens } from '../../theme';
import {
  activitiesAtom,
  activityDetailsAtom,
  cacheActivityDetail,
  removeActivityFromCache,
  runsAtom,
  runStartMs,
} from '../../userData';
import {
  effortLabel,
  formatDuration,
  formatKm,
  formatPace,
  garminConnectUrl,
  intervalsUrl,
  sportLabel,
} from '../format';
import LinkDialog from '../LinkDialog';
import { runCandidates, setLink } from '../linking';
import RouteMap from './RouteMap';
import { routePoints } from './routeSegments';
import StreamChart from './StreamChart';
import { streamSeries } from './streamSeries';

const paceLabel = (secondsPerKm: number) => {
  const s = Math.round(secondsPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export default function ActivityDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const cached = useAtomValue(activityDetailsAtom)[params.id];
  // The list entry carries link changes made since the detail was fetched.
  const listEntry = useAtomValue(activitiesAtom)?.find((a) => a.id === params.id);
  const runs = useAtomValue(runsAtom);
  const [isFetching, setIsFetching] = useState(!cached);
  const [notFound, setNotFound] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  const activity: ActivityDetail | null = cached
    ? {
        ...cached,
        ...(listEntry && { linkedRunId: listEntry.linkedRunId, linkMode: listEntry.linkMode }),
      }
    : null;

  useEffect(() => {
    setNotFound(false);
    if (cached) return;
    let cancelled = false;
    setIsFetching(true);
    axios
      .get<ActivityDetail>(`/api/activities/${params.id}`)
      .then(({ data }) => {
        if (!cancelled) cacheActivityDetail(data);
      })
      .catch((err) => {
        if (!cancelled && axios.isAxiosError(err) && err.response?.status === 404)
          setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setIsFetching(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const series = useMemo(
    () => (activity?.streams ? streamSeries(activity.streams) : null),
    [activity?.streams]
  );

  const hasRoute = useMemo(
    () => (activity?.streams ? routePoints(activity.streams).length > 1 : false),
    [activity?.streams]
  );

  const backButton = (
    <IconButton
      component={Link}
      href="/runs"
      aria-label="Back to history"
      sx={{ ...glass, width: 40, height: 40 }}
    >
      <ArrowBackRoundedIcon fontSize="small" />
    </IconButton>
  );

  if (!activity && isFetching) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (notFound || !activity) {
    return (
      <Page maxWidth={900}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1 }}>
          {backButton}
          <Typography color="text.secondary">Activity not found.</Typography>
        </Box>
      </Page>
    );
  }

  const m = activity.metrics;
  const start = new Date(activity.startTime);
  const linkedRun = activity.linkedRunId
    ? runs?.find((r) => r.id === activity.linkedRunId)
    : undefined;
  const efforts = EFFORT_KEYS.filter((key) => m.bestEfforts[key] !== undefined);
  const showElevation =
    series?.alt && activity.sport !== 'treadmill' && activity.sport !== 'indoor';

  const handleDelete = async () => {
    await enqueueWrite(writes.deleteActivity(activity.id));
    removeActivityFromCache(activity.id);
    router.push('/runs');
  };

  return (
    <Page maxWidth={900}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1, mb: 2.5 }}>
        {backButton}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="overline" component="p" sx={{ color: 'primary.main' }}>
            {start.toLocaleDateString(undefined, { weekday: 'long' })}
          </Typography>
          <Typography variant="h5" component="h1" sx={{ fontSize: '1.7rem' }}>
            {start.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          </Typography>
        </Box>
        <IconButton
          onClick={() => setDeleteOpen(true)}
          title="Remove activity"
          sx={{ color: 'text.secondary' }}
        >
          <DeleteOutlineRoundedIcon />
        </IconButton>
      </Box>

      {/* Hero summary */}
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2.5, sm: 3 },
          mb: 1.5,
          position: 'relative',
          overflow: 'hidden',
          ...enter(0),
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            top: '-80%',
            left: '-20%',
            width: '90%',
            aspectRatio: '1',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${alpha(tokens.violet, 0.16)}, transparent 65%)`,
            pointerEvents: 'none',
          }}
        />
        <Box sx={{ position: 'relative' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1 }}>
            <Chip
              label={activity.name ?? sportLabel[activity.sport]}
              size="small"
              sx={{ bgcolor: tokens.surfaceHover }}
            />
            {activity.device && <Chip label={activity.device} size="small" variant="outlined" />}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
            <Typography
              className="tabular"
              sx={{
                fontFamily: displayFont,
                fontWeight: 800,
                fontSize: 'clamp(3rem, 16vw, 4.5rem)',
                lineHeight: 0.95,
              }}
            >
              {formatKm(m.distanceM)}
            </Typography>
            <Typography sx={{ color: tokens.textMuted, fontWeight: 600, fontSize: '1.1rem' }}>
              km
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 3, mt: 1.5, flexWrap: 'wrap' }}>
            <Box>
              <Typography sx={statLabelSx}>Moving time</Typography>
              <Typography
                className="tabular"
                sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.4rem' }}
              >
                {formatDuration(m.movingS)}
              </Typography>
            </Box>
            <Box>
              <Typography sx={statLabelSx}>Avg pace</Typography>
              <Typography
                className="tabular"
                sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.4rem' }}
              >
                {formatPace(m.movingS, m.distanceM)} /km
              </Typography>
            </Box>
          </Box>
        </Box>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
          gap: 1.5,
          mb: 1.5,
        }}
      >
        <StatTile
          label="Avg / max HR"
          value={m.avgHr ? `${Math.round(m.avgHr)} / ${m.maxHr ?? '—'}` : '—'}
          sub={m.avgHr ? 'bpm' : undefined}
          icon={<FavoriteRoundedIcon />}
          accent={tokens.heart}
          index={1}
        />
        <StatTile
          label="Cadence"
          value={m.cadenceSpm ? String(Math.round(m.cadenceSpm)) : '—'}
          sub={m.cadenceSpm ? 'steps/min' : undefined}
          icon={<DirectionsRunRoundedIcon />}
          accent={tokens.cyan}
          index={2}
        />
        <StatTile
          label="Elevation"
          value={m.elevGainM !== undefined ? `${Math.round(m.elevGainM)} m` : '—'}
          sub={m.elevGainM !== undefined ? 'gain' : undefined}
          icon={<TerrainRoundedIcon />}
          accent={tokens.violet}
          index={3}
        />
        <StatTile
          label={m.trainingEffect !== undefined ? 'Training effect' : 'Calories'}
          value={
            m.trainingEffect !== undefined
              ? m.trainingEffect.toFixed(1)
              : m.calories !== undefined
                ? String(m.calories)
                : '—'
          }
          sub={
            m.trainingEffect !== undefined
              ? 'aerobic'
              : m.calories !== undefined
                ? 'kcal'
                : undefined
          }
          icon={<BoltRoundedIcon />}
          accent={tokens.amber}
          index={4}
        />
      </Box>

      {/* Link to the app run */}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          mb: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flexWrap: 'wrap',
          ...enter(5),
        }}
      >
        <LinkRoundedIcon sx={{ color: linkedRun ? tokens.volt : tokens.textFaint }} />
        <Box sx={{ flex: 1, minWidth: 180 }}>
          {linkedRun ? (
            <>
              <Typography sx={{ fontWeight: 600 }}>
                Linked to {linkedRun.programName ?? 'your app run'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {new Date(runStartMs(linkedRun)).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}{' '}
                · belt {linkedRun.summary.distanceKm.toFixed(2)} km vs watch {formatKm(m.distanceM)}{' '}
                km
              </Typography>
            </>
          ) : (
            <Typography color="text.secondary">Not linked to a RunnerApp run.</Typography>
          )}
        </Box>
        {linkedRun && (
          <Button variant="glass" component={Link} href={`/runs/${linkedRun.id}`}>
            Open run
          </Button>
        )}
        <Button variant="glass" onClick={() => setLinkOpen(true)}>
          {linkedRun ? 'Change' : 'Link run'}
        </Button>
      </Paper>

      {series && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 1.5,
            mb: 1.5,
          }}
        >
          {hasRoute && activity?.streams && (
            <ChartCard title="Route" wide height={420} index={6} deferIndex={0}>
              <RouteMap streams={activity.streams} />
            </ChartCard>
          )}
          {series.hr && (
            <ChartCard title="Heart rate" wide index={6} deferIndex={0}>
              <StreamChart points={series.hr} color={chartColors.hr} yTitle="bpm" />
            </ChartCard>
          )}
          {series.pace && (
            <ChartCard title="Pace" index={7} deferIndex={1}>
              <StreamChart
                points={series.pace}
                color={chartColors.pace}
                yTitle="min/km"
                formatY={paceLabel}
                reverse
              />
            </ChartCard>
          )}
          {series.cad && (
            <ChartCard title="Cadence" index={8} deferIndex={2}>
              <StreamChart points={series.cad} color={chartColors.cadence} yTitle="steps/min" />
            </ChartCard>
          )}
          {showElevation && series.alt && (
            <ChartCard title="Elevation" wide index={9} deferIndex={3}>
              <StreamChart points={series.alt} color={chartColors.elevation} yTitle="m" fill />
            </ChartCard>
          )}
        </Box>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 1.5,
          mb: 1.5,
        }}
      >
        {efforts.length > 0 && (
          <Paper variant="outlined" sx={{ overflow: 'hidden', ...enter(10) }}>
            <Typography
              sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: '1.15rem', p: 2, pb: 1 }}
            >
              Best efforts
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Distance</TableCell>
                  <TableCell align="right">Time</TableCell>
                  <TableCell align="right">Pace</TableCell>
                </TableRow>
              </TableHead>
              <TableBody sx={{ '& td': { fontVariantNumeric: 'tabular-nums' } }}>
                {efforts.map((key) => (
                  <TableRow key={key}>
                    <TableCell>{effortLabel[key]}</TableCell>
                    <TableCell align="right">{formatDuration(m.bestEfforts[key]!)}</TableCell>
                    <TableCell align="right">
                      {formatPace(m.bestEfforts[key]!, EFFORT_DISTANCES[key])} /km
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )}
        {m.splitsKmS && m.splitsKmS.length > 0 && (
          <Paper variant="outlined" sx={{ overflow: 'hidden', ...enter(11) }}>
            <Typography
              sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: '1.15rem', p: 2, pb: 1 }}
            >
              Splits
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Km</TableCell>
                  <TableCell align="right">Pace</TableCell>
                </TableRow>
              </TableHead>
              <TableBody sx={{ '& td': { fontVariantNumeric: 'tabular-nums' } }}>
                {m.splitsKmS.map((seconds, i) => (
                  <TableRow key={i}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell align="right">{formatPace(seconds, 1000)} /km</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )}
      </Box>

      {(activity.garminId || activity.intervalsId) && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          {activity.garminId && (
            <Button
              variant="glass"
              href={garminConnectUrl(activity.garminId)}
              target="_blank"
              rel="noopener noreferrer"
              endIcon={<OpenInNewRoundedIcon />}
            >
              Garmin Connect
            </Button>
          )}
          {activity.intervalsId && (
            <Button
              variant="glass"
              href={intervalsUrl(activity.intervalsId)}
              target="_blank"
              rel="noopener noreferrer"
              endIcon={<OpenInNewRoundedIcon />}
            >
              intervals.icu
            </Button>
          )}
        </Box>
      )}

      <LinkDialog
        open={linkOpen}
        title="Link to an app run"
        candidates={runCandidates(activity, runs ?? [])}
        emptyText="No RunnerApp run was recorded within 12 hours of this activity."
        linked={!!activity.linkedRunId}
        onSelect={(runId) => {
          setLinkOpen(false);
          void setLink(activity.id, runId);
        }}
        onUnlink={() => {
          setLinkOpen(false);
          void setLink(activity.id, null);
        }}
        onClose={() => setLinkOpen(false)}
      />

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Remove activity?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            It is only removed from RunnerApp, not from Garmin, and won&apos;t be imported again by
            sync. Uploading its file again brings it back.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="glass" onClick={() => setDeleteOpen(false)}>
            Cancel
          </Button>
          <Button variant="contained" color="error" onClick={handleDelete}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Page>
  );
}
