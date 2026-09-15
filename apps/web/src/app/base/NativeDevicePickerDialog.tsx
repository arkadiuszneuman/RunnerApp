'use client';

import BluetoothRoundedIcon from '@mui/icons-material/BluetoothRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import {
  cancelNativeDevicePicker,
  rescanNativeDevicePicker,
  selectNativeDevice,
  useNativeDevicePicker,
} from '../ble/nativeDevicePicker';
import { tokens } from '../theme';

/**
 * apps/android's own device-picker UI — replaces BleClient.requestDevice()'s plain native
 * Android AlertDialog, which looked out of place against the rest of the app (see
 * nativeBleTransport.ts/nativeHeartRateTransport.ts, which drive this through
 * ble/nativeDevicePicker.ts instead of calling requestDevice() directly). Mounted once in
 * AppShell so it's available regardless of which page opens it.
 */
export default function NativeDevicePickerDialog() {
  const request = useNativeDevicePicker();
  const open = !!request;

  return (
    <Dialog open={open} onClose={cancelNativeDevicePicker} fullWidth maxWidth="xs">
      <DialogTitle>Select a device</DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        {request?.scanning && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              color: 'text.secondary',
              mb: 1.5,
            }}
          >
            <CircularProgress size={18} thickness={5} />
            <Typography variant="body2">Scanning for nearby devices…</Typography>
          </Box>
        )}

        {request && request.devices.length === 0 && !request.scanning && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
            No devices found nearby. Make sure it&apos;s powered on and in pairing/discoverable
            mode, then try again.
          </Typography>
        )}

        {request && request.devices.length > 0 && (
          <List disablePadding sx={{ mx: -1 }}>
            {request.devices.map((device) => (
              <ListItemButton
                key={device.deviceId}
                onClick={() => selectNativeDevice(device)}
                sx={{ borderRadius: '14px', py: 1 }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: tokens.cyan }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      background: alpha(tokens.cyan, 0.14),
                    }}
                  >
                    <BluetoothRoundedIcon fontSize="small" />
                  </Box>
                </ListItemIcon>
                <ListItemText
                  primary={device.name || 'Unknown device'}
                  secondary={device.deviceId}
                  slotProps={{ secondary: { sx: { fontSize: '0.7rem', color: tokens.textFaint } } }}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        {request && !request.scanning && (
          <Button onClick={rescanNativeDevicePicker} color="secondary">
            Scan again
          </Button>
        )}
        <Button onClick={cancelNativeDevicePicker} color="secondary">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}
