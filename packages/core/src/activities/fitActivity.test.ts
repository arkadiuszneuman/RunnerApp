import { describe, expect, it } from 'vitest';
import {
  activityFromFitMessages,
  FIT_EPOCH_MS,
  fitTimeToMs,
  type FitMessagesLike,
} from './fitActivity';

const START_MS = Date.UTC(2026, 9, 1, 6, 0, 0);
const fit = (ms: number) => (ms - FIT_EPOCH_MS) / 1000;

/** A synthetic treadmill run as the FIT SDK's decoder would hand it over. */
function treadmillRun(
  seconds: number,
  opts: { speed?: number; totalDistance?: number; subSport?: string } = {}
) {
  const speed = opts.speed ?? 3;
  const records = Array.from({ length: seconds + 1 }, (_, s) => ({
    timestamp: fit(START_MS + s * 1000),
    distance: s * speed,
    heartRate: s < 600 ? 110 + s / 20 : 145,
    enhancedSpeed: speed,
    cadence: 85,
    fractionalCadence: 0.5,
  }));
  const messages: FitMessagesLike = {
    fileIdMesgs: [
      {
        type: 'activity',
        manufacturer: 'garmin',
        garminProduct: 'fr965',
        serialNumber: 3412345678,
        timeCreated: fit(START_MS),
      },
    ],
    activityMesgs: [
      {
        timestamp: fit(START_MS + seconds * 1000),
        localTimestamp: fit(START_MS + seconds * 1000) + 7200,
      },
    ],
    sessionMesgs: [
      {
        sport: 'running',
        subSport: opts.subSport ?? 'treadmill',
        startTime: fit(START_MS),
        timestamp: fit(START_MS + seconds * 1000),
        totalElapsedTime: seconds,
        totalTimerTime: seconds,
        totalDistance: opts.totalDistance ?? seconds * speed,
        avgHeartRate: 140,
        maxHeartRate: 146,
        avgRunningCadence: 85,
        avgFractionalCadence: 0.5,
        totalCalories: 600,
        totalTrainingEffect: 3.1,
      },
    ],
    recordMesgs: records,
  };
  return messages;
}

describe('fitTimeToMs', () => {
  it('converts FIT-epoch seconds and Dates', () => {
    expect(fitTimeToMs(fit(START_MS))).toBe(START_MS);
    expect(fitTimeToMs(new Date(START_MS))).toBe(START_MS);
    expect(fitTimeToMs(undefined)).toBeUndefined();
  });
});

describe('activityFromFitMessages', () => {
  it('maps a treadmill run: totals, sport, time zone, identity, streams', () => {
    const { activities, skipped } = activityFromFitMessages(treadmillRun(3600));
    expect(skipped).toBeUndefined();
    expect(activities).toHaveLength(1);
    const a = activities[0];
    expect(a.startTime).toBe(new Date(START_MS).toISOString());
    expect(a.sport).toBe('treadmill');
    expect(a.tzOffsetMin).toBe(120);
    expect(a.device).toBe('Garmin fr965');
    expect(a.dedupKey).toBe(`fit:3412345678:${START_MS / 1000}`);
    expect(a.metrics.distanceM).toBe(10800);
    expect(a.metrics.movingS).toBe(3600);
    expect(a.metrics.avgHr).toBe(140);
    expect(a.metrics.cadenceSpm).toBe(171);
    expect(a.metrics.trainingEffect).toBe(3.1);
    expect(a.metrics.bestEfforts['5k']).toBeCloseTo(5000 / 3, 0);
    expect(a.metrics.bestEfforts['10k']).toBeCloseTo(10000 / 3, 0);
    expect(a.metrics.bestEfforts.hm).toBeUndefined();
    expect(a.metrics.splitsKmS).toHaveLength(10);
    expect(a.metrics.steady?.hr).toBe(145);
    // 5 s streams, steps per minute for cadence.
    expect(a.streams?.t.slice(0, 3)).toEqual([0, 5, 10]);
    expect(a.streams?.cad[0]).toBe(171);
  });

  it('rescales record distances to a calibrated session total', () => {
    // The watch thought 3 m/s, but the run was calibrated to 10 % further after the fact.
    const { activities } = activityFromFitMessages(treadmillRun(2000, { totalDistance: 6600 }));
    const a = activities[0];
    expect(a.metrics.distanceM).toBe(6600);
    expect(a.metrics.bestEfforts['5k']).toBeCloseTo(5000 / 3.3, 0);
  });

  it('integrates speed when records carry no distance', () => {
    const messages = treadmillRun(1200);
    messages.recordMesgs = messages.recordMesgs!.map(({ distance: _distance, ...r }) => r);
    const { activities } = activityFromFitMessages(messages);
    expect(activities[0].metrics.bestEfforts['1k']).toBeCloseTo(1000 / 3, 0);
  });

  it('maps sub-sports', () => {
    expect(
      activityFromFitMessages(treadmillRun(60, { subSport: 'trail' })).activities[0].sport
    ).toBe('trail');
    expect(
      activityFromFitMessages(treadmillRun(60, { subSport: 'generic' })).activities[0].sport
    ).toBe('run');
    expect(
      activityFromFitMessages(treadmillRun(60, { subSport: 'indoorRunning' })).activities[0].sport
    ).toBe('indoor');
  });

  it('skips non-runs and non-activity files', () => {
    const ride = treadmillRun(60);
    ride.sessionMesgs![0].sport = 'cycling';
    expect(activityFromFitMessages(ride)).toEqual({ activities: [], skipped: 'not-a-run' });

    const course = treadmillRun(60);
    course.fileIdMesgs![0].type = 'course';
    expect(activityFromFitMessages(course).skipped).toBe('not-an-activity');

    expect(activityFromFitMessages({ fileIdMesgs: [{ type: 'activity' }] }).skipped).toBe(
      'no-session'
    );
  });

  it('falls back to the start time as identity without a serial number', () => {
    const messages = treadmillRun(60);
    delete messages.fileIdMesgs![0].serialNumber;
    expect(activityFromFitMessages(messages).activities[0].dedupKey).toBe(
      `start:${START_MS / 1000}`
    );
  });
});
