import Box from '@mui/material/Box';
import { MultiplyStage, Stage, StageType } from '@/services/stagesCalculator';
import RunnerTypography from '../base/RunnerTypography';
import { useState } from 'react';
import { editingSectionAtom } from './atoms';
import { useAtomValue, useSetAtom } from 'jotai';
import { programAtom } from '../atoms';

function Section(props: Readonly<{ section: Stage; hovered: boolean; manyTimes: boolean }>) {
  const getStageTypeName = (type: StageType) => {
    const typeNames: Record<StageType, string> = {
      simple: 'Run',
      sprint: 'Sprint',
      regeneration: 'Regeneration',
    };

    return typeNames[type];
  };

  return (
    <Box
      sx={{
        background: props.hovered
          ? 'linear-gradient(90deg,rgba(155, 42, 42, 1) 0%, rgba(237, 221, 83, 0) 100%)'
          : 'linear-gradient(90deg,rgba(36, 92, 114, 1) 0%, rgba(237, 221, 83, 0) 100%)',
        padding: 1,
        transform: 'skew(-15deg)',
        borderRadius: 1,
        marginLeft: props.manyTimes ? 4 : 0,

        ':hover': {
          cursor: 'pointer',
        },
      }}
    >
      <Box sx={{ transform: 'skew(15deg)', paddingLeft: 1 }}>
        <RunnerTypography sx={{ marginBottom: 0.5 }}>
          {getStageTypeName(props.section.type)} {props.section.duration.toString('mm:ss')}
        </RunnerTypography>
        <RunnerTypography>
          {props.section.speedType === 'bmp' && <>{props.section.bmp}bmp</>}
        </RunnerTypography>
        <RunnerTypography>
          {props.section.speedType === 'tempo' && (
            <>{props.section.tempo.toString('mm:ss')} min/km</>
          )}
        </RunnerTypography>
      </Box>
    </Box>
  );
}

export default function Program() {
  const [hoveredStage, setHoveredStage] = useState<Stage | MultiplyStage | undefined>();
  const setEditingStage = useSetAtom(editingSectionAtom);
  const program = useAtomValue(programAtom);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: 'fit-content' }}>
      {program.map((section, programIndices) => (
        <Box
          key={programIndices}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            flexWrap: 'nowrap',
          }}
          onMouseOver={() => setHoveredStage(section)}
          onMouseOut={() => setHoveredStage(undefined)}
          onTouchStart={() => setHoveredStage(section)}
          onTouchEnd={() => setHoveredStage(undefined)}
          onClick={() => 'times' in section && setEditingStage(section)}
        >
          <>
            {section.times > 1 && (
              <RunnerTypography
                sx={{
                  fontSize: 12,
                  position: 'absolute',
                  zIndex: 1,
                  marginLeft: 10,
                  marginTop: -0.6,
                }}
              >
                Times {section.times}x
              </RunnerTypography>
            )}
            {section.stages.map((stage, stageIndex) => (
              <Section
                section={stage}
                key={stageIndex}
                hovered={hoveredStage === section}
                manyTimes={section.times > 1}
              />
            ))}
          </>
        </Box>
      ))}
    </Box>
  );
}
