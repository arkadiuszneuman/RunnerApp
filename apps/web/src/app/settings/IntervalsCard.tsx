'use client';

import { useEffect, useState } from 'react';
import SyncRoundedIcon from '@mui/icons-material/SyncRounded';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import axios from 'axios';
import { useAtomValue } from 'jotai';
import type { IntervalsStatus } from '@/lib/intervals/types';
import {
  intervalsStatusAtom,
  intervalsSyncAtom,
  loadIntervalsStatus,
  runIntervalsSync,
} from '../integrations/intervalsSync';
import { store } from '../store';
import { displayFont, enter, tokens } from '../theme';

const errorMessage = (error: unknown) =>
  axios.isAxiosError(error)
    ? ((error.response?.data as { error?: string } | undefined)?.error ??
      (error.response ? 'Something went wrong.' : 'You are offline.'))
    : 'Something went wrong.';

/**
 * Automatic import through intervals.icu: Garmin pushes every activity there (it's an official
 * Garmin partner), and RunnerApp pulls the runs with the user's personal API key.
 */
export default function IntervalsCard({ index }: Readonly<{ index: number }>) {
  const status = useAtomValue(intervalsStatusAtom);
  const sync = useAtomValue(intervalsSyncAtom);
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadIntervalsStatus();
  }, []);

  const connect = async () => {
    setBusy(true);
    setError('');
    try {
      const { data } = await axios.put<IntervalsStatus>('/api/integrations/intervals', {
        apiKey: apiKey.trim(),
      });
      store.set(intervalsStatusAtom, data);
      setApiKey('');
      void runIntervalsSync();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    setError('');
    try {
      const { data } = await axios.delete<IntervalsStatus>('/api/integrations/intervals');
      store.set(intervalsStatusAtom, data);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const connected = status?.connected ? status : null;
  const needsReconnect = connected?.status === 'needs_reconnect';

  return (
    <Paper variant="outlined" sx={{ p: 2.5, mb: 1.5, ...enter(index) }}>
      <Typography sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: '1.2rem', mb: 0.5 }}>
        Garmin sync via intervals.icu
      </Typography>

      {status === undefined ? (
        <LinearProgress sx={{ my: 2, borderRadius: 1 }} />
      ) : connected && !needsReconnect ? (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Connected{connected.athleteName ? ` as ${connected.athleteName}` : ''} (key …
            {connected.keyHint}). New runs are imported when you open the app.{' '}
            {connected.lastSyncedAt
              ? `Last sync: ${new Date(connected.lastSyncedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}.`
              : 'Not synced yet.'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={<SyncRoundedIcon />}
              disabled={sync.running || busy}
              onClick={() => void runIntervalsSync()}
            >
              Sync now
            </Button>
            <Button variant="glass" disabled={sync.running || busy} onClick={disconnect}>
              Disconnect
            </Button>
          </Box>
        </>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {needsReconnect && (
              <Box component="span" sx={{ color: tokens.amber, display: 'block', mb: 1 }}>
                The saved key stopped working — paste a new one.
              </Box>
            )}
            Imports your runs automatically. In a free{' '}
            <Link href="https://intervals.icu" target="_blank" rel="noopener noreferrer">
              intervals.icu
            </Link>{' '}
            account, connect <b>Garmin</b> in its Settings (Strava alone is not enough:
            intervals.icu can&apos;t share Strava-imported activities), then copy the <i>API key</i>{' '}
            from the Developer Settings section at the bottom of that page and paste it here. Garmin
            only gives intervals.icu about a year of history; import older runs from files below.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <TextField
              label="intervals.icu API key"
              size="small"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              sx={{ flex: 1, minWidth: 200 }}
            />
            <Button
              variant="contained"
              onClick={connect}
              disabled={busy || apiKey.trim().length < 8}
            >
              Connect
            </Button>
            {needsReconnect && (
              <Button variant="glass" onClick={disconnect} disabled={busy}>
                Disconnect
              </Button>
            )}
          </Box>
        </>
      )}

      {sync.running && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress sx={{ mb: 1, borderRadius: 1 }} />
          <Typography variant="body2" className="tabular" color="text.secondary">
            {sync.imported} imported{sync.remaining > 0 ? ` · ${sync.remaining} to go` : ''}
          </Typography>
        </Box>
      )}
      {!sync.running && (sync.message || sync.imported > 0) && (
        <Alert severity={sync.message ? 'warning' : 'success'} sx={{ mt: 2 }}>
          {sync.message ?? `Imported ${sync.imported} ${sync.imported === 1 ? 'run' : 'runs'}.`}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Paper>
  );
}
