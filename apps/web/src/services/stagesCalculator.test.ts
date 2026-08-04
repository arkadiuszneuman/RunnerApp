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
      { duration: Timespan.fromMinutes(15), bmp: 145, speedType: 'bmp', type: 'simple' },
      {
        times: 2, stages: [
          {
            duration: Timespan.fromSeconds(40), tempo: Timespan.fromMinutes(3).add(Timespan.fromSeconds(40)), speedType: 'tempo', type: 'sprint'
          },
          {
            duration: Timespan.fromMinutes(3), bmp: 132, speedType: 'bmp', type: 'regeneration'
          }
        ]
      },
      { duration: Timespan.fromMinutes(10), bmp: 145, speedType: 'bmp', type: 'simple' },
    ] satisfies (Stage | MultiplyStage)[];

    const result = calculateStages(stages)

    expect(result.map(({ from, to, type, ...rest }) => rest)).toStrictEqual([
      { duration: Timespan.fromMinutes(14).add(Timespan.fromSeconds(50)), bmp: 145, speedType: 'bmp' },

      { duration: Timespan.fromSeconds(50), tempo: Timespan.fromMinutes(3).add(Timespan.fromSeconds(40)), speedType: 'tempo' },
      { duration: Timespan.fromMinutes(2).add(Timespan.fromSeconds(50)), bmp: 132, speedType: 'bmp' },

      { duration: Timespan.fromSeconds(50), tempo: Timespan.fromMinutes(3).add(Timespan.fromSeconds(40)), speedType: 'tempo' },

      { duration: Timespan.fromMinutes(10), bmp: 145, speedType: 'bmp' },
    ]);
  });

  it('should calculate total real example', () => {
    const stages = [
      { duration: Timespan.fromMinutes(10), bmp: 145, speedType: 'bmp', type: 'simple' },
      {
        times: 3, stages: [
          {
            duration: Timespan.fromMinutes(6), bmp: 172, speedType: 'bmp', type: 'sprint'
          },
          {
            duration: Timespan.fromMinutes(2), bmp: 132, speedType: 'bmp', type: 'regeneration'
          }
        ]
      },
      { duration: Timespan.fromMinutes(10), bmp: 145, speedType: 'bmp', type: 'simple' },
    ] satisfies (Stage | MultiplyStage)[];

    const result = calculateStages(stages)

    expect(result.map(({ from, to, type, ...rest }) => rest)).toStrictEqual([
      { duration: Timespan.fromMinutes(9).add(Timespan.fromSeconds(50)), bmp: 145, speedType: 'bmp' },

      { duration: Timespan.fromMinutes(6).add(Timespan.fromSeconds(10)), bmp: 172, speedType: 'bmp' },
      { duration: Timespan.fromMinutes(1).add(Timespan.fromSeconds(50)), bmp: 132, speedType: 'bmp' },
      { duration: Timespan.fromMinutes(6).add(Timespan.fromSeconds(10)), bmp: 172, speedType: 'bmp' },
      { duration: Timespan.fromMinutes(1).add(Timespan.fromSeconds(50)), bmp: 132, speedType: 'bmp' },
      { duration: Timespan.fromMinutes(6).add(Timespan.fromSeconds(10)), bmp: 172, speedType: 'bmp' },

      { duration: Timespan.fromMinutes(10), bmp: 145, speedType: 'bmp' },
    ]);
  });

  it('first sprint shouldn\'t be minus', () => {
    const stages = [
      { duration: Timespan.fromMinutes(15), bmp: 145, speedType: 'bmp', type: 'sprint' },
    ] satisfies (Stage | MultiplyStage)[];

    const result = calculateStages(stages)

    expect(result.map(({ from, to, type, ...rest }) => rest)).toStrictEqual([
      { duration: Timespan.fromMinutes(15), bmp: 145, speedType: 'bmp' },
    ]);
  });

  it('create one stage if one times', () => {
    const stages = [
      {
        times: 1, stages: [
          { duration: Timespan.fromMinutes(15), bmp: 145, speedType: 'bmp', type: 'simple' },
          { duration: Timespan.fromMinutes(10), bmp: 145, speedType: 'bmp', type: 'simple' }
        ]
      }
    ] satisfies MultiplyStage[];

    const result = calculateStages(stages)

    expect(result.map(({ type, ...rest }) => rest)).toStrictEqual([
      { duration: Timespan.fromMinutes(15), bmp: 145, speedType: 'bmp', from: Timespan.parse('00:00'), to: Timespan.parse('15:00') },
      { duration: Timespan.fromMinutes(10), bmp: 145, speedType: 'bmp', from: Timespan.parse('15:00'), to: Timespan.parse('25:00') },
    ]);
  });

  it('create proper stages for short stages', () => {
    const stages = [
      {
        times: 1, stages: [
          { duration: Timespan.parse('00:05'), bmp: 145, speedType: 'bmp', type: 'simple' },
          { duration: Timespan.parse('00:15'), bmp: 145, speedType: 'bmp', type: 'sprint' }
        ]
      }
    ] satisfies MultiplyStage[];

    const result = calculateStages(stages)

    expect(result.map(({ type, ...rest }) => rest)).toStrictEqual([
      { duration: Timespan.parse('00:00'), bmp: 145, speedType: 'bmp', from: Timespan.parse('00:00'), to: Timespan.parse('00:00') },
      { duration: Timespan.parse('00:20'), bmp: 145, speedType: 'bmp', from: Timespan.parse('00:00'), to: Timespan.parse('00:20') },
    ]);
  });

  it('create two stage if two times', () => {
    const stages = [
      {
        times: 2, stages: [
          { duration: Timespan.fromMinutes(15), bmp: 145, speedType: 'bmp', type: 'simple' },
          { duration: Timespan.fromMinutes(10), bmp: 145, speedType: 'bmp', type: 'simple' }
        ]
      }
    ] satisfies MultiplyStage[];

    const result = calculateStages(stages)

    expect(result.map(({ from, to, type, ...rest }) => rest)).toStrictEqual([
      { duration: Timespan.fromMinutes(15), bmp: 145, speedType: 'bmp' },
      { duration: Timespan.fromMinutes(10), bmp: 145, speedType: 'bmp' },
      { duration: Timespan.fromMinutes(15), bmp: 145, speedType: 'bmp' },
    ]);
  });
});