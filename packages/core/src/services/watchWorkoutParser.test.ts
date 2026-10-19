import { describe, expect, it } from 'vitest';
import calculateStages from './stagesCalculator';
import { Timespan } from './Timespan';
import {
  COOLDOWN_BPM,
  REGENERATION_BPM,
  REGENERATION_DURATION,
  WARMUP_BPM,
} from './trainingDefaults';
import { extractWatchWorkout, parseWatchWorkout } from './watchWorkoutParser';

const min = (minutes: number) => Timespan.fromMinutes(minutes);

function summary(text: string) {
  return calculateStages(parseWatchWorkout(text).stages).map((s) => ({
    type: s.type,
    duration: s.to.subtract(s.from).toString('mm:ss'),
    bmp: s.speedType === 'bmp' ? s.bmp : undefined,
  }));
}

describe('parseWatchWorkout', () => {
  it('reads a steady workout as one stage', () => {
    expect(parseWatchWorkout('143bpm 31:00')).toEqual({
      name: undefined,
      stages: [
        { times: 1, stages: [{ type: 'simple', duration: min(31), speedType: 'bmp', bmp: 143 }] },
      ],
    });
  });

  it('accepts the heart rate after the duration and without "bpm"', () => {
    expect(summary('31:00 143')).toEqual([{ type: 'simple', duration: '31:00', bmp: 143 }]);
  });

  it('splits what the block leaves of the total into a warmup and a cooldown', () => {
    expect(summary('21:00@169bpm 41:00')).toEqual([
      { type: 'simple', duration: '10:00', bmp: WARMUP_BPM },
      { type: 'simple', duration: '21:00', bmp: 169 },
      { type: 'simple', duration: '10:00', bmp: COOLDOWN_BPM },
    ]);
  });

  it('gives an odd leftover second to the warmup', () => {
    expect(summary('20:00@169 40:01').map((s) => s.duration)).toEqual(['10:01', '20:00', '10:00']);
  });

  it('falls back to the default warmup and cooldown without a total', () => {
    expect(summary('21:00@169').map((s) => s.duration)).toEqual(['10:00', '21:00', '10:00']);
  });

  it('drops the warmup and cooldown when the block is the whole workout', () => {
    expect(summary('21:00@169 21:00')).toEqual([{ type: 'simple', duration: '21:00', bmp: 169 }]);
  });

  it('takes the words before the numbers as the name', () => {
    expect(parseWatchWorkout('Próg 21:00@169bpm 41:00').name).toBe('Próg');
    expect(parseWatchWorkout('Długi bieg: 145bpm 1:10:00').name).toBe('Długi bieg');
  });

  it('reads hour-long durations', () => {
    expect(parseWatchWorkout('145bpm 1:10:00').stages[0].stages[0].duration).toEqual(min(70));
  });

  it('shapes intervals like parseProgram and fits the warmup/cooldown to the total', () => {
    const workout = parseWatchWorkout('4x4:00@184bpm 40:00');
    expect(workout.stages[1]).toEqual({
      times: 4,
      stages: [
        { type: 'sprint', duration: min(4), speedType: 'bmp', bmp: 184 },
        {
          type: 'regeneration',
          duration: REGENERATION_DURATION,
          speedType: 'bmp',
          bmp: REGENERATION_BPM,
        },
      ],
    });
    // 4×4:00 + 3×2:00 = 22:00, so 18:00 is left for warmup + cooldown.
    expect(workout.stages[0].stages[0].duration).toEqual(min(9));
    expect(workout.stages[2].stages[0].duration).toEqual(min(9));
    const stages = calculateStages(workout.stages);
    expect(stages[stages.length - 1].to).toEqual(min(40));
  });

  it('is forgiving about case and spacing', () => {
    expect(summary('  4 X 4:00 @ 184 BPM ')).toHaveLength(9);
  });

  it('rejects a total shorter than the block', () => {
    expect(() => parseWatchWorkout('21:00@169 20:00')).toThrow(/shorter/);
  });

  it('rejects implausible heart rates and durations', () => {
    expect(() => parseWatchWorkout('21:00@1690')).toThrow(/bpm/);
    expect(() => parseWatchWorkout('21:75@169')).toThrow(/duration/);
    expect(() => parseWatchWorkout('0:00@169')).toThrow(/longer/);
  });

  it('rejects text it cannot read', () => {
    expect(() => parseWatchWorkout('')).toThrow(/Couldn't read/);
    expect(() => parseWatchWorkout('Baza')).toThrow(/Couldn't read/);
    expect(() => parseWatchWorkout('143 31:00 12')).toThrow(/Couldn't read/);
  });
});

describe('extractWatchWorkout', () => {
  it('reads a steady workout screen', () => {
    expect(extractWatchWorkout('JUTRO\nBaza\n143bpm\n31:00\n')).toEqual({
      name: 'Baza',
      text: '143bpm 31:00',
    });
  });

  it('reads a block workout screen', () => {
    expect(extractWatchWorkout('PIĄTEK\nPróg\n21:00@169bpm\n41:00\n')).toEqual({
      name: 'Próg',
      text: '21:00@169bpm 41:00',
    });
  });

  it('fixes the usual misreads around numbers', () => {
    expect(extractWatchWorkout('JUTRO\nBaza N\n143bprn\n31.00\n[|')).toEqual({
      name: 'Baza',
      text: '143bpm 31:00',
    });
    expect(extractWatchWorkout('PIATEK\nPrég\n2l:OO©169 hpm\n4l:00')?.text).toBe(
      '21:00@169bpm 41:00'
    );
  });

  it('takes the name nearest the numbers, skipping noise and the day header', () => {
    expect(extractWatchWorkout('PIATEK\neee |\npreg\n21:00@169bpm\n41:00')?.name).toBe('Preg');
    expect(extractWatchWorkout('TODAY\n21:00@169bpm\n41:00')?.name).toBeUndefined();
  });

  it('reads intervals', () => {
    expect(extractWatchWorkout('VO2 Max\n5x3:00@180bpm\n45:00')).toEqual({
      name: 'VO2 Max',
      text: '5x3:00@180bpm 45:00',
    });
  });

  it("doesn't split a misread number into a plausible one", () => {
    expect(extractWatchWorkout('Prog\n271:00@169hpm\n471.00')).toBeNull();
  });

  it('returns null without a workout', () => {
    expect(extractWatchWorkout('')).toBeNull();
    expect(extractWatchWorkout('GARMIN\n12:45')).toBeNull();
    expect(extractWatchWorkout('Baza\n143bpm')).toBeNull();
  });

  it('produces text parseWatchWorkout accepts', () => {
    const extracted = extractWatchWorkout('PIĄTEK\nPróg\n21:00@169bpm\n41:00')!;
    expect(summary(extracted.text)).toHaveLength(3);
  });
});
