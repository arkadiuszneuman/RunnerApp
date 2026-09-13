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
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import axios from 'axios';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { analyzeRun, calculateStages, Timespan, toSeries, type RunRecord } from '@runner/core';
import DeviationChart from './charts/DeviationChart';
import HeartRateChart from './charts/HeartRateChart';
import HrBucketsChart from './charts/HrBucketsChart';
import InclineChart from './charts/InclineChart';
import SpeedChart from './charts/SpeedChart';
import type { StageBand } from './charts/stageShadingPlugin';

type RunRow = { id: string; createdAt: string; data: RunRecord };

function StatTile({ label, value, sub }: Readonly<{ label: string; value: string; sub?: string }>) {
  return (
    <Grid size={{ xs: 6, sm: 3 }}>
      <Paper variant="outlined" sx={{ p: 1.5, height: '100%' }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {label}
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
          {value}
        </Typography>
        {sub && (
          <Typography variant="caption" color="text.secondary">
            {sub}
          </Typography>
        )}
      </Paper>
    </Grid>
  );
}

function ChartCard({
  title,
  height = 260,
  children,
}: Readonly<{ title: string; height?: number; children: ReactNode }>) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {title}
      </Typography>
      <Box sx={{ height }}>{children}</Box>
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
  const [row, setRow] = useState<RunRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    axios
      .get(`/api/runs/${params.id}`, { transformResponse: [(data) => data] })
      .then(({ data }) => setRow(JSON.parse(data, Timespan.reviver)))
      .catch((err) => {
        if (axios.isAxiosError(err) && err.response?.status === 404) setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  const analysis = useMemo(() => {
    if (!row) return null;
    const record = row.data;
    const endT =
      record.durationMs !== undefined
        ? record.durationMs / 1000
        : record.finishedAt
          ? (new Date(record.finishedAt).getTime() - new Date(record.startedAt).getTime()) / 1000
          : undefined;
    const stages = record.program ? calculateStages(record.program.stages) : undefined;
    const summary = analyzeRun(record.telemetry, { endT, stages });
    const series = toSeries(record.telemetry, endT);
    const stageBands: StageBand[] | undefined = stages?.map((s) => ({
      fromMin: s.from.totalMinutes,
      toMin: s.to.totalMinutes,
    }));
    return { summary, series, stages, stageBands };
  }, [row]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await axios.delete(`/api/runs/${params.id}`);
      router.push('/runs');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (notFound || !row || !analysis) {
    return (
      <Box sx={{ maxWidth: 900, mx: 'auto', p: 2 }}>
        <Typography color="text.secondary">Run not found.</Typography>
        <Button href="/runs" LinkComponent={Link} sx={{ mt: 2 }}>
          Back to history
        </Button>
      </Box>
    );
  }

  const { summary, series, stages } = analysis;
  const record = row.data;
  const noData = record.telemetry.length === 0;

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            {new Date(record.startedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          </Typography>
          {record.programName && <Chip label={record.programName} size="small" sx={{ mt: 0.5 }} />}
        </Box>
        <IconButton onClick={() => setDeleteOpen(true)} title="Delete run">
          <DeleteIcon />
        </IconButton>
      </Box>

      {noData ? (
        <Typography color="text.secondary" sx={{ mt: 2 }}>
          No telemetry was recorded for this run (it may have been stopped immediately, or the app was
          closed before any data could be saved).
        </Typography>
      ) : (
        <>
          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            <StatTile
              label="Duration"
              value={Timespan.fromSeconds(summary.durationSeconds).toString(
                summary.durationSeconds < 3600 ? 'mm:ss' : 'hh:mm:ss'
              )}
            />
            <StatTile label="Distance" value={`${summary.distanceKm.toFixed(2)} km`} />
            <StatTile
              label="Avg pace"
              value={summary.avgPace ? `${summary.avgPace.toString('mm:ss')} /km` : '—'}
            />
            <StatTile label="Elevation gain" value={`${Math.round(summary.elevationGainM)} m`} />
            <StatTile
              label="Avg / max HR"
              value={summary.avgHr > 0 ? `${Math.round(summary.avgHr)} / ${summary.maxHr} bpm` : '—'}
            />
            <StatTile label="Avg speed" value={`${summary.avgSpeed.toFixed(1)} km/h`} />
            <StatTile
              label="Time in target"
              value={summary.hrTarget ? `${Math.round(summary.hrTarget.pctInTarget)}%` : '—'}
              sub={summary.hrTarget ? `±5 bpm of target` : 'No HR-targeted stages'}
            />
            <StatTile
              label="Avg deviation"
              value={summary.hrTarget ? `${summary.hrTarget.avgDeviationBpm.toFixed(1)} bpm` : '—'}
            />
          </Grid>

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid size={12}>
              <ChartCard title="Heart rate vs. target">
                <HeartRateChart series={series} stageBands={analysis.stageBands} />
              </ChartCard>
            </Grid>
            {summary.hrTarget && (
              <Grid size={{ xs: 12, md: 6 }}>
                <ChartCard title="Deviation from target">
                  <DeviationChart series={series} stageBands={analysis.stageBands} />
                </ChartCard>
              </Grid>
            )}
            {summary.hrBuckets.length > 0 && (
              <Grid size={{ xs: 12, md: summary.hrTarget ? 6 : 12 }}>
                <ChartCard title="Time per heart rate zone">
                  <HrBucketsChart buckets={summary.hrBuckets} />
                </ChartCard>
              </Grid>
            )}
            <Grid size={{ xs: 12, md: 6 }}>
              <ChartCard title="Speed">
                <SpeedChart series={series} stageBands={analysis.stageBands} />
              </ChartCard>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ChartCard title="Incline" height={200}>
                <InclineChart series={series} />
              </ChartCard>
            </Grid>
          </Grid>

          {stages && stages.length > 0 && summary.stages.length > 0 && (
            <Paper variant="outlined" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ p: 2, pb: 0 }}>
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
                  <TableBody>
                    {summary.stages.map((stage) => (
                      <TableRow key={stage.stageIndex}>
                        <TableCell>{stage.stageIndex}</TableCell>
                        <TableCell sx={{ textTransform: 'capitalize' }}>{stage.type ?? '—'}</TableCell>
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

      <Button
        variant="contained"
        href="/runs"
        LinkComponent={Link}
        sx={{
          backgroundColor: 'rgba(255,255,255,0.15)',
          color: 'white',
          '&:hover': { backgroundColor: 'rgba(255,255,255,0.25)' },
        }}
      >
        Back to history
      </Button>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Delete run?</DialogTitle>
        <DialogContent>
          <Typography>This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
