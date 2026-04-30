export type TelemetryPoint = {
  t: number; // elapsed seconds since run start
  hr: number; // raw heart rate
  thr: number; // target heart rate (0 for tempo stages)
  phr: number; // predicted heart rate — what the PID actually works on
  spd: number; // speed commanded (km/h)
  inc: number; // incline (%)
  si: number; // stage index
  err: number; // PID error = thr - phr (0 for tempo stages)
};
