'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DirectionsRunRoundedIcon from '@mui/icons-material/DirectionsRunRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import SsidChartRoundedIcon from '@mui/icons-material/SsidChartRounded';
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
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { analyzeRun, calculateStages, Timespan, toSeries } from '@runner/core';
import axios from 'axios';
import { useAtomValue } from 'jotai';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Page from '../../base/Page';
import ProgressRing from '../../base/ProgressRing';
import { SpeedControllerBadge } from '../../base/SpeedControllerPicker';
import { writes } from '../../offline/requests';
import { enqueueWrite } from '../../offline/sync';
import { displayFont, enter, glass, stageTypeColor, stageTypeName, tokens } from '../../theme';
import { cacheRunDetail, removeRunFromCache, runDetailsAtom, type RunRow } from '../../userData';
import DeviationChart from './charts/DeviationChart';
import HeartRateChart from './charts/HeartRateChart';
import HrBucketsChart from './charts/HrBucketsChart';
import InclineChart from './charts/InclineChart';
import SpeedChart from './charts/SpeedChart';
import type { StageBand } from './charts/stageShadingPlugin';
import { useDeferredMount } from './charts/useDeferredMount';

const labelSx = {
  fontSize: '0.68rem',
  fontWeight: 600,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: tokens.textMuted,
} as const;

function StatTile(
  props: Readonly<{ label: string; value: string; sub?: string; icon: ReactNode; accent: string; index: number }>
) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, height: '100%', ...enter(props.index) }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5, color: props.accent, '& svg': { fontSize: 16 } }}>
        {props.icon}
        <Typography sx={labelSx}>{props.label}</Typography>
      </Box>
      <Typography className="tabular" sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.6rem', lineHeight: 1.1 }}>
        {props.value}
      </Typography>
      {props.sub && (
        <Typography variant="caption" color="text.secondary">
          {props.sub}
        </Typography>
      )}
    </Paper>
  );
}

function ChartCard({
  title,
  height = 260,
  wide,
  index,
  deferIndex = 0,
  children,
}: Readonly<{
  title: string;
  height?: number;
  wide?: boolean;
  index: number;
  /** Charts mount `deferIndex` animation frames after this card first renders — see useDeferredMount. */
  deferIndex?: number;
  children: ReactNode;
}>) {
  const ready = useDeferredMount(deferIndex);
  return (
    <Paper variant="outlined" sx={{ p: 2, gridColumn: wide ? '1 / -1' : undefined, minWidth: 0, ...enter(index) }}>
      <Typography sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: '1.15rem', mb: 1 }}>{title}</Typography>
      <Box sx={{ height }}>{ready ? children : null}</Box>
    </Paper>
  );
}

function stageTargetLabel(stage: {
  speedType?: 'bmp' | 'tempo';
  targetBpm?: number;
  targetTempo?: Timespan;
}): string {
  if (stage.speedType === 'bmp' && stage.targetBpm !== undefined) return `${stage.targetBpm} bpm`;
  if (stage.speedType === 'tempo' && stage.targetTempo) return `${stage.targetTempo.toString('mm:ss')} /km`;
  return '—';
}

export default function RunDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  // Read-through cache: a run opened once (from the history list, or an
  // earlier visit to this same page) never re-fetches on later visits.
  const cachedRow = useAtomValue(runDetailsAtom)[params.id];
  const [isFetching, setIsFetching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const row: RunRow | null = cachedRow ?? null;
  const loading = !row && isFetching;

  useEffect(() => {
    setNotFound(false);
    // cachedRow reflects the value from the render that scheduled this
    // effect (i.e. as of the last params.id change) — enough to decide
    // whether a fetch is needed; cacheRunDetail() below is what actually
    // makes the freshly-fetched row visible via the atom, not this effect
    // re-running.
    if (cachedRow) {
      setIsFetching(false);
      return;
    }
    let cancelled = false;
    setIsFetching(true);
    axios
      .get(`/api/runs/${params.id}`, { transformResponse: [(data) => data] })
      .then(({ data }) => {
        if (cancelled) return;
        // Parse without Timespan.reviver's per-key callback, then revive
        // only `data.program` (the sole subtree with Timespan fields) —
        // running the reviver over the whole document means calling it once
        // per telemetry field too, thousands of times for a long run's worth
        // of points, none of which are ever Timespan-shaped.
        const row = JSON.parse(data);
        if (row?.data?.program) row.data.program = Timespan.reviveDeep(row.data.program);
        cacheRunDetail(row);
      })
      .catch((err) => {
        if (!cancelled && axios.isAxiosError(err) && err.response?.status === 404) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setIsFetching(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const analysis = useMemo(() => {
    if (!row) return null;
    const record = row.data;
    // Defensive: runs created before telemetry flushing/history existed (or
    // one that never survived its first flush) can have `telemetry` missing
    // entirely rather than `[]` — this JSONB column has no schema to enforce it.
    const telemetry = record.telemetry ?? [];
    const endT =
      record.durationMs !== undefined
        ? record.durationMs / 1000
        : record.finishedAt
          ? (new Date(record.finishedAt).getTime() - new Date(record.startedAt).getTime()) / 1000
          : undefined;
    const stages = record.program ? calculateStages(record.program.stages) : undefined;
    const summary = analyzeRun(telemetry, { endT, stages });
    const series = toSeries(telemetry, endT);
    const stageBands: StageBand[] | undefined = stages?.map((s) => ({
      fromMin: s.from.totalMinutes,
      toMin: s.to.totalMinutes,
    }));
    return { summary, series, stages, stageBands, telemetryCount: telemetry.length };
  }, [row]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await enqueueWrite(writes.deleteRun(params.id));
      removeRunFromCache(params.id);
      router.push('/runs');
    } finally {
      setDeleting(false);
    }
  };

  const backButton = (
    <IconButton component={Link} href="/runs" aria-label="Back to history" sx={{ ...glass, width: 40, height: 40 }}>
      <ArrowBackRoundedIcon fontSize="small" />
    </IconButton>
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (notFound || !row || !analysis) {
    return (
      <Page maxWidth={900}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1 }}>
          {backButton}
          <Typography color="text.secondary">Run not found.</Typography>
        </Box>
      </Page>
    );
  }

  const { summary, series, stages, telemetryCount } = analysis;
  const record = row.data;
  const noData = telemetryCount === 0;
  const startedAt = new Date(record.startedAt);

  return (
    <Page maxWidth={900}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1, mb: 2.5 }}>
        {backButton}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="overline" component="p" sx={{ color: 'primary.main' }}>
            {startedAt.toLocaleDateString(undefined, { weekday: 'long' })}
          </Typography>
          <Typography variant="h5" component="h1" sx={{ fontSize: '1.7rem' }}>
            {startedAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          </Typography>
        </Box>
        <IconButton onClick={() => setDeleteOpen(true)} title="Delete run" sx={{ color: 'text.secondary' }}>
          <DeleteOutlineRoundedIcon />
        </IconButton>
      </Box>

      {noData ? (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography color="text.secondary">
            No telemetry was recorded for this run (it may have been stopped immediately, or the app was
            closed before any data could be saved).
          </Typography>
        </Paper>
      ) : (
        <>
          {/* Hero summary */}
          <Paper
            variant="outlined"
            sx={{
              p: { xs: 2.5, sm: 3 },
              mb: 1.5,
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
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
                background: `radial-gradient(circle, ${alpha(tokens.cyan, 0.16)}, transparent 65%)`,
                pointerEvents: 'none',
              }}
            />
            <Box sx={{ flex: 1, minWidth: 0, position: 'relative' }}>
              {(record.programName || record.controller) && (
                <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                  {record.programName && (
                    <Chip label={record.programName} size="small" sx={{ bgcolor: tokens.surfaceHover }} />
                  )}
                  {record.controller && <SpeedControllerBadge kind={record.controller} />}
                </Box>
              )}
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
                <Typography
                  className="tabular"
                  sx={{ fontFamily: displayFont, fontWeight: 800, fontSize: 'clamp(3rem, 16vw, 4.5rem)', lineHeight: 0.95 }}
                >
                  {summary.distanceKm.toFixed(2)}
                </Typography>
                <Typography sx={{ color: tokens.textMuted, fontWeight: 600, fontSize: '1.1rem' }}>km</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 3, mt: 1.5 }}>
                <Box>
                  <Typography sx={labelSx}>Duration</Typography>
                  <Typography className="tabular" sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.4rem' }}>
                    {Timespan.fromSeconds(summary.durationSeconds).toString(
                      summary.durationSeconds < 3600 ? 'mm:ss' : 'hh:mm:ss'
                    )}
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={labelSx}>Avg pace</Typography>
                  <Typography className="tabular" sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.4rem' }}>
                    {summary.avgPace ? `${summary.avgPace.toString('mm:ss')} /km` : '—'}
                  </Typography>
                </Box>
              </Box>
            </Box>
            {summary.hrTarget && (
              <Box sx={{ textAlign: 'center', position: 'relative' }}>
                <ProgressRing value={summary.hrTarget.pctInTarget} size={96} stroke={3.5}>
                  <Typography className="tabular" sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.6rem' }}>
                    {Math.round(summary.hrTarget.pctInTarget)}%
                  </Typography>
                </ProgressRing>
                <Typography sx={{ ...labelSx, mt: 0.75 }}>In target</Typography>
              </Box>
            )}
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
              value={summary.avgHr > 0 ? `${Math.round(summary.avgHr)} / ${summary.maxHr}` : '—'}
              sub={summary.avgHr > 0 ? 'bpm' : undefined}
              icon={<FavoriteRoundedIcon />}
              accent={tokens.heart}
              index={1}
            />
            <StatTile
              label="Avg speed"
              value={`${summary.avgSpeed.toFixed(1)}`}
              sub="km/h"
              icon={<DirectionsRunRoundedIcon />}
              accent={tokens.cyan}
              index={2}
            />
            <StatTile
              label="Elevation"
              value={`${Math.round(summary.elevationGainM)} m`}
              sub="gain"
              icon={<TerrainRoundedIcon />}
              accent={tokens.violet}
              index={3}
            />
            <StatTile
              label="Avg deviation"
              value={summary.hrTarget ? `${summary.hrTarget.avgDeviationBpm.toFixed(1)}` : '—'}
              sub={summary.hrTarget ? 'bpm from target' : 'No HR-targeted stages'}
              icon={<SsidChartRoundedIcon />}
              accent={tokens.amber}
              index={4}
            />
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5, mb: 1.5 }}>
            <ChartCard title="Heart rate vs. target" wide index={5} deferIndex={0}>
              <HeartRateChart series={series} stageBands={analysis.stageBands} />
            </ChartCard>
            {summary.hrTarget && (
              <ChartCard title="Deviation from target" index={6} deferIndex={1}>
                <DeviationChart series={series} stageBands={analysis.stageBands} />
              </ChartCard>
            )}
            {summary.hrBuckets.length > 0 && (
              <ChartCard title="Time per heart rate zone" wide={!summary.hrTarget} index={7} deferIndex={2}>
                <HrBucketsChart buckets={summary.hrBuckets} />
              </ChartCard>
            )}
            <ChartCard title="Speed" index={8} deferIndex={3}>
              <SpeedChart series={series} stageBands={analysis.stageBands} />
            </ChartCard>
            <ChartCard title="Incline" index={9} deferIndex={4}>
              <InclineChart series={series} />
            </ChartCard>
          </Box>

          {stages && stages.length > 0 && summary.stages.length > 0 && (
            <Paper variant="outlined" sx={{ overflow: 'hidden', ...enter(10) }}>
              <Typography sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: '1.15rem', p: 2, pb: 1 }}>
                Stages
              </Typography>
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Target</TableCell>
                      <TableCell align="right">Duration</TableCell>
                      <TableCell align="right">Avg HR</TableCell>
                      <TableCell align="right">Deviation</TableCell>
                      <TableCell align="right">In target</TableCell>
                      <TableCell align="right">Avg speed</TableCell>
                      <TableCell align="right">Distance</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody sx={{ '& td': { whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' } }}>
                    {summary.stages.map((stage) => (
                      <TableRow key={stage.stageIndex}>
                        <TableCell>{stage.stageIndex}</TableCell>
                        <TableCell>
                          {stage.type ? (
                            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                              <Box
                                component="span"
                                sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: stageTypeColor[stage.type] }}
                              />
                              {stageTypeName[stage.type]}
                            </Box>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>{stageTargetLabel(stage)}</TableCell>
                        <TableCell align="right">
                          {Timespan.fromSeconds(stage.durationSeconds).toString('mm:ss')}
                        </TableCell>
                        <TableCell align="right">{stage.avgHr > 0 ? Math.round(stage.avgHr) : '—'}</TableCell>
                        <TableCell align="right">
                          {stage.hrTarget ? `${stage.hrTarget.avgDeviationBpm.toFixed(1)} bpm` : '—'}
                        </TableCell>
                        <TableCell align="right">
                          {stage.hrTarget ? `${Math.round(stage.hrTarget.pctInTarget)}%` : '—'}
                        </TableCell>
                        <TableCell align="right">{stage.avgSpeed.toFixed(1)} km/h</TableCell>
                        <TableCell align="right">{stage.distanceKm.toFixed(2)} km</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </>
      )}

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Delete run?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="glass" onClick={() => setDeleteOpen(false)}>
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
