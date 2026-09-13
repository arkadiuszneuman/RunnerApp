import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import { calculateSpeedByTempo, type StageResult } from '@runner/core';
import { stageTypeColor } from '../theme';

/** 0..1 effort estimate, only used for the bar height — HR targets and tempo on one scale. */
function effort(stage: StageResult): number {
  const raw =
    stage.speedType === 'bmp'
      ? (stage.bmp - 100) / 90
      : (calculateSpeedByTempo(stage.tempo) - 4) / 14;
  return Math.min(1, Math.max(0.18, raw));
}

/**
 * Intensity silhouette of a program: bar width ∝ stage duration, height ∝
 * target effort, color by stage type. Pass `elapsedMs` to turn it into a live
 * progress bar (bars fill as the run clock passes through them).
 */
export default function StageStrip({
  stages,
  height = 56,
  elapsedMs,
}: Readonly<{ stages: StageResult[]; height?: number; elapsedMs?: number }>) {
  if (stages.length === 0) return null;
  const live = elapsedMs !== undefined;

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height }} aria-hidden>
      {stages.map((stage, i) => {
        const color = stageTypeColor[stage.type];
        const from = stage.from.totalMilliseconds;
        const duration = stage.to.totalMilliseconds - from;
        const fill = live ? Math.min(1, Math.max(0, (elapsedMs - from) / duration)) : 1;
        const current = live && fill > 0 && fill < 1;

        return (
          <Box
            key={i}
            sx={{
              flexGrow: duration,
              flexBasis: 0,
              minWidth: 3,
              height: `${effort(stage) * 100}%`,
              position: 'relative',
              overflow: 'hidden',
              borderRadius: '5px 5px 2px 2px',
              background: live ? alpha(color, 0.16) : undefined,
              transformOrigin: 'bottom',
              animation: `grow-up 700ms var(--ease-out) ${Math.min(i * 30, 600)}ms both`,
              boxShadow: current ? `0 0 16px ${alpha(color, 0.7)}` : 'none',
              transition: 'box-shadow 400ms ease',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                width: `${fill * 100}%`,
                background: `linear-gradient(to top, ${alpha(color, 0.45)}, ${color})`,
                transition: 'width 1s linear',
                ...(current && {
                  backgroundImage: `linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent), linear-gradient(to top, ${alpha(color, 0.45)}, ${color})`,
                  backgroundSize: '200% 100%, 100% 100%',
                  animation: 'shimmer 2.2s linear infinite',
                }),
              }}
            />
          </Box>
        );
      })}
    </Box>
  );
}
