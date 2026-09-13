'use client';

import type { StageType } from '@runner/core';
import { alpha, createTheme } from '@mui/material/styles';

declare module '@mui/material/Button' {
  interface ButtonPropsVariantOverrides {
    glass: true;
  }
}

/** Raw design tokens — for places the MUI palette can't reach (SVG strokes, glows, gradients). */
export const tokens = {
  bg: '#05070c',
  paper: '#0e131d',
  surface: 'rgba(255, 255, 255, 0.045)',
  surfaceHover: 'rgba(255, 255, 255, 0.08)',
  border: 'rgba(255, 255, 255, 0.09)',
  borderStrong: 'rgba(255, 255, 255, 0.18)',
  text: '#f2f5fb',
  textMuted: 'rgba(226, 232, 245, 0.62)',
  textFaint: 'rgba(226, 232, 245, 0.36)',
  volt: '#c6ff3d',
  cyan: '#38e1ff',
  violet: '#8b7bff',
  heart: '#ff4d6d',
  amber: '#ffb547',
} as const;

export const displayFont = 'var(--font-display), var(--font-barlow), sans-serif';

/** Accent per stage type — shared by the stage strip, program blocks and the run dashboard. */
export const stageTypeColor: Record<StageType, string> = {
  simple: tokens.cyan,
  sprint: tokens.heart,
  regeneration: tokens.violet,
};

export const stageTypeName: Record<StageType, string> = {
  simple: 'Run',
  sprint: 'Sprint',
  regeneration: 'Recovery',
};

/** Frosted-glass surface. */
export const glass = {
  background: tokens.surface,
  border: `1px solid ${tokens.border}`,
  backdropFilter: 'blur(20px) saturate(140%)',
  WebkitBackdropFilter: 'blur(20px) saturate(140%)',
} as const;

/** Tactile hover/press feedback for tappable cards. */
export const pressable = {
  cursor: 'pointer',
  // A tap-and-hold on a card (common on the list rows this is used for)
  // would otherwise select its text / show the mobile text-selection
  // callout instead of registering as a tap.
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTouchCallout: 'none',
  transition:
    'transform 240ms var(--ease-out), background-color 240ms ease, border-color 240ms ease',
  '@media (hover: hover)': {
    '&:hover': { background: tokens.surfaceHover, borderColor: tokens.borderStrong },
  },
  '&:active': { transform: 'scale(0.98)' },
} as const;

/** Segmented-control look for a ToggleButtonGroup. */
export const segmentedSx = {
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

/** Selected-state tint for one segment of `segmentedSx`. */
export function segmentSelectedSx(color: string) {
  return { '&.Mui-selected, &.Mui-selected:hover': { color, backgroundColor: alpha(color, 0.18) } };
}

/** Timing for `enter()` below, exposed so effects that must wait for a sibling's
 * entrance to finish (e.g. the active-row glow in programs/page.tsx, which must
 * not become visible before the row after it has finished appearing) can compute
 * the same delay without duplicating the numbers. */
export const ENTER_STEP_MS = 55;
export const ENTER_DURATION_MS = 560;

/** Staggered entrance animation for list items (keyframes live in globals.css). */
export function enter(index = 0, stepMs = ENTER_STEP_MS) {
  // `backwards`, not `both`: a retained end keyframe would override :active transforms.
  return { animation: `fade-up ${ENTER_DURATION_MS}ms var(--ease-out) ${index * stepMs}ms backwards` };
}

/** The entrance delay (ms) `enter(index)` uses — see ENTER_STEP_MS above. */
export function enterDelayMs(index: number, stepMs = ENTER_STEP_MS) {
  return index * stepMs;
}

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: tokens.volt, contrastText: '#0b1200' },
    secondary: { main: tokens.violet, contrastText: '#ffffff' },
    error: { main: tokens.heart },
    warning: { main: tokens.amber },
    info: { main: tokens.cyan },
    success: { main: tokens.volt, contrastText: '#0b1200' },
    background: { default: tokens.bg, paper: tokens.paper },
    text: { primary: tokens.text, secondary: tokens.textMuted, disabled: tokens.textFaint },
    divider: tokens.border,
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: 'var(--font-barlow), system-ui, sans-serif',
    h3: { fontFamily: displayFont, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1 },
    h4: { fontFamily: displayFont, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.05 },
    h5: { fontFamily: displayFont, fontWeight: 700, lineHeight: 1.1 },
    h6: { fontFamily: displayFont, fontWeight: 600, lineHeight: 1.15 },
    overline: { fontWeight: 600, letterSpacing: '0.16em', lineHeight: 1.6 },
    button: { fontWeight: 600, textTransform: 'none', letterSpacing: '0.01em' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: { body: { backgroundColor: tokens.bg } },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 999,
          paddingInline: 20,
          minHeight: 44,
          transition:
            'transform 200ms var(--ease-out), box-shadow 260ms ease, background-color 260ms ease',
          '&:active': { transform: 'scale(0.97)' },
          variants: [
            { props: { size: 'small' }, style: { minHeight: 34, paddingInline: 14 } },
            { props: { size: 'large' }, style: { minHeight: 58, paddingInline: 28, fontSize: '1.05rem' } },
            {
              props: { variant: 'contained', color: 'primary' },
              style: {
                boxShadow: `0 10px 30px -10px ${alpha(tokens.volt, 0.7)}`,
                '&:hover': {
                  backgroundColor: '#d6ff75',
                  boxShadow: `0 14px 38px -10px ${alpha(tokens.volt, 0.85)}`,
                },
                '&.Mui-disabled': {
                  boxShadow: 'none',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  color: tokens.textFaint,
                },
              },
            },
            {
              props: { variant: 'glass' },
              style: {
                ...glass,
                color: tokens.text,
                '&:hover': { background: tokens.surfaceHover, borderColor: tokens.borderStrong },
                '&.Mui-disabled': { color: tokens.textFaint },
              },
            },
          ],
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: 'transform 200ms var(--ease-out), background-color 200ms ease',
          '&:active': { transform: 'scale(0.9)' },
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          variants: [{ props: { variant: 'outlined' }, style: { ...glass, borderRadius: 20 } }],
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 24,
          border: `1px solid ${tokens.border}`,
          background: 'linear-gradient(180deg, #131a28 0%, #0c111a 100%)',
          boxShadow: '0 30px 80px -20px rgba(0,0,0,0.8)',
        },
        root: {
          '& .MuiBackdrop-root': {
            backgroundColor: 'rgba(3, 5, 10, 0.6)',
            backdropFilter: 'blur(8px)',
          },
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: { root: { fontFamily: displayFont, fontWeight: 700, fontSize: '1.5rem' } },
    },
    MuiPopover: {
      styleOverrides: {
        paper: { border: `1px solid ${tokens.border}`, borderRadius: 16, background: tokens.paper },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: tokens.border },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: tokens.borderStrong },
        },
      },
    },
    MuiChip: {
      styleOverrides: { root: { borderRadius: 999, fontWeight: 600 } },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: tokens.border },
        head: {
          color: tokens.textMuted,
          fontWeight: 600,
          fontSize: '0.72rem',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          background: tokens.paper,
          border: `1px solid ${tokens.border}`,
          borderRadius: 10,
          fontSize: '0.8rem',
        },
      },
    },
    MuiSkeleton: {
      defaultProps: { animation: 'wave' },
      styleOverrides: { root: { backgroundColor: 'rgba(255, 255, 255, 0.06)' } },
    },
    MuiAlert: {
      styleOverrides: { root: { borderRadius: 14 } },
    },
  },
});

export default theme;
