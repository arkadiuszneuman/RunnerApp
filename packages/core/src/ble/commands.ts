export type CommandKind =
  | 'status'
  | 'start'
  | 'stop'
  | 'incSpeed'
  | 'speedInfo'
  | 'inclineInfo'
  | 'totalInfo'
  | 'sportData';

export interface Command {
  readonly kind: CommandKind;
  readonly payload: readonly number[];
}

export const STATUS_COMMAND: Command = { kind: 'status', payload: [2, 81] };
export const START_COMMAND: Command = { kind: 'start', payload: [2, 83, 1, 0, 0, 0, 0, 0] };
export const STOP_COMMAND: Command = { kind: 'stop', payload: [2, 83, 3] };
export const SPEED_INFO_COMMAND: Command = { kind: 'speedInfo', payload: [2, 80, 2] };
export const INCLINE_INFO_COMMAND: Command = { kind: 'inclineInfo', payload: [2, 80, 3] };
export const TOTAL_INFO_COMMAND: Command = { kind: 'totalInfo', payload: [2, 80, 4] };
export const SPORT_DATA_COMMAND: Command = { kind: 'sportData', payload: [2, 82, 0] };

/** Speed is sent as tenths of km/h (integer). */
export function incSpeedCommand(speedKmh: number, incline: number): Command {
  return { kind: 'incSpeed', payload: [2, 83, 2, speedKmh * 10, incline] };
}
