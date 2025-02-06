'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface SimulationData {
  time: number;
  heartRate: number;
  speed: number;
}

const HeartRateVisualization: React.FC = () => {
  const [simulationResults, setSimulationResults] = useState<SimulationData[]>([]);
  const [kp, setKp] = useState<number>(0.023);
  const [ki, setKi] = useState<number>(0);
  const [kd, setKd] = useState<number>(0.286);

  const simulate = useCallback((kp: number, ki: number, kd: number) => {
    const results: SimulationData[] = [];

    const simulationTime = 60 * 10; // 30 minutes in seconds
    const deltaTime = 1; // step in seconds

    let currentHeartRate = 70; // starting heart rate (bpm)
    let treadmillSpeed = 1; // starting treadmill spead (km/h)
    let targetHeartRate = 150;

    let integral = 0;
    let lastError = 0;

    let accumulatedSpeedEffect = 0;

    for (let t = 0; t <= simulationTime; t += deltaTime) {
      // if (t >= 60 * 10) {
      //   targetHeartRate = 180;
      // }
      // if (t >= 60 * 12) {
      //   targetHeartRate = 150;
      // }
      // if (t >= 60 * 22) {
      //   targetHeartRate = 180;
      // }
      // if (t >= 60 * 24) {
      //   targetHeartRate = 150;
      // }
      const error = targetHeartRate - currentHeartRate;

      // PID calculations
      integral += error * deltaTime;
      const derivative = (error - lastError) / deltaTime;
      const adjustment = kp * error + ki * integral + kd * derivative;

      // Update speed (clamped to limits)
      treadmillSpeed = Math.max(1, Math.min(18, treadmillSpeed + adjustment));

      // Simulate heart rate response
      const heartRateResponseDelay = 30; // Opóźnienie reakcji w sekundach
      const fitnessFactor = 0.3; // Współczynnik reakcji tętna
      accumulatedSpeedEffect +=
        (treadmillSpeed - 6) * fitnessFactor * (deltaTime / heartRateResponseDelay);
      const heartRateAdjustment = accumulatedSpeedEffect;
      currentHeartRate += heartRateAdjustment;
      currentHeartRate = Math.max(40, Math.min(currentHeartRate, 190));

      // Update last error
      lastError = error;

      // Save the results
      results.push({
        time: t,
        heartRate: Math.round(currentHeartRate),
        speed: treadmillSpeed,
      });
    }

    setSimulationResults(results);
  }, []);

  useEffect(() => {
    simulate(kp, ki, kd);
  }, [kp, ki, kd, simulate]);

  const chartData = {
    labels: simulationResults.map((data) => data.time),
    datasets: [
      {
        label: 'Heart Rate (bpm)',
        data: simulationResults.map((data) => data.heartRate),
        borderColor: 'red',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        yAxisID: 'y',
      },
      {
        label: 'Speed (km/h)',
        data: simulationResults.map((data) => data.speed),
        borderColor: 'blue',
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        yAxisID: 'y1',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Treadmill Speed and Heart Rate Simulation',
      },
    },
    scales: {
      y: {
        min: 0,
        max: 200,
        type: 'linear' as const,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Heart Rate (bpm)',
        },
      },
      y1: {
        min: 1,
        max: 18,
        type: 'linear' as const,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Speed (km/h)',
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  };

  return (
    <div>
      <h1>Treadmill Simulation</h1>
      <div>
        <label>
          Kp:{' '}
          <input
            type="number"
            step="0.001"
            value={kp}
            onChange={(e) => setKp(parseFloat(e.target.value))}
          />
        </label>
        <label>
          Ki:{' '}
          <input
            type="number"
            step="0.00001"
            value={ki}
            onChange={(e) => setKi(parseFloat(e.target.value))}
          />
        </label>
        <label>
          Kd:{' '}
          <input
            type="number"
            step="0.001"
            value={kd}
            onChange={(e) => setKd(parseFloat(e.target.value))}
          />
        </label>
      </div>
      <Line data={chartData} options={chartOptions} />
    </div>
  );
};

export default HeartRateVisualization;
