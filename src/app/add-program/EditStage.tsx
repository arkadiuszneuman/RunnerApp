'use client';

import { useState } from 'react';
import { Timespan } from '@/services/Timespan';
import { Stage, StageType } from '@/services/stagesCalculator';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import dayjs from 'dayjs';

export default function EditStage(props: {
  stage: Stage;
  onStageAdded?: (stage: Stage) => void;
  onCancel?: () => void;
}) {
  const [stage, setStage] = useState(props.stage);
  const [basedOn, setBasedOn] = useState<'tempo' | 'bmp'>('tempo');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    props.onStageAdded?.(stage);
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{ gap: 2, display: 'flex', flexDirection: 'column' }}
    >
      <FormControl fullWidth>
        <InputLabel>Type</InputLabel>
        <Select
          value={stage.type}
          onChange={(e) => setStage((prev) => ({ ...prev, type: e.target.value as StageType }))}
          label="Type"
        >
          <MenuItem value="simple">Simple</MenuItem>
          <MenuItem value="sprint">Sprint</MenuItem>
          <MenuItem value="regeneration">Regeneration</MenuItem>
        </Select>
      </FormControl>

      <Box sx={{ display: 'flex', gap: 2 }}>
        <TimePicker
          label="Segment time"
          ampm={false}
          maxTime={dayjs('1977-01-01T12:59:59')}
          views={['hours', 'minutes', 'seconds']}
          value={dayjs({
            hour: stage.duration.hours,
            minute: stage.duration.minutes,
            second: stage.duration.seconds,
          })}
          selectedSections={'empty'}
          onChange={(e) => {
            setStage(
              (prev) =>
                ({
                  ...prev,
                  duration: Timespan.fromHours(Number(e?.hour()))
                    .add(Timespan.fromMinutes(Number(e?.minute())))
                    .add(Timespan.fromSeconds(Number(e?.second()))),
                }) satisfies Stage
            );
          }}
        />
      </Box>

      <FormControl fullWidth>
        <InputLabel>Based on</InputLabel>
        <Select
          value={basedOn}
          onChange={(e) => setBasedOn(e.target.value as typeof basedOn)}
          label="Type"
        >
          <MenuItem value="tempo">Tempo</MenuItem>
          <MenuItem value="bmp">Bmp</MenuItem>
        </Select>
      </FormControl>

      {basedOn === 'bmp' && (
        <TextField
          label="BPM"
          type="number"
          value={'bmp' in stage ? stage.bmp : ''}
          onChange={(e) =>
            setStage(
              (prev) =>
                ({
                  duration: prev.duration,
                  type: prev.type,
                  bmp: Number(e.target.value),
                }) satisfies Stage
            )
          }
        />
      )}

      {basedOn === 'tempo' && (
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TimePicker
            label="Tempo min/km"
            ampm={false}
            maxTime={dayjs('1977-01-01T00:15:00')}
            minTime={dayjs('1977-01-01T00:01:00')}
            views={['minutes', 'seconds']}
            value={dayjs({
              minute: 'tempo' in stage ? stage.tempo.minutes : 0,
              second: 'tempo' in stage ? stage.tempo.seconds : 0,
            })}
            selectedSections={'empty'}
            onChange={(e) => {
              setStage((prev) => ({
                ...prev,
                tempo: Timespan.fromMinutes(Number(e?.minute())).add(
                  Timespan.fromSeconds(Number(e?.second()))
                ),
              }));
            }}
          />
        </Box>
      )}
      <Stack direction="row" spacing={1}>
        <Button variant="outlined" color="secondary" sx={{ mt: 2 }} onClick={props.onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" color="secondary" sx={{ mt: 2 }}>
          Add
        </Button>
      </Stack>
    </Box>
  );
}
