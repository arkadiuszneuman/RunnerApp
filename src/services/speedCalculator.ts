import { Timespan } from '@/services/Timespan';

export function calculateSpeedByHeartRate(heartRate: number, targetHeartRate: number, oldSpeed: number, segmentTime?: Timespan): number {
  function getMultiplier(): number {
    if (!segmentTime || segmentTime.totalMinutes >= 9) {
      return 1
    }

    return (10 - segmentTime.totalMinutes) / 2
  }


  const multiplier = getMultiplier()
  const diff = targetHeartRate - heartRate;
  if (Math.abs(diff) > 5) {
    const newDiff = diff * multiplier;
    const newSpeed = Math.max(
      1,
      Math.min(18, Math.round((oldSpeed + newDiff / 100) * 10) / 10)
    );

    return newSpeed;
  }

  return oldSpeed
}

export function calculateSpeedByTempo(tempo: Timespan): number {
  const newSpeed = Math.max(
    1,
    Math.min(18, Math.round((60 / tempo.totalMinutes) * 10) / 10)
  );

  return newSpeed;
}