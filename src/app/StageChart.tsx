'use client';

import Box from '@mui/material/Box';
import { useAtomValue } from 'jotai';
import { stagesAtom } from './atoms';

import { LineChart, Line, Tooltip, ResponsiveContainer, YAxis, XAxis, Area } from 'recharts';

export default function StageChart() {
  const stages = useAtomValue(stagesAtom);

  return (
    <Box>
      {stages.length > 0 && (
        <ResponsiveContainer width="100%" height={100}>
          <LineChart
            data={(() => {
              // Each stage has 'from' and 'to' as Timespan, use them for X axis
              const points: any[] = [];
              if (stages.length === 0) return points;
              // Always start at 0s with no value
              points.push({ time: 0, bpm: null, tempo: null, type: 'simple' });
              for (const stage of stages) {
                // Add a point at the start of the stage
                points.push(
                  {
                    time: stage.from.totalSeconds,
                    bpm: stage.speedType === 'bmp' ? stage.bmp : null,
                    tempo: stage.speedType === 'tempo' ? stage.duration?.totalSeconds : null,
                    type: stage.type,
                  },
                  {
                    time: stage.to.totalSeconds,
                    bpm: stage.speedType === 'bmp' ? stage.bmp : null,
                    tempo: stage.speedType === 'tempo' ? stage.duration?.totalSeconds : null,
                    type: stage.type,
                  }
                );
              }
              return points;
            })()}
            margin={{ top: 20, right: 30, left: 10, bottom: 10 }}
          >
            <YAxis
              type="number"
              domain={[
                (dataMin: number) => (typeof dataMin === 'number' ? dataMin - 20 : 0),
                'auto',
              ]}
              allowDataOverflow={true}
              tick={false}
              axisLine={false}
            />
            <XAxis dataKey="time" type="number" domain={[0, 'auto']} hide={true} />
            <Tooltip
              formatter={(value: any, name: string, props: any) => {
                if (name === 'bpm' && value != null) return [`${value} bpm`, 'Heart Rate'];
                if (name === 'tempo' && value != null) return [`${value} s`, 'Tempo'];
                return [value, name];
              }}
              contentStyle={{
                backgroundColor: '#fff',
                borderRadius: 8,
                border: '1px solid #1976d2',
              }}
              labelStyle={{ fontWeight: 'bold', color: '#1976d2' }}
            />
            {/* Fill area under the lines */}
            <Area
              type="step"
              dataKey="bpm"
              stroke="#1976d2"
              fill="#1976d2"
              fillOpacity={0.15}
              connectNulls
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            <Area
              type="step"
              dataKey="tempo"
              stroke="#ff9800"
              fill="#ff9800"
              fillOpacity={0.15}
              connectNulls
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            {/* Chart lines */}
            <Line
              type="step"
              dataKey="bpm"
              name="Heart Rate (bpm)"
              stroke="#1976d2"
              strokeWidth={3}
              connectNulls
              dot={false}
              activeDot={false}
            />
            <Line
              type="step"
              dataKey="tempo"
              name="Tempo (s)"
              stroke="#ff9800"
              strokeWidth={3}
              connectNulls
              dot={false}
              activeDot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Box>
  );
}
