'use client'

import { Stage, StageType } from "../../../calc/src/stagesCalculator"
import { Timespan } from "../../../calc/src/Timespan";

let currentProgram: (({
  duration: number;
  type: StageType;
}) & ({
  bmp: number;
} | {
  tempo: number;
}))[] = []

export async function getCurrentProgram(): Promise<Stage[]> {
  return currentProgram.map((x) =>
    "tempo" in x
      ? {
        duration: new Timespan(x.duration),
        type: x.type,
        tempo: new Timespan(x.tempo),
      }
      : {
        duration: new Timespan(x.duration),
        type: x.type,
        bmp: x.bmp,
      }
  )
}

export async function updateCurrentProgram(stages: Stage[]) {
  currentProgram = stages.map((x) =>
    "tempo" in x
      ? {
        duration: x.duration.totalMilliseconds,
        type: x.type,
        tempo: x.tempo.totalMilliseconds,
      }
      : {
        duration: x.duration.totalMilliseconds,
        type: x.type,
        bmp: x.bmp,
      }
  );
}