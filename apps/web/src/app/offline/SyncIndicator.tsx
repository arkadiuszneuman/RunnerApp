'use client';

import CloudDoneRoundedIcon from '@mui/icons-material/CloudDoneRounded';
import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded';
import CloudSyncRoundedIcon from '@mui/icons-material/CloudSyncRounded';
import SyncProblemRoundedIcon from '@mui/icons-material/SyncProblemRounded';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import { useAtomValue } from 'jotai';
import { glass, tokens } from '../theme';
import { countPendingRuns } from './overlay';
import { isOfflineAtom, pendingWritesAtom, syncStatusAtom } from './sync';

export type SyncSummary = {
  tone: 'ok' | 'syncing' | 'offline' | 'problem';
  label: string;
  detail: string;
};

export const syncToneIcon = {
  ok: CloudDoneRoundedIcon,
  syncing: CloudSyncRoundedIcon,
  offline: CloudOffRoundedIcon,
  problem: SyncProblemRoundedIcon,
} as const;

export function useSyncSummary(): SyncSummary {
  const offline = useAtomValue(isOfflineAtom);
  const pending = useAtomValue(pendingWritesAtom);
  const status = useAtomValue(syncStatusAtom);
  const pendingRuns = countPendingRuns(pending);

  const saved =
    pendingRuns > 0
      ? `${pendingRuns} ${pendingRuns === 1 ? 'run is' : 'runs are'} saved on this device and will upload automatically.`
      : pending.length > 0
        ? 'Your changes are saved on this device and will upload automatically.'
        : 'Runs and edits are saved on this device and upload once you are back online.';

  if (offline) {
    return { tone: 'offline', label: pending.length > 0 ? `Offline · ${pending.length}` : 'Offline', detail: saved };
  }
  if (pending.length > 0 && status === 'auth') {
    return {
      tone: 'problem',
      label: 'Sign in to sync',
      detail: 'Your session has expired. Sign in again to upload the changes saved on this device.',
    };
  }
  if (pending.length > 0 && status === 'error') {
    return { tone: 'problem', label: 'Sync delayed', detail: `The server is not accepting changes right now. ${saved}` };
  }
  if (pending.length > 0) return { tone: 'syncing', label: 'Syncing', detail: saved };
  return { tone: 'ok', label: 'Synced', detail: 'Everything is saved to your account.' };
}

const toneColor = {
  ok: tokens.volt,
  syncing: tokens.cyan,
  offline: tokens.amber,
  problem: tokens.heart,
} as const;

/** Compact connectivity/sync pill for the top bar; hidden while everything is synced. */
export default function SyncIndicator() {
  const summary = useSyncSummary();
  if (summary.tone === 'ok') return null;
  const Icon = syncToneIcon[summary.tone];

  return (
    <Tooltip title={summary.detail} enterTouchDelay={0}>
      <Box
        role="status"
        tabIndex={0}
        sx={{
          ...glass,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          height: 32,
          px: 1.25,
          borderRadius: 999,
          color: toneColor[summary.tone],
          fontSize: '0.75rem',
          fontWeight: 700,
          whiteSpace: 'nowrap',
          animation: 'fade-in 300ms ease backwards',
          '& svg': {
            fontSize: 17,
            animation: summary.tone === 'syncing' ? 'spin 1.6s linear infinite' : 'none',
          },
          '@keyframes spin': { to: { transform: 'rotate(360deg)' } },
        }}
      >
        <Icon />
        {summary.label}
      </Box>
    </Tooltip>
  );
}
