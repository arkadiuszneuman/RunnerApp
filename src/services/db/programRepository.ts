'use client';

import { Stage, StageType } from '../stagesCalculator';
import { Timespan } from '../Timespan';

let currentProgram: ({
  duration: number;
  type: StageType;
} & (
  | {
      bmp: number;
      speedType: 'bmp';
    }
  | {
      tempo: number;
      speedType: 'tempo';
    }
))[] = [];

export async function getCurrentProgram(): Promise<Stage[]> {
  return currentProgram.map((x) =>
    x.speedType === 'tempo'
      ? {
          duration: new Timespan(x.duration),
          type: x.type,
          tempo: new Timespan(x.tempo),
          speedType: 'tempo',
        }
      : {
          duration: new Timespan(x.duration),
          type: x.type,
          bmp: x.bmp,
          speedType: 'bmp',
        }
  );
}

export async function updateCurrentProgram(stages: Stage[]) {
  currentProgram = stages.map((x) =>
    x.speedType === 'tempo'
      ? {
          duration: x.duration.totalMilliseconds,
          type: x.type,
          tempo: x.tempo.totalMilliseconds,
          speedType: 'tempo',
        }
      : {
          duration: x.duration.totalMilliseconds,
          type: x.type,
          bmp: x.bmp,
          speedType: 'bmp',
        }
  );
}
