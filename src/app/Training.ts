import { calculateSpeedByTempo } from "@/services/speedCalculator";
import { Stage } from "@/services/stagesCalculator";

export default class Training {
  private treadmillSpeed: number;
  private readonly minSpeed: number = 1; // km/h
  private readonly maxSpeed: number = 18; // km/h
  private lastError: number = 0;
  private integral: number = 0;
  private lastCurrentSection?: Stage;
  private previousHeartRate: number = 0;

  // Default PID constants
  private kp: number = 0.003;
  private ki: number = 0.000001;
  private kd: number = 0.14;

  constructor(initialSpeed: number) {
    this.treadmillSpeed = initialSpeed;
  }

  // Update the training logic
  public update(currentHeartRate: number, currentSection: Stage, deltaTime: number): number {
    if ('tempo' in currentSection) {
      return calculateSpeedByTempo(currentSection.tempo);
    }

    // Check if phase time is over
    if (this.lastCurrentSection !== currentSection) {
      this.lastCurrentSection = currentSection;
      this.integral = 0; // Reset integral to avoid carryover
    }

    // Adjust PID parameters for aggressive phases
    // if (currentSection.duration.totalMinutes <= 3) {
    //   this.kp = 0.2; // More aggressive response
    //   this.kd = 0.1;
    // } else {
    //   this.kp = 0.05; // Default response
    //   this.kd = 0.05;
    // }

    if (currentHeartRate >= 8) {
      currentHeartRate = currentHeartRate - 8;
    }

    // Calculate error
    if (this.previousHeartRate === 0) {
      this.previousHeartRate = currentHeartRate;
    }
    const heartRateTrend = (currentHeartRate - this.previousHeartRate) / deltaTime;
    const predictedHeartRate = currentHeartRate + heartRateTrend * 10; // Prediction after 10 seconds
    const error = currentSection.bmp - predictedHeartRate;

    // Update integral and derivative
    this.integral += error * deltaTime;
    this.integral = Math.max(Math.min(this.integral, 100), -100); // Anti-windup
    const derivative = (error - this.lastError) / deltaTime;

    // PID formula
    const adjustment = this.kp * error + this.ki * this.integral + this.kd * derivative;

    // Update treadmill speed
    this.treadmillSpeed += adjustment;
    this.treadmillSpeed = Math.round(Math.max(this.minSpeed, Math.min(this.treadmillSpeed, this.maxSpeed)) * 10) / 10;

    // Save last error
    this.lastError = error;

    return this.treadmillSpeed;
  }
}