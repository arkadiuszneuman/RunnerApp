'use client'

import { Stage, StageType } from "../../../calc/src/stagesCalculator"
import { Timespan } from "../../../calc/src/Timespan";

let currentProgram: (({
  time: number;
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
        time: new Timespan(x.time),
        type: x.type,
        tempo: new Timespan(x.tempo),
      }
      : {
        time: new Timespan(x.time),
        type: x.type,
        bmp: x.bmp,
      }
  )
}

export async function updateCurrentProgram(stages: Stage[]) {
  currentProgram = stages.map((x) =>
    "tempo" in x
      ? {
        time: x.time.totalMilliseconds,
        type: x.type,
        tempo: x.tempo.totalMilliseconds,
      }
      : {
        time: x.time.totalMilliseconds,
        type: x.type,
        bmp: x.bmp,
      }
  );
}