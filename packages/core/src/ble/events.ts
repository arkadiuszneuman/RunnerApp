export type RunState = {
  status: string;
  currentSpeed: number;
  currentIncline: number;
};

export type TreadmillEvent =
  | { type: 'btConnected' | 'btDisconnected' }
  | { type: 'btStarting' | 'btStopped' | 'btRunning'; state: RunState }
  | { type: 'btSpeedInfo'; state: { minSpeed: number; maxSpeed: number; unitSpeed: number } };
