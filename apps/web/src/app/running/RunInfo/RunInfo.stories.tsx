import { heartRateAtom, programAtom, runningStateAtom } from '@/app/atoms';
import Box from '@mui/material/Box';
import { Timespan } from '@runner/core';
import { atomsForStorybook } from '@alexgorbatchev/storybook-addon-jotai';
import type { Meta, StoryObj } from '@storybook/react';
import RunInfo from './RunInfo';

/**
 * RunInfo is only ever mounted inside running/page.tsx's fixed-height, non-scrolling column (see
 * useFitPriority.ts) — this decorator reproduces that bounded height so its "hide the lowest-
 * priority section that doesn't fit" behavior is visible/testable in isolation. `height` mimics
 * how much room is left after the header/ActionBar on a real device.
 */
function fixedHeightDecorator(height: number) {
  return function Decorator(Story: React.ComponentType) {
    return (
      <Box
        data-testid="fit-box"
        sx={{
          width: 380,
          height,
          display: 'flex',
          flexDirection: 'column',
          outline: '1px dashed #444',
        }}
      >
        <Story />
      </Box>
    );
  };
}

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
            isCustomSpeedUsed: false,
            isManualSpeedActive: false,
          },
          paused: false,
        },
        program: [
          {
            times: 1,
            stages: [
              {
                speedType: 'bmp',
                bmp: 145,
                duration: Timespan.parse('15:00'),
                type: 'simple',
              },
            ],
          },
          {
            times: 1,
            stages: [
              {
                speedType: 'bmp',
                bmp: 170,
                duration: Timespan.parse('20:00'),
                type: 'sprint',
              },
            ],
          },
          {
            times: 1,
            stages: [
              {
                speedType: 'tempo',
                tempo: Timespan.parse('4:30'),
                duration: Timespan.parse('5:00'),
                type: 'sprint',
              },
            ],
          },
        ],
      },
    }),
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Tall: Story = { decorators: [fixedHeightDecorator(820)] };
export const Medium: Story = { decorators: [fixedHeightDecorator(620)] };
export const Short: Story = { decorators: [fixedHeightDecorator(460)] };
export const VeryShort: Story = { decorators: [fixedHeightDecorator(340)] };
