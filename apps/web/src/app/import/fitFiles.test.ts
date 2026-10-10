import { describe, expect, it } from 'vitest';
import { collectGarminIds, garminIdAt, garminIdFromName } from './fitFiles';

describe('garminIdFromName', () => {
  it("reads the activity id from Garmin Connect's Export original download", () => {
    expect(garminIdFromName('17234567890_ACTIVITY.fit')).toBe('17234567890');
    expect(garminIdFromName('downloads/17234567890_ACTIVITY.fit')).toBe('17234567890');
  });

  it('ignores names without one', () => {
    // The full account export's number is the uploaded file's, not the activity's.
    expect(garminIdFromName('DI_CONNECT/x/runner@example.com_491798206781.fit')).toBeUndefined();
    expect(garminIdFromName('Morning_Run.fit')).toBeUndefined();
    expect(garminIdFromName('2026-10-01-06-00-00.fit')).toBeUndefined();
  });
});

describe('collectGarminIds / garminIdAt', () => {
  // Shape of DI-Connect-Fitness/<email>_0_summarizedActivities.json in Garmin's account export.
  const summaries = [
    {
      summarizedActivitiesExport: [
        {
          activityId: 7123456789,
          name: 'Run',
          startTimeGmt: 1626760800000,
          beginTimestamp: 1626760800000,
        },
        { activityId: 7123999999, name: 'Walk', beginTimestamp: 1626847200500 },
        { name: 'no id', startTimeGmt: 1626933600000 },
      ],
    },
  ];

  it('maps start times to activity ids', () => {
    const ids = collectGarminIds(summaries);
    expect(ids.size).toBe(2);
    expect(garminIdAt(ids, '2021-07-20T06:00:00.000Z')).toBe('7123456789');
    expect(garminIdAt(ids, '2021-07-21T06:00:01.000Z')).toBe('7123999999');
  });

  it('tolerates a couple of seconds between the FIT file and the summary, no more', () => {
    const ids = collectGarminIds(summaries);
    expect(garminIdAt(ids, '2021-07-20T06:00:02.000Z')).toBe('7123456789');
    expect(garminIdAt(ids, '2021-07-20T06:00:05.000Z')).toBeUndefined();
  });
});
