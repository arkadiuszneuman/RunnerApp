'use client';

import { useMemo } from 'react';
import DirectionsRunRoundedIcon from '@mui/icons-material/DirectionsRunRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import LocalFireDepartmentRoundedIcon from '@mui/icons-material/LocalFireDepartmentRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import StraightenRoundedIcon from '@mui/icons-material/StraightenRounded';
import TerrainRoundedIcon from '@mui/icons-material/TerrainRounded';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import {
  EFFORT_DISTANCES,
  personalRecords,
  predictRaces,
  totals,
  weekStreaks,
  type HrAnchors,
  type PredictionMethod,
  type RaceKey,
  type StatsActivity,
} from '@runner/core';
import Link from 'next/link';
import { effortLabel } from '../activities/format';
import StatTile, { statLabelSx } from '../base/StatTile';
import { displayFont, enter, tokens } from '../theme';
import { clock, hoursMinutes, km, mmss } from './format';

export function SectionTitle({ children }: Readonly<{ children: string }>) {
  return (
    <Typography
      sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.35rem', mt: 3, mb: 1.25 }}
    >
      {children}
    </Typography>
  );
}

/** Headline numbers for the filtered runs; `previous` (the same-length period before) gives the distance trend. */
export function KpiTiles({
  list,
  previous,
  nowLocalMs,
}: Readonly<{ list: StatsActivity[]; previous?: StatsActivity[]; nowLocalMs: number }>) {
  const t = useMemo(() => totals(list), [list]);
  const prev = useMemo(() => (previous ? totals(previous) : undefined), [previous]);
  const streaks = useMemo(() => weekStreaks(list, nowLocalMs), [list, nowLocalMs]);
  const delta =
    prev && prev.distanceM > 0
      ? `${t.distanceM >= prev.distanceM ? '+' : ''}${Math.round(((t.distanceM - prev.distanceM) / prev.distanceM) * 100)}% vs previous period`
      : 'kilometres';

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
        gap: 1.5,
      }}
    >
      <StatTile
        label="Distance"
        value={km(t.distanceM, 0)}
        sub={delta}
        icon={<StraightenRoundedIcon />}
        accent={tokens.cyan}
        index={1}
      />
      <StatTile
        label="Runs"
        value={String(t.count)}
        sub={
          streaks.current > 0
            ? `${streaks.current} wk streak · best ${streaks.longest}`
            : `best streak ${streaks.longest} wk`
        }
        icon={<DirectionsRunRoundedIcon />}
        accent={tokens.volt}
        index={2}
      />
      <StatTile
        label="Time"
        value={hoursMinutes(t.movingS)}
        icon={<TimerOutlinedIcon />}
        accent={tokens.violet}
        index={3}
      />
      <StatTile
        label="Avg pace"
        value={t.paceSPerKm ? mmss(t.paceSPerKm) : '—'}
        sub="/km"
        icon={<SpeedRoundedIcon />}
        accent={tokens.cyan}
        index={4}
      />
      <StatTile
        label="Avg HR"
        value={t.avgHr ? String(Math.round(t.avgHr)) : '—'}
        sub={t.avgHr ? 'bpm' : undefined}
        icon={<FavoriteRoundedIcon />}
        accent={tokens.heart}
        index={5}
      />
      <StatTile
        label="Longest"
        value={t.longest ? `${km(t.longest.distanceM)} km` : '—'}
        sub={
          t.longest
            ? new Date(t.longest.startMs).toLocaleDateString(undefined, { dateStyle: 'medium' })
            : undefined
        }
        icon={<EmojiEventsRoundedIcon />}
        accent={tokens.amber}
        index={6}
      />
      <StatTile
        label="Elevation"
        value={`${Math.round(t.elevGainM)} m`}
        sub="gain"
        icon={<TerrainRoundedIcon />}
        accent={tokens.violet}
        index={7}
      />
      <StatTile
        label="Avg run"
        value={t.count > 0 ? `${km(t.distanceM / t.count)} km` : '—'}
        sub={t.calories > 0 ? `${Math.round(t.calories).toLocaleString()} kcal total` : undefined}
        icon={<LocalFireDepartmentRoundedIcon />}
        accent={tokens.heart}
        index={8}
      />
    </Box>
  );
}

const RACE_LABEL: Record<RaceKey, string> = {
  '5k': '5 km',
  '10k': '10 km',
  hm: 'Half marathon',
  m: 'Marathon',
};
const METHOD_LABEL: Record<PredictionMethod, string> = {
  vdot: 'VDOT',
  riegel: 'Riegel',
  hr: 'Heart rate',
  tanda: 'Tanda',
};

/**
 * Race predictions "as of now" from the last 12 weeks of every run (filters don't apply — they
 * describe current fitness, not a period).
 */
export function PredictionsCard({
  all,
  hr,
  nowMs,
  index,
}: Readonly<{
  all: StatsActivity[];
  hr?: HrAnchors & { estimated: boolean };
  nowMs: number;
  index: number;
}>) {
  const { predictions, basis } = useMemo(() => predictRaces(all, { nowMs, hr }), [all, hr, nowMs]);

  return (
    <Paper variant="outlined" sx={{ p: 2, ...enter(index) }}>
      {predictions.length === 0 ? (
        <Typography color="text.secondary">
          Not enough recent data: run 5 km or more with GPS or on the treadmill, or set your
          heart-rate profile in Settings, to get predictions.
        </Typography>
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
              gap: 1.5,
            }}
          >
            {predictions.map((p) => {
              const values = Object.values(p.methods);
              const spread = values.length > 1 ? Math.max(...values) - Math.min(...values) : 0;
              return (
                <Box key={p.key}>
                  <Typography sx={statLabelSx}>{RACE_LABEL[p.key]}</Typography>
                  <Typography
                    className="tabular"
                    sx={{
                      fontFamily: displayFont,
                      fontWeight: 700,
                      fontSize: '1.7rem',
                      lineHeight: 1.15,
                    }}
                  >
                    {clock(p.seconds)}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    className="tabular"
                    component="p"
                  >
                    {mmss(p.seconds / (EFFORT_DISTANCES[p.key] / 1000))} /km
                    {spread > 0 && ` · ±${clock(spread / 2)}`}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: tokens.textFaint }}
                    className="tabular"
                    component="p"
                  >
                    {(Object.entries(p.methods) as [PredictionMethod, number][])
                      .map(([m, s]) => `${METHOD_LABEL[m]} ${clock(s)}`)
                      .join(' · ')}
                  </Typography>
                </Box>
              );
            })}
          </Box>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
            {[
              basis.effortVdot &&
                `Best effort: ${effortLabel[basis.effortVdot.key]} on ${new Date(basis.effortVdot.activity.startMs).toLocaleDateString(undefined, { dateStyle: 'medium' })} (VDOT ${basis.effortVdot.vdot.toFixed(1)})`,
              basis.hrVo2max !== undefined &&
                `heart-rate VO₂max ${basis.hrVo2max.toFixed(1)} from ${basis.hrRuns} ${basis.hrRuns === 1 ? 'run' : 'runs'}`,
              `${basis.kmPerWeek.toFixed(0)} km/week`,
            ]
              .filter(Boolean)
              .join(' · ')}
            . Training runs aren&apos;t races, so treat these as a range.
            {hr?.estimated && (
              <>
                {' '}
                Heart-rate figures use estimated max/resting HR — set yours in{' '}
                <Link href="/settings">Settings</Link>.
              </>
            )}
          </Typography>
        </>
      )}
    </Paper>
  );
}

export function RecordsCard({ list, index }: Readonly<{ list: StatsActivity[]; index: number }>) {
  const records = useMemo(() => personalRecords(list), [list]);
  if (records.length === 0) return null;
  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden', ...enter(index) }}>
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Distance</TableCell>
              <TableCell align="right">Time</TableCell>
              <TableCell align="right">Pace</TableCell>
              <TableCell align="right">Date</TableCell>
            </TableRow>
          </TableHead>
          <TableBody sx={{ '& td': { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } }}>
            {records.map((r) => {
              const href = r.activity.runId
                ? `/runs/${r.activity.runId}`
                : `/activities/${r.activity.activityId}`;
              return (
                <TableRow key={r.key} hover>
                  <TableCell>{effortLabel[r.key]}</TableCell>
                  <TableCell align="right">{clock(r.seconds)}</TableCell>
                  <TableCell align="right">
                    {mmss(r.seconds / (EFFORT_DISTANCES[r.key] / 1000))} /km
                  </TableCell>
                  <TableCell align="right">
                    <Link href={href} style={{ color: 'inherit' }}>
                      {new Date(r.activity.startMs).toLocaleDateString(undefined, {
                        dateStyle: 'medium',
                      })}
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
