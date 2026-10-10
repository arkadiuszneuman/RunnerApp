/**
 * The runner's heart-rate anchors, used for HR zones, training load and HR-based fitness
 * estimates. Stored server-side in user_settings.athleteProfile (see api/user-settings), written
 * whole through the offline outbox (writes.setAthleteProfile). No client-only imports here: the
 * API route validates against the same ranges.
 */
export type AthleteProfile = { maxHr?: number; restingHr?: number };

export const MAX_HR_RANGE = { min: 100, max: 250 } as const;
export const RESTING_HR_RANGE = { min: 25, max: 120 } as const;

function inRange(value: unknown, range: { min: number; max: number }): number | undefined {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= range.min &&
    value <= range.max
    ? value
    : undefined;
}

/** Defensive read of the stored value — anything out of range is treated as unset. */
export function parseAthleteProfile(value: unknown): AthleteProfile {
  const raw = (value ?? {}) as Record<string, unknown>;
  const profile: AthleteProfile = {};
  const maxHr = inRange(raw.maxHr, MAX_HR_RANGE);
  const restingHr = inRange(raw.restingHr, RESTING_HR_RANGE);
  if (maxHr !== undefined) profile.maxHr = maxHr;
  if (restingHr !== undefined) profile.restingHr = restingHr;
  return profile;
}
