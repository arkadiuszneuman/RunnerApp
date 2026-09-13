import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { Stage } from '@runner/core';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { programAtom, programCooldownAtom, stagesAtom } from '../atoms';
import StageStrip from '../base/StageStrip';
import { displayFont, enter, pressable, stageTypeColor, stageTypeName, tokens } from '../theme';
import { editingSectionAtom } from './atoms';

const labelSx = {
  fontSize: '0.68rem',
  fontWeight: 600,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: tokens.textMuted,
} as const;

function StageRow({ stage }: Readonly<{ stage: Stage }>) {
  const color = stageTypeColor[stage.type];
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        py: 1,
        px: 1.25,
        borderRadius: '12px',
        borderLeft: `3px solid ${color}`,
        background: `linear-gradient(90deg, ${alpha(color, 0.16)}, transparent 85%)`,
      }}
    >
      <Typography sx={{ fontWeight: 600, flex: 1 }}>{stageTypeName[stage.type]}</Typography>
      <Typography className="tabular" sx={{ color: tokens.textMuted }}>
        {stage.duration.toString('mm:ss')}
      </Typography>
      <Typography
        className="tabular"
        sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.1rem', minWidth: 76, textAlign: 'right' }}
      >
        {stage.speedType === 'bmp' ? `${stage.bmp} bpm` : `${stage.tempo.toString('mm:ss')} /km`}
      </Typography>
    </Box>
  );
}

export default function Program() {
  const [programCooldown, setProgramCooldown] = useAtom(programCooldownAtom);
  const setEditingStage = useSetAtom(editingSectionAtom);
  const program = useAtomValue(programAtom);
  const stages = useAtomValue(stagesAtom);
  const total = stages.at(-1)?.to;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Paper variant="outlined" sx={{ p: 2, ...enter(0) }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
          <Box>
            <Typography sx={labelSx}>Total</Typography>
            <Typography className="tabular" sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '2rem', lineHeight: 1.1 }}>
              {total ? total.toString(total.totalSeconds >= 3600 ? 'hh:mm:ss' : 'mm:ss') : '00:00'}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography sx={labelSx}>Stages</Typography>
            <Typography className="tabular" sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '2rem', lineHeight: 1.1 }}>
              {stages.length}
            </Typography>
          </Box>
        </Box>
        {stages.length > 0 ? (
          <StageStrip stages={stages} height={64} />
        ) : (
          <Typography variant="body2" color="text.secondary">
            No stages yet — add a block, or import a program from text.
          </Typography>
        )}
        <Divider sx={{ my: 1.5 }} />
        <FormControlLabel
          labelPlacement="start"
          sx={{ m: 0, width: '100%', justifyContent: 'space-between' }}
          control={
            <Switch checked={programCooldown} onChange={(e) => setProgramCooldown(e.target.checked)} />
          }
          label={
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Cooldown
              </Typography>
              <Typography variant="caption" color="text.secondary">
                4 km/h, 0% after the last stage
              </Typography>
            </Box>
          }
        />
      </Paper>

      {program.map((section, programIndex) => (
        <Paper
          key={programIndex}
          variant="outlined"
          onClick={() => 'times' in section && setEditingStage(section)}
          sx={{ p: 1.5, ...pressable, ...enter(programIndex + 1) }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, px: 0.5 }}>
            <Typography sx={{ ...labelSx, flex: 1 }}>Block {programIndex + 1}</Typography>
            {section.times > 1 && (
              <Box
                sx={{
                  px: 1.25,
                  borderRadius: 999,
                  fontFamily: displayFont,
                  fontWeight: 700,
                  fontSize: '1rem',
                  color: tokens.volt,
                  background: alpha(tokens.volt, 0.14),
                }}
              >
                × {section.times}
              </Box>
            )}
            <ChevronRightRoundedIcon sx={{ color: tokens.textFaint }} />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {section.stages.map((stage, stageIndex) => (
              <StageRow stage={stage} key={stageIndex} />
            ))}
          </Box>
        </Paper>
      ))}
    </Box>
  );
}
