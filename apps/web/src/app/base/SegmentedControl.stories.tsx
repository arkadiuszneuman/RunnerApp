import { useState } from 'react';
import Box from '@mui/material/Box';
import type { Meta, StoryObj } from '@storybook/react';
import { tokens } from '../theme';
import SegmentedControl from './SegmentedControl';

const OPTIONS = [
  { value: 'run', label: 'Run', color: tokens.cyan },
  { value: 'sprint', label: 'Sprint', color: tokens.heart },
  { value: 'recovery', label: 'Recovery', color: tokens.violet },
] as const;

function Demo() {
  const [value, setValue] = useState<(typeof OPTIONS)[number]['value']>('run');
  return (
    <Box sx={{ width: 320 }}>
      <SegmentedControl aria-label="Stage type" value={value} onChange={setValue} options={OPTIONS} />
    </Box>
  );
}

const meta = {
  title: 'Base/SegmentedControl',
  component: Demo,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

function TwoOptionsDemo() {
  const [value, setValue] = useState<'legacy' | 'adaptive'>('legacy');
  return (
    <Box sx={{ width: 260 }}>
      <SegmentedControl
        aria-label="Speed controller"
        value={value}
        onChange={setValue}
        options={[
          { value: 'legacy', label: 'Classic', color: tokens.amber },
          { value: 'adaptive', label: 'Adaptive', color: tokens.cyan },
        ]}
      />
    </Box>
  );
}

export const TwoOptions: Story = {
  render: () => <TwoOptionsDemo />,
};

export const Disabled: Story = {
  render: () => (
    <Box sx={{ width: 320 }}>
      <SegmentedControl aria-label="Stage type" value="sprint" onChange={() => {}} disabled options={OPTIONS} />
    </Box>
  ),
};
