'use client';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';

export type LinkCandidate = { id: string; title: string; subtitle: string; current?: boolean };

/**
 * Picks the other half of a run ↔ watch-activity pair: a list of candidates recorded around the
 * same time, plus an "Unlink" action when a link exists.
 */
export default function LinkDialog({
  open,
  title,
  candidates,
  emptyText,
  linked,
  onSelect,
  onUnlink,
  onClose,
}: Readonly<{
  open: boolean;
  title: string;
  candidates: LinkCandidate[];
  emptyText: string;
  linked: boolean;
  onSelect: (id: string) => void;
  onUnlink: () => void;
  onClose: () => void;
}>) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ px: 1.5 }}>
        {candidates.length === 0 ? (
          <Typography color="text.secondary" sx={{ px: 1.5 }}>
            {emptyText}
          </Typography>
        ) : (
          <List disablePadding>
            {candidates.map((c) => (
              <ListItemButton
                key={c.id}
                selected={c.current}
                onClick={() => onSelect(c.id)}
                sx={{ borderRadius: '12px' }}
              >
                <ListItemText
                  primary={c.title}
                  secondary={c.subtitle}
                  slotProps={{ secondary: { className: 'tabular' } }}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        {linked && (
          <Button color="error" onClick={onUnlink} sx={{ mr: 'auto' }}>
            Unlink
          </Button>
        )}
        <Button variant="glass" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
