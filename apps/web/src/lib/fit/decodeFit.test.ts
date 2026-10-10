// @vitest-environment node
import {
  Encoder,
  Profile,
  type ActivityMesg,
  type FileIdMesg,
  type RecordMesg,
  type SessionMesg,
} from '@garmin/fitsdk';
import { describe, expect, it } from 'vitest';
import { importActivitiesSchema } from '../validation';
import { decodeFit } from './decodeFit';

const START = new Date(Date.UTC(2026, 9, 1, 6, 0, 0));

/** A real FIT file, written by Garmin's own encoder: a 30-minute treadmill run at 3 m/s. */
function encodeTreadmillRun(seconds = 1800): Uint8Array {
  const encoder = new Encoder();
  const at = (s: number) => new Date(START.getTime() + s * 1000);
  const fileId: FileIdMesg = {
    type: 'activity',
    manufacturer: 'garmin',
    product: 4315,
    serialNumber: 3412345678,
    timeCreated: START,
  };
  encoder.onMesg(Profile.MesgNum.FILE_ID, fileId);
  for (let s = 0; s <= seconds; s++) {
    const record: RecordMesg = {
      timestamp: at(s),
      distance: s * 3,
      enhancedSpeed: 3,
      heartRate: 140 + Math.round(s / 300),
      cadence: 85,
    };
    encoder.onMesg(Profile.MesgNum.RECORD, record);
  }
  const session: SessionMesg = {
    timestamp: at(seconds),
    startTime: START,
    sport: 'running',
    subSport: 'treadmill',
    totalElapsedTime: seconds,
    totalTimerTime: seconds,
    totalDistance: seconds * 3,
    avgHeartRate: 143,
    maxHeartRate: 146,
    // The encoder writes main fields only; decoding expands this into avgRunningCadence.
    avgCadence: 85,
    totalCalories: 400,
  };
  encoder.onMesg(Profile.MesgNum.SESSION, session);
  const activity: ActivityMesg = {
    timestamp: at(seconds),
    localTimestamp: Math.round(at(seconds).getTime() / 1000 - 631065600 + 7200),
    numSessions: 1,
    totalTimerTime: seconds,
  };
  encoder.onMesg(Profile.MesgNum.ACTIVITY, activity);
  return encoder.close();
}

describe('decodeFit', () => {
  it('reads a FIT file into an activity the import API accepts', () => {
    const result = decodeFit(encodeTreadmillRun());
    expect('error' in result).toBe(false);
    expect(result.activities).toHaveLength(1);
    const activity = result.activities[0];
    expect(activity).toMatchObject({
      startTime: START.toISOString(),
      sport: 'treadmill',
      tzOffsetMin: 120,
      dedupKey: `fit:3412345678:${START.getTime() / 1000}`,
    });
    expect(activity.metrics.distanceM).toBe(5400);
    expect(activity.metrics.avgHr).toBe(143);
    expect(activity.metrics.cadenceSpm).toBe(170);
    expect(activity.metrics.bestEfforts['5k']).toBeCloseTo(5000 / 3, 0);
    expect(activity.streams?.t.length).toBeGreaterThan(300);

    expect(importActivitiesSchema.safeParse({ activities: result.activities }).success).toBe(true);
  });

  it('reports files that are not FIT', () => {
    const result = decodeFit(new TextEncoder().encode('definitely not a FIT file'));
    expect(result.activities).toEqual([]);
    expect('error' in result && result.error).toBeTruthy();
  });
});

describe('importActivitiesSchema', () => {
  it('rejects out-of-range values and ragged streams', () => {
    const activity = decodeFit(encodeTreadmillRun(600)).activities[0];
    const bad = (patch: object) =>
      importActivitiesSchema.safeParse({ activities: [{ ...activity, ...patch }] }).success;
    expect(bad({ metrics: { ...activity.metrics, avgHr: 900 } })).toBe(false);
    expect(bad({ sport: 'cycling' })).toBe(false);
    expect(bad({ streams: { ...activity.streams!, hr: [1, 2, 3] } })).toBe(false);
    expect(bad({ garminId: 'abc' })).toBe(false);
    expect(importActivitiesSchema.safeParse({ activities: [] }).success).toBe(false);
  });
});
