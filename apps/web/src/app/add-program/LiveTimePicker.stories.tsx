import { useState } from 'react';
import Box from '@mui/material/Box';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import type { Meta, StoryObj } from '@storybook/react';
import dayjs, { type Dayjs } from 'dayjs';
import objectSupport from 'dayjs/plugin/objectSupport';
import LiveTimePicker from './LiveTimePicker';

dayjs.extend(objectSupport);

function Demo() {
  const [duration, setDuration] = useState<Dayjs | null>(dayjs({ hour: 0, minute: 5, second: 30 }));
  const [tempo, setTempo] = useState<Dayjs | null>(dayjs({ minute: 5, second: 0 }));
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ width: 320, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <LiveTimePicker
          label="Segment time"
          ampm={false}
          maxTime={dayjs('1977-01-01T12:59:59')}
          views={['hours', 'minutes', 'seconds']}
          value={duration}
          onChange={setDuration}
          slotProps={{ textField: { fullWidth: true } }}
        />
        <LiveTimePicker
          label="Tempo min/km"
          ampm={false}
          maxTime={dayjs('1977-01-01T00:15:00')}
          minTime={dayjs('1977-01-01T00:01:00')}
          views={['minutes', 'seconds']}
          value={tempo}
          onChange={setTempo}
          slotProps={{ textField: { fullWidth: true } }}
        />
      </Box>
    </LocalizationProvider>
  );
}

const meta = {
  title: 'Program builder/LiveTimePicker',
  component: Demo,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
