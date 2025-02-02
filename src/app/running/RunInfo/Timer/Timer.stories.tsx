import type { Meta, StoryObj } from '@storybook/react';
import Timer from './Timer';

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: 'Run/Timer',
  component: Timer,
  parameters: {},
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs

  // More on argTypes: https://storybook.js.org/docs/api/argtypes
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

// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const Primary: Story = {};
