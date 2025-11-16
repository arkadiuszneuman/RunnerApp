'use client';

import { useEffect, useState } from 'react';
import { Timespan } from '@/services/Timespan';
import { Stage, StageType } from '@/services/stagesCalculator';
import { Input } from '@mui/material';
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
import { useAtom, useSetAtom } from 'jotai';
import _ from 'lodash';
import { programAtom } from '../atoms';
import { editingSectionAtom } from './atoms';

function StageEdit(props: Readonly<{ stage: Stage; onStageChanged?: (stage: Stage) => void }>) {
  const [stage, setStage] = useState(props.stage);

  useEffect(() => {
    if (!_.isEqual(props.stage, stage)) {
      props.onStageChanged?.(stage);
    }
  }, [props, stage]);

  const onBasedOnChanged = (value: 'bmp' | 'tempo') => {
    if (value === 'bmp') {
      setStage(
        (prev) =>
          ({
            ...prev,
            speedType: 'bmp',
            bmp: prev.speedType === 'bmp' ? prev.bmp : 142,
          } satisfies Stage)
      );
    } else {
      setStage((prev) => ({
        ...prev,
        speedType: 'tempo',
        tempo: prev.speedType === 'tempo' ? prev.tempo : Timespan.fromMinutes(5),
      }));
    }
  };

  return (
    <Box sx={{ gap: 2, display: 'flex', flexDirection: 'column' }}>
      <FormControl fullWidth>
        <InputLabel>Type</InputLabel>
        <Select
          value={props.stage.type}
          onChange={(e) => setStage((prev) => ({ ...prev, type: e.target.value as StageType }))}
          label="Type"
        >
          <MenuItem value="simple">Run</MenuItem>
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
                } satisfies Stage)
            );
          }}
        />
      </Box>

      <FormControl fullWidth>
        <InputLabel>Based on</InputLabel>
        <Select
          value={stage.speedType}
          onChange={(e) => onBasedOnChanged(e.target.value as 'bmp' | 'tempo')}
          label="Type"
        >
          <MenuItem value="tempo">Tempo</MenuItem>
          <MenuItem value="bmp">Bmp</MenuItem>
        </Select>
      </FormControl>

      {stage.speedType === 'bmp' && (
        <TextField
          label="BPM"
          type="number"
          value={stage.speedType === 'bmp' ? stage.bmp : ''}
          onChange={(e) =>
            setStage(
              (prev) =>
                ({
                  duration: prev.duration,
                  type: prev.type,
                  bmp: Number(e.target.value),
                  speedType: 'bmp',
                } satisfies Stage)
            )
          }
        />
      )}

      {stage.speedType === 'tempo' && (
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TimePicker
            label="Tempo min/km"
            ampm={false}
            maxTime={dayjs('1977-01-01T00:15:00')}
            minTime={dayjs('1977-01-01T00:01:00')}
            views={['minutes', 'seconds']}
            value={dayjs({
              minute: stage.speedType === 'tempo' ? stage.tempo.minutes : 0,
              second: stage.speedType === 'tempo' ? stage.tempo.seconds : 0,
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
    </Box>
  );
}

function MultiplyStageEdit() {
  const [stage, setStage] = useAtom(editingSectionAtom);

  return (
    <Box sx={{ gap: 2, display: 'flex', flexDirection: 'column' }}>
      {stage && (
        <>
          <FormControl fullWidth>
            <InputLabel>Times</InputLabel>
            <Input
              type="number"
              value={stage.times}
              onChange={(e) => setStage(() => ({ ...stage, times: Number(e.target.value) }))}
            />
            {stage.stages.map((x, index) => (
              <StageEdit
                key={index}
                stage={x}
                onStageChanged={(edit) => {
                  setStage(() => ({
                    ...stage,
                    times: stage.times,
                    stages: stage.stages.map((s, i) => (i === index ? edit : s)),
                  }));
                }}
              />
            ))}
          </FormControl>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              color="secondary"
              sx={{ mt: 2 }}
              onClick={() =>
                setStage(() => ({
                  ...stage,
                  stages: [
                    ...stage.stages,
                    {
                      type: 'simple',
                      duration: Timespan.fromMinutes(1),
                      speedType: 'bmp',
                      bmp: 142,
                    } satisfies Stage,
                  ],
                }))
              }
            >
              Add Stage
            </Button>
          </Stack>
        </>
      )}
    </Box>
  );
}

export default function EditStage() {
  const [editingStage, setEditingStage] = useAtom(editingSectionAtom);
  const setProgram = useSetAtom(programAtom);

  const handleSubmit = (e: React.FormEvent) => {
    if (editingStage) {
      e.preventDefault();
      setProgram((prev) =>
        editingStage.id
          ? prev.map((stage) => (stage.id === editingStage.id ? editingStage : stage))
          : [...prev, { ...editingStage, id: crypto.randomUUID() }]
      );
      setEditingStage(undefined);
    }
  };

  return (
    <>
      {editingStage && (
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ gap: 2, display: 'flex', flexDirection: 'column' }}
        >
          <MultiplyStageEdit />

          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              color="secondary"
              sx={{ mt: 2 }}
              onClick={() => setEditingStage(undefined)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="secondary" sx={{ mt: 2 }}>
              {editingStage.id ? 'Update' : 'Add to program'}
            </Button>
            <Box sx={{ flexGrow: 1 }}></Box>
            <Button
              variant="contained"
              color="warning"
              onClick={() => {
                if (editingStage.id) {
                  setProgram((prev) => prev.filter((stage) => stage.id !== editingStage.id));
                }
                setEditingStage(undefined);
              }}
            >
              Delete
            </Button>
          </Stack>
        </Box>
      )}
    </>
  );
}
