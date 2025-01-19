/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, describe, it } from "vitest";
import calculateStages, { MultiplyStage, Stage } from './stagesCalculator';
import { Timespan } from './Timespan';

describe('calculateStages', () => {
  it('should handle empty array of stages', () => {
    expect(calculateStages([])).toStrictEqual([]);
  });

  it('should calculate total seconds when given stages with minutes', () => {
    const stages = [
      { duration: Timespan.fromMinutes(15), bmp: 145, type: 'simple' },
      {
        times: 2, stages: [
          {
            duration: Timespan.fromSeconds(40), tempo: Timespan.fromMinutes(3).add(Timespan.fromSeconds(40)), type: 'sprint'
          },
          {
            duration: Timespan.fromMinutes(3), bmp: 132, type: 'regeneration'
          }
        ]
      },
      { duration: Timespan.fromMinutes(10), bmp: 145, type: 'simple' },
    ] satisfies (Stage | MultiplyStage)[];

    const result = calculateStages(stages)

    expect(result.map(({ from, to, type, ...rest }) => rest)).toStrictEqual([
      { time: Timespan.fromMinutes(14).add(Timespan.fromSeconds(50)), bmp: 145 },

      { time: Timespan.fromSeconds(50), tempo: Timespan.fromMinutes(3).add(Timespan.fromSeconds(40)) },
      { time: Timespan.fromMinutes(2).add(Timespan.fromSeconds(50)), bmp: 132 },

      { time: Timespan.fromSeconds(50), tempo: Timespan.fromMinutes(3).add(Timespan.fromSeconds(40)) },

      { time: Timespan.fromMinutes(10), bmp: 145 },
    ]);
  });

  it('should calculate total real example', () => {
    const stages = [
      { duration: Timespan.fromMinutes(10), bmp: 145, type: 'simple' },
      {
        times: 3, stages: [
          {
            duration: Timespan.fromMinutes(6), bmp: 172, type: 'sprint'
          },
          {
            duration: Timespan.fromMinutes(2), bmp: 132, type: 'regeneration'
          }
        ]
      },
      { duration: Timespan.fromMinutes(10), bmp: 145, type: 'simple' },
    ] satisfies (Stage | MultiplyStage)[];

    const result = calculateStages(stages)

    expect(result.map(({ from, to, type, ...rest }) => rest)).toStrictEqual([
      { time: Timespan.fromMinutes(9).add(Timespan.fromSeconds(50)), bmp: 145 },

      { time: Timespan.fromMinutes(6).add(Timespan.fromSeconds(10)), bmp: 172 },
      { time: Timespan.fromMinutes(1).add(Timespan.fromSeconds(50)), bmp: 132 },
      { time: Timespan.fromMinutes(6).add(Timespan.fromSeconds(10)), bmp: 172 },
      { time: Timespan.fromMinutes(1).add(Timespan.fromSeconds(50)), bmp: 132 },
      { time: Timespan.fromMinutes(6).add(Timespan.fromSeconds(10)), bmp: 172 },

      { time: Timespan.fromMinutes(10), bmp: 145 },
    ]);
  });
});