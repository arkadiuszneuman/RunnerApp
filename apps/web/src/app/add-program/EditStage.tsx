'use client';

import { useEffect, useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { Stage, StageType, Timespan } from '@runner/core';
import dayjs from 'dayjs';
import { useAtom, useSetAtom } from 'jotai';
import _ from 'lodash';
import { programAtom } from '../atoms';
import ActionBar from '../base/ActionBar';
import Page from '../base/Page';
import { displayFont, enter, glass, stageTypeColor, stageTypeName, tokens } from '../theme';
import { editingSectionAtom } from './atoms';

const STAGE_TYPES: StageType[] = ['simple', 'sprint', 'regeneration'];

/** Segmented-control look for a ToggleButtonGroup. */
const segmentedSx = {
  width: '100%',
  p: 0.5,
  gap: 0.5,
  borderRadius: '16px',
  background: 'rgba(255,255,255,0.04)',
  border: `1px solid ${tokens.border}`,
  '& .MuiToggleButton-root': {
    flex: 1,
    py: 1,
    border: 0,
    borderRadius: '12px !important',
    color: tokens.textMuted,
    textTransform: 'none',
    fontWeight: 600,
    transition: 'background-color 250ms ease, color 250ms ease',
  },
} as const;

const selectedSx = (color: string) => ({
  '&.Mui-selected, &.Mui-selected:hover': { color, backgroundColor: alpha(color, 0.18) },
});

function StageEdit(props: Readonly<{ stage: Stage; index: number; onStageChanged?: (stage: Stage) => void }>) {
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

  const color = stageTypeColor[stage.type];

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        borderLeft: `3px solid ${color}`,
        transition: 'border-color 300ms ease',
        ...enter(props.index + 1),
      }}
    >
      <Typography sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.2rem' }}>
        Step {props.index + 1}
      </Typography>

      <ToggleButtonGroup
        exclusive
        aria-label="Stage type"
        value={props.stage.type}
        onChange={(_event, value: StageType | null) => {
          if (value) setStage((prev) => ({ ...prev, type: value }));
        }}
        sx={segmentedSx}
      >
        {STAGE_TYPES.map((type) => (
          <ToggleButton key={type} value={type} sx={selectedSx(stageTypeColor[type])}>
            {stageTypeName[type]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

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
        slotProps={{ textField: { fullWidth: true } }}
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

      <ToggleButtonGroup
        exclusive
        aria-label="Based on"
        value={stage.speedType}
        onChange={(_event, value: 'bmp' | 'tempo' | null) => {
          if (value) onBasedOnChanged(value);
        }}
        sx={segmentedSx}
      >
        <ToggleButton value="bmp" sx={selectedSx(tokens.heart)}>
          Heart rate
        </ToggleButton>
        <ToggleButton value="tempo" sx={selectedSx(tokens.cyan)}>
          Tempo
        </ToggleButton>
      </ToggleButtonGroup>

      {stage.speedType === 'bmp' && (
        <TextField
          label="BPM"
          type="number"
          slotProps={{ htmlInput: { inputMode: 'numeric' } }}
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
          slotProps={{ textField: { fullWidth: true } }}
          onChange={(e) => {
            setStage((prev) => ({
              ...prev,
              tempo: Timespan.fromMinutes(Number(e?.minute())).add(
                Timespan.fromSeconds(Number(e?.second()))
              ),
            }));
          }}
        />
      )}
    </Paper>
  );
}

function MultiplyStageEdit() {
  const [stage, setStage] = useAtom(editingSectionAtom);

  if (!stage) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Paper
        variant="outlined"
        sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, ...enter(0) }}
      >
        <Box>
          <Typography sx={{ fontWeight: 600 }}>Repeat</Typography>
          <Typography variant="caption" color="text.secondary">
            How many times this block runs
          </Typography>
        </Box>
        <TextField
          type="number"
          size="small"
          value={stage.times}
          onChange={(e) => setStage(() => ({ ...stage, times: Number(e.target.value) }))}
          slotProps={{ htmlInput: { inputMode: 'numeric', 'aria-label': 'Repeat count' } }}
          sx={{ width: 96, '& input': { fontFamily: displayFont, fontWeight: 700, fontSize: '1.2rem', textAlign: 'center' } }}
        />
      </Paper>

      {stage.stages.map((x, index) => (
        <StageEdit
          key={index}
          index={index}
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

      <Button
        variant="glass"
        startIcon={<AddRoundedIcon />}
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
        Add step
      </Button>
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

  if (!editingStage) return null;

  return (
    <Page eyebrow="Program builder" title={editingStage.id ? 'Edit block' : 'New block'}>
      <Box component="form" onSubmit={handleSubmit}>
        <MultiplyStageEdit />

        <ActionBar>
          {editingStage.id && (
            <IconButton
              aria-label="Delete block"
              onClick={() => {
                setProgram((prev) => prev.filter((stage) => stage.id !== editingStage.id));
                setEditingStage(undefined);
              }}
              sx={{ ...glass, color: tokens.heart, width: 56, height: 56, flexShrink: 0 }}
            >
              <DeleteOutlineRoundedIcon />
            </IconButton>
          )}
          <Button size="large" variant="glass" onClick={() => setEditingStage(undefined)}>
            Cancel
          </Button>
          <Button type="submit" size="large" variant="contained" sx={{ flex: 1 }}>
            {editingStage.id ? 'Update' : 'Add to program'}
          </Button>
        </ActionBar>
      </Box>
    </Page>
  );
}
