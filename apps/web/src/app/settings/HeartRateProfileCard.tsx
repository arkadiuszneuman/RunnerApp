'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useAtomValue } from 'jotai';
import { MAX_HR_RANGE, RESTING_HR_RANGE, type AthleteProfile } from '@/lib/athleteProfile';
import { writes } from '../offline/requests';
import { enqueueWrite } from '../offline/sync';
import { store } from '../store';
import { displayFont, enter } from '../theme';
import { activitiesAtom, athleteProfileAtom, runsAtom } from '../userData';

const parse = (text: string, range: { min: number; max: number }) => {
  if (text.trim() === '') return undefined;
  const value = Number(text);
  return Number.isInteger(value) && value >= range.min && value <= range.max ? value : null;
};

/** Max and resting heart rate — the anchors for HR zones, training load and fitness estimates. */
export default function HeartRateProfileCard({ index }: Readonly<{ index: number }>) {
  const profile = useAtomValue(athleteProfileAtom);
  // Remounted once the stored profile arrives, so the fields start from it.
  return (
    <ProfileForm
      key={profile === undefined ? 'loading' : 'loaded'}
      profile={profile}
      index={index}
    />
  );
}

function ProfileForm({
  profile,
  index,
}: Readonly<{ profile: AthleteProfile | undefined; index: number }>) {
  const runs = useAtomValue(runsAtom);
  const activities = useAtomValue(activitiesAtom);
  const [maxHr, setMaxHr] = useState(profile?.maxHr?.toString() ?? '');
  const [restingHr, setRestingHr] = useState(profile?.restingHr?.toString() ?? '');
  const [saved, setSaved] = useState(false);

  const highestSeen = Math.max(
    0,
    ...(runs ?? []).map((r) => r.summary.maxHr ?? 0),
    ...(activities ?? []).map((a) => a.metrics.maxHr ?? 0)
  );
  const parsedMax = parse(maxHr, MAX_HR_RANGE);
  const parsedResting = parse(restingHr, RESTING_HR_RANGE);
  const invalid = parsedMax === null || parsedResting === null;

  const save = async () => {
    if (invalid) return;
    const next: AthleteProfile = {};
    if (parsedMax !== undefined) next.maxHr = parsedMax;
    if (parsedResting !== undefined) next.restingHr = parsedResting;
    store.set(athleteProfileAtom, next);
    await enqueueWrite(writes.setAthleteProfile(next));
    setSaved(true);
  };

  return (
    <Paper variant="outlined" sx={{ p: 2.5, mb: 1.5, ...enter(index) }}>
      <Typography sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: '1.2rem', mb: 0.5 }}>
        Heart-rate profile
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Used for heart-rate zones, training load and race predictions.
        {highestSeen > 0 && ` The highest heart rate in your runs is ${highestSeen} bpm.`}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <TextField
          label="Max HR"
          size="small"
          value={maxHr}
          onChange={(e) => {
            setMaxHr(e.target.value);
            setSaved(false);
          }}
          error={parsedMax === null}
          helperText={parsedMax === null ? `${MAX_HR_RANGE.min}–${MAX_HR_RANGE.max}` : 'bpm'}
          slotProps={{ htmlInput: { inputMode: 'numeric' } }}
          sx={{ width: 130 }}
        />
        <TextField
          label="Resting HR"
          size="small"
          value={restingHr}
          onChange={(e) => {
            setRestingHr(e.target.value);
            setSaved(false);
          }}
          error={parsedResting === null}
          helperText={
            parsedResting === null ? `${RESTING_HR_RANGE.min}–${RESTING_HR_RANGE.max}` : 'bpm'
          }
          slotProps={{ htmlInput: { inputMode: 'numeric' } }}
          sx={{ width: 130 }}
        />
        <Button
          variant="contained"
          onClick={save}
          disabled={invalid || profile === undefined}
          sx={{ mt: 0.25 }}
        >
          {saved ? 'Saved' : 'Save'}
        </Button>
      </Box>
    </Paper>
  );
}
