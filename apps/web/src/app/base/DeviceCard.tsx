'use client';

import { ReactNode, useState } from 'react';
import BluetoothRoundedIcon from '@mui/icons-material/BluetoothRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import PulseDot from './PulseDot';
import { enter, tokens } from '../theme';

export interface DeviceCardProps {
  icon: ReactNode;
  color: string;
  title: string;
  status: ReactNode;
  connected: boolean;
  connecting: boolean;
  /** A device id is remembered from a previous session, even if not currently connected. */
  remembered: boolean;
  /** Bluetooth itself is unavailable — disables every action. */
  disabled?: boolean;
  /** Locks the change/forget menu, e.g. while a run is active. */
  menuDisabled?: boolean;
  index?: number;
  onConnect: () => void;
  onChange: () => void;
  onForget: () => void;
}

/** A remembered-device status card: shows connection state and a Change/Forget menu. */
export default function DeviceCard({
  icon,
  color,
  title,
  status,
  connected,
  connecting,
  remembered,
  disabled = false,
  menuDisabled = false,
  index = 0,
  onConnect,
  onChange,
  onForget,
}: Readonly<DeviceCardProps>) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  function closeMenu() {
    setMenuAnchor(null);
  }

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, ...enter(index) }}
    >
      <Box
        sx={{
          position: 'relative',
          width: 48,
          height: 48,
          flexShrink: 0,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          color: connected ? color : tokens.textFaint,
          background: connected ? alpha(color, 0.14) : 'rgba(255,255,255,0.05)',
          transition: 'background-color 400ms ease, color 400ms ease',
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600 }}>{title}</Typography>
        <Typography variant="body2" color="text.secondary" noWrap>
          {status}
        </Typography>
      </Box>

      {connected ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            color: tokens.volt,
            fontSize: '0.8rem',
            fontWeight: 600,
          }}
        >
          <PulseDot />
          Live
        </Box>
      ) : (
        <Button
          variant="contained"
          size="small"
          startIcon={<BluetoothRoundedIcon />}
          onClick={onConnect}
          disabled={disabled || connecting}
          loading={connecting}
        >
          Connect
        </Button>
      )}

      {(remembered || connected) && (
        <>
          <IconButton
            size="small"
            onClick={(event) => setMenuAnchor(event.currentTarget)}
            disabled={disabled || menuDisabled}
            aria-label={`${title} options`}
          >
            <MoreVertRoundedIcon fontSize="small" />
          </IconButton>
          <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={closeMenu}>
            <MenuItem
              onClick={() => {
                closeMenu();
                onChange();
              }}
            >
              Change device
            </MenuItem>
            <MenuItem
              onClick={() => {
                closeMenu();
                onForget();
              }}
            >
              Forget
            </MenuItem>
          </Menu>
        </>
      )}
    </Paper>
  );
}
