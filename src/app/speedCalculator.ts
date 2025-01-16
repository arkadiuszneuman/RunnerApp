export function calculateSpeed(heartRate: number, targetHeartRate: number, oldSpeed: number): number {
  const diff = targetHeartRate - heartRate;
  if (Math.abs(diff) > 5) {
    const newDiff = diff > 0 ? diff : diff * 4
    const newSpeed = Math.max(
      1,
      Math.min(18, Math.round((oldSpeed + newDiff / 100) * 10) / 10)
    );

    return newSpeed;
  }

  return oldSpeed
}