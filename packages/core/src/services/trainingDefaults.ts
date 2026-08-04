import { Timespan } from './Timespan';

export const WARMUP_BPM = 143;
export const COOLDOWN_BPM = 143;
export const REGENERATION_BPM = 131;

export const WARMUP_DURATION = Timespan.fromMinutes(10);
export const COOLDOWN_DURATION = Timespan.fromMinutes(10);
export const REGENERATION_DURATION = Timespan.fromMinutes(2);
