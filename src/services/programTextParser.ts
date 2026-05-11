import { Timespan } from './Timespan';
import { MultiplyStage, Stage } from './stagesCalculator';
import {
  COOLDOWN_BPM,
  COOLDOWN_DURATION,
  REGENERATION_BPM,
  REGENERATION_DURATION,
  WARMUP_BPM,
  WARMUP_DURATION,
} from './trainingDefaults';

const FORMAT_REGEX = /^(\d+)x(\d+:\d{2})@(\d+)$/;

/**
 * Parses a training program text like "4x4:00@184" into a MultiplyStage array.
 *
 * Format: NxMM:SS@BPM
 *   N    — number of intervals
 *   MM:SS — sprint duration
 *   BPM  — target heart rate for the sprint
 *
 * The resulting program always includes:
 *   - a warmup stage before the intervals
 *   - a fixed-duration regeneration stage after each sprint
 *   - a cooldown stage after the intervals
 */
export function parseProgram(text: string): MultiplyStage[] {
  const match = text.trim().match(FORMAT_REGEX);

  if (!match) {
    throw new Error(
      `Invalid format "${text}". Expected NxMM:SS@BPM, e.g. 4x4:00@184`
    );
  }

  const times = parseInt(match[1], 10);
  const duration = Timespan.parse(match[2]);
  const bpm = parseInt(match[3], 10);

  if (times < 1) {
    throw new Error('Number of intervals must be at least 1');
  }

  const warmup: Stage = {
    type: 'simple',
    duration: WARMUP_DURATION,
    speedType: 'bmp',
    bmp: WARMUP_BPM,
  };

  const sprint: Stage = {
    type: 'sprint',
    duration,
    speedType: 'bmp',
    bmp: bpm,
  };

  const regeneration: Stage = {
    type: 'regeneration',
    duration: REGENERATION_DURATION,
    speedType: 'bmp',
    bmp: REGENERATION_BPM,
  };

  const cooldown: Stage = {
    type: 'simple',
    duration: COOLDOWN_DURATION,
    speedType: 'bmp',
    bmp: COOLDOWN_BPM,
  };

  return [
    { times: 1, stages: [warmup] },
    { times, stages: [sprint, regeneration] },
    { times: 1, stages: [cooldown] },
  ];
}
