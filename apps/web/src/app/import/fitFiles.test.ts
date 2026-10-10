import { describe, expect, it } from 'vitest';
import { garminIdFromName } from './fitFiles';

describe('garminIdFromName', () => {
  it('reads the activity id from Garmin export and download names', () => {
    expect(garminIdFromName('DI_CONNECT/x/runner@example.com_17234567890.fit')).toBe('17234567890');
    expect(garminIdFromName('17234567890_ACTIVITY.fit')).toBe('17234567890');
  });

  it('ignores names without one', () => {
    expect(garminIdFromName('Morning_Run.fit')).toBeUndefined();
    expect(garminIdFromName('2026-10-01-06-00-00.fit')).toBeUndefined();
  });
});
