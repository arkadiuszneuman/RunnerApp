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
      { duration: Timespan.fromMinutes(14).add(Timespan.fromSeconds(50)), bmp: 145 },

      { duration: Timespan.fromSeconds(50), tempo: Timespan.fromMinutes(3).add(Timespan.fromSeconds(40)) },
      { duration: Timespan.fromMinutes(2).add(Timespan.fromSeconds(50)), bmp: 132 },

      { duration: Timespan.fromSeconds(50), tempo: Timespan.fromMinutes(3).add(Timespan.fromSeconds(40)) },

      { duration: Timespan.fromMinutes(10), bmp: 145 },
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
      { duration: Timespan.fromMinutes(9).add(Timespan.fromSeconds(50)), bmp: 145 },

      { duration: Timespan.fromMinutes(6).add(Timespan.fromSeconds(10)), bmp: 172 },
      { duration: Timespan.fromMinutes(1).add(Timespan.fromSeconds(50)), bmp: 132 },
      { duration: Timespan.fromMinutes(6).add(Timespan.fromSeconds(10)), bmp: 172 },
      { duration: Timespan.fromMinutes(1).add(Timespan.fromSeconds(50)), bmp: 132 },
      { duration: Timespan.fromMinutes(6).add(Timespan.fromSeconds(10)), bmp: 172 },

      { duration: Timespan.fromMinutes(10), bmp: 145 },
    ]);
  });

  it('first sprint shouldn\'t be minus', () => {
    const stages = [
      { duration: Timespan.fromMinutes(15), bmp: 145, type: 'sprint' },
    ] satisfies (Stage | MultiplyStage)[];

    const result = calculateStages(stages)

    expect(result.map(({ from, to, type, ...rest }) => rest)).toStrictEqual([
      { duration: Timespan.fromMinutes(15), bmp: 145 },
    ]);
  });

  it('create one stage if one times', () => {
    const stages = [
      {
        times: 1, stages: [
          { duration: Timespan.fromMinutes(15), bmp: 145, type: 'simple' },
          { duration: Timespan.fromMinutes(10), bmp: 145, type: 'simple' }
        ]
      }
    ] satisfies MultiplyStage[];

    const result = calculateStages(stages)

    expect(result.map(({ from, to, type, ...rest }) => rest)).toStrictEqual([
      { duration: Timespan.fromMinutes(15), bmp: 145 },
      { duration: Timespan.fromMinutes(10), bmp: 145 },
    ]);
  });

  it('create two stage if two times', () => {
    const stages = [
      {
        times: 2, stages: [
          { duration: Timespan.fromMinutes(15), bmp: 145, type: 'simple' },
          { duration: Timespan.fromMinutes(10), bmp: 145, type: 'simple' }
        ]
      }
    ] satisfies MultiplyStage[];

    const result = calculateStages(stages)

    expect(result.map(({ from, to, type, ...rest }) => rest)).toStrictEqual([
      { duration: Timespan.fromMinutes(15), bmp: 145 },
      { duration: Timespan.fromMinutes(10), bmp: 145 },
      { duration: Timespan.fromMinutes(15), bmp: 145 },
    ]);
  });
});