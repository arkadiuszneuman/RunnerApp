'use client';

import { useRef, useState } from 'react';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { ACCEPTED_IMPORT_TYPES } from '../import/fitFiles';
import type { ImportProgress } from '../import/runImport';
import { displayFont, enter } from '../theme';
import { refreshActivities } from '../userData';

function summary(p: ImportProgress): string {
  const parts = [`${p.files} files read`, `${p.found} runs found`];
  if (p.inserted) parts.push(`${p.inserted} new`);
  if (p.updated) parts.push(`${p.updated} updated`);
  if (p.duplicates) parts.push(`${p.duplicates} already imported`);
  if (p.skipped) parts.push(`${p.skipped} not runs`);
  if (p.failed) parts.push(`${p.failed} unreadable`);
  return parts.join(' · ');
}

/** Manual import of Garmin FIT files — single activities or the whole account export. */
export default function ImportFilesCard({ index }: Readonly<{ index: number }>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const running = progress !== null && !progress.done;

  const start = async (files: File[]) => {
    if (files.length === 0) return;
    // Loaded on demand: the FIT decoder and zip reader are only needed here.
    const { runImport } = await import('../import/runImport');
    const job = runImport(files, setProgress);
    cancelRef.current = job.cancel;
    const result = await job.done;
    cancelRef.current = null;
    if (result.inserted > 0 || result.updated > 0) void refreshActivities();
  };

  return (
    <Paper variant="outlined" sx={{ p: 2.5, mb: 1.5, ...enter(index) }}>
      <Typography sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: '1.2rem', mb: 0.5 }}>
        Import from Garmin files
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Upload <b>.fit</b> files or zips of them. For one run: open it in Garmin Connect, ⚙ →{' '}
        <i>Export Original</i>. For your whole history: Garmin account → <i>Data Management</i> →{' '}
        <i>Export Your Data</i>, then upload the zip you get by e-mail as it is. Only runs are
        imported; anything already imported is skipped, and runs recorded together with RunnerApp
        are linked to them automatically.
      </Typography>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_IMPORT_TYPES}
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          void start(files);
        }}
      />
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          startIcon={<UploadFileRoundedIcon />}
          disabled={running}
          onClick={() => inputRef.current?.click()}
        >
          Choose files
        </Button>
        {running && (
          <Button variant="glass" onClick={() => cancelRef.current?.()}>
            Cancel
          </Button>
        )}
      </Box>
      {progress && (
        <Box sx={{ mt: 2 }}>
          {running && <LinearProgress sx={{ mb: 1, borderRadius: 1 }} />}
          <Typography variant="body2" className="tabular" color="text.secondary">
            {summary(progress)}
          </Typography>
          {progress.error && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              {progress.error} Runs uploaded so far are kept — choose the files again to continue.
            </Alert>
          )}
          {progress.done && !progress.error && (
            <Alert severity="success" sx={{ mt: 1 }}>
              Import finished.
            </Alert>
          )}
        </Box>
      )}
    </Paper>
  );
}
