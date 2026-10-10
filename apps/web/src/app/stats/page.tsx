'use client';

import { useMemo, useState } from 'react';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { applyFilter, resolveRange } from '@runner/core';
import { useAtomValue } from 'jotai';
import Link from 'next/link';
import EmptyState from '../base/EmptyState';
import Page from '../base/Page';
import { enter } from '../theme';
import CalendarHeatmap from './CalendarHeatmap';
import {
  AdherencePanel,
  CadencePanel,
  DistanceHistogramPanel,
  ElevationPanel,
  FitnessPanel,
  HourPanel,
  LoadPanel,
  LongestRunPanel,
  PacePanel,
  SportPanel,
  VolumePanel,
  WeekdayPanel,
  YearComparePanel,
  ZonesPanel,
} from './panels';
import StatsFilterBar from './StatsFilterBar';
import { statsFilterAtom, toLocalNow, useStatsActivities, yearsOf } from './statsState';
import { KpiTiles, PredictionsCard, RecordsCard, SectionTitle } from './Summary';
import { useHrAnchors } from './useHrAnchors';

const grid = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
  gap: 1.5,
} as const;

export default function StatsPage() {
  const all = useStatsActivities();
  const filter = useAtomValue(statsFilterAtom);
  // "Now" is fixed when the page opens, so every panel agrees on it.
  const [nowMs] = useState(() => Date.now());
  const now = useMemo(() => toLocalNow(nowMs), [nowMs]);
  const hr = useHrAnchors(all, nowMs);
  const years = useMemo(() => yearsOf(all), [all]);

  const { list, allTime, previous, span } = useMemo(() => {
    if (!all) return { list: [], allTime: [], previous: undefined, span: {} };
    const span = resolveRange(filter, now);
    const list = applyFilter(all, filter, now);
    // Every other filter, over all time — for year-over-year comparisons.
    const allTime = applyFilter(all, { ...filter, range: 'all' }, now);
    // The same-length window right before, for the "vs previous period" trend.
    const end = span.toMs ?? now;
    const previous =
      span.fromMs !== undefined
        ? allTime.filter(
            (a) => a.localMs >= span.fromMs! - (end - span.fromMs!) && a.localMs < span.fromMs!
          )
        : undefined;
    return { list, allTime, previous, span };
  }, [all, filter, now]);

  if (!all) {
    return (
      <Page eyebrow="Your training" title="Stats" maxWidth={900}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="rounded" height={160} sx={{ mb: 1.5, borderRadius: '20px' }} />
        ))}
      </Page>
    );
  }

  if (all.length === 0) {
    return (
      <Page eyebrow="Your training" title="Stats" maxWidth={900}>
        <EmptyState
          icon={<InsightsRoundedIcon />}
          title="Nothing to analyse yet"
          text="Run with RunnerApp, or bring in your Garmin runs in Settings, and your statistics show up here."
          action={
            <Button variant="contained" href="/settings" LinkComponent={Link}>
              Import Garmin runs
            </Button>
          }
        />
      </Page>
    );
  }

  return (
    <Page
      eyebrow={`${list.length} ${list.length === 1 ? 'run' : 'runs'}`}
      title="Stats"
      maxWidth={900}
    >
      <StatsFilterBar atom={statsFilterAtom} years={years} />

      {list.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 3, ...enter(1) }}>
          <Typography color="text.secondary">No runs match these filters.</Typography>
        </Paper>
      ) : (
        <>
          <KpiTiles list={list} previous={previous} nowLocalMs={now} />

          <SectionTitle>Race predictions</SectionTitle>
          <PredictionsCard all={all} hr={hr} nowMs={nowMs} index={9} />

          <SectionTitle>Volume</SectionTitle>
          <Box sx={grid}>
            <VolumePanel list={list} span={span} index={10} deferIndex={0} />
            <Paper
              variant="outlined"
              sx={{ p: 2, gridColumn: '1 / -1', minWidth: 0, ...enter(11) }}
            >
              <CalendarHeatmap list={list} nowLocalMs={Math.min(span.toMs ?? now, now)} />
            </Paper>
            <YearComparePanel list={allTime} nowLocalMs={now} index={12} deferIndex={1} />
            <LongestRunPanel list={list} span={span} index={13} deferIndex={2} />
          </Box>

          <SectionTitle>Progress</SectionTitle>
          <Box sx={grid}>
            <PacePanel list={list} index={14} deferIndex={3} />
            <FitnessPanel list={list} hr={hr} index={15} deferIndex={4} />
            <LoadPanel
              list={list}
              all={all}
              hr={hr}
              span={span}
              nowLocalMs={now}
              index={16}
              deferIndex={5}
            />
            <ZonesPanel list={list} hr={hr} index={17} deferIndex={6} />
            <AdherencePanel list={list} index={18} deferIndex={7} />
            <CadencePanel list={list} index={19} deferIndex={8} />
          </Box>

          <SectionTitle>Best efforts</SectionTitle>
          <RecordsCard list={list} index={20} />

          <SectionTitle>Habits</SectionTitle>
          <Box sx={grid}>
            <WeekdayPanel list={list} index={21} deferIndex={9} />
            <HourPanel list={list} index={22} deferIndex={10} />
            <DistanceHistogramPanel list={list} index={23} deferIndex={11} />
            <SportPanel list={list} index={24} deferIndex={12} />
            <ElevationPanel list={list} index={25} deferIndex={13} />
          </Box>
        </>
      )}
    </Page>
  );
}
