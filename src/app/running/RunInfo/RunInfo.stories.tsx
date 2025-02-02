import { heartRateAtom, programAtom, runningStateAtom } from '@/app/atoms';
import { Timespan } from '@/services/Timespan';
import { atomsForStorybook } from '@alexgorbatchev/storybook-addon-jotai';
import type { Meta, StoryObj } from '@storybook/react';
import RunInfo from './RunInfo';

const meta = {
  title: 'Run/RunInfo',
  component: RunInfo,
  parameters: {
    jotai: atomsForStorybook({
      atoms: {
        heartRate: heartRateAtom,
        runningState: runningStateAtom,
        program: programAtom,
      },
      values: {
        heartRate: 123,
        runningState: {
          running: true,
          runningStartedDate: new Date('2025-01-02 12:32:42'),
          runningTime: Timespan.parse('12:32'),
          treadmillOptions: {
            incline: 2,
            speed: 14.3,
          },
        },
        program: [
          {
            bmp: 145,
            duration: Timespan.parse('15:00'),
            type: 'simple',
          },
          {
            bmp: 170,
            duration: Timespan.parse('20:00'),
            type: 'sprint',
          },
          {
            tempo: Timespan.parse('4:30'),
            duration: Timespan.parse('5:00'),
            type: 'sprint',
          },
        ],
      },
    }),
  },
} satisfies Meta<typeof RunInfo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
