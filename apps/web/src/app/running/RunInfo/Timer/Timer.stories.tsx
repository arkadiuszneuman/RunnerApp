import type { Meta, StoryObj } from '@storybook/react';
import Timer from './Timer';

const meta = {
  title: 'Run/Timer',
  component: Timer,
  parameters: {},
  argTypes: {
    progress: {
      control: {
        type: 'range',
        min: 0,
        max: 100,
        step: 1,
      },
    },
  },
  args: {
    progress: 30,
    primaryText: '12:43',
    primaryTextInfo: 'Time left',
    secondaryText: '2/12',
    secondaryTextInfo: 'Stage',
  },
} satisfies Meta<typeof Timer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
