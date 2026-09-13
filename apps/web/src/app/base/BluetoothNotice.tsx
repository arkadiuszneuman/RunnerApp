'use client';

import BluetoothDisabledRoundedIcon from '@mui/icons-material/BluetoothDisabledRounded';
import Alert from '@mui/material/Alert';
import type { SxProps, Theme } from '@mui/material/styles';
import type { BluetoothAvailability } from '../ble/bluetoothAvailability';

const MESSAGES: Partial<Record<BluetoothAvailability, string>> = {
  unsupported:
    "This browser can't connect to Bluetooth devices. Open Runner in Chrome or Edge on Android, Windows, macOS, Linux or ChromeOS — browsers on iPhone and iPad don't support Web Bluetooth.",
  insecure: 'Bluetooth only works over a secure (https) connection. Open Runner via its https address.',
  unavailable:
    "Bluetooth is off or blocked. Turn it on — and on Android allow Chrome the Nearby devices permission — to connect the treadmill and heart-rate monitor.",
};

/** Explains why the treadmill/HR monitor can't be reached; renders nothing when Bluetooth is usable. */
export default function BluetoothNotice({
  availability,
  sx,
}: Readonly<{ availability: BluetoothAvailability; sx?: SxProps<Theme> }>) {
  const message = MESSAGES[availability];
  if (!message) return null;
  return (
    <Alert
      severity="warning"
      variant="outlined"
      icon={<BluetoothDisabledRoundedIcon />}
      sx={{ borderRadius: '16px', ...sx }}
    >
      {message}
    </Alert>
  );
}

/** Whether Bluetooth actions should be disabled outright (as opposed to merely warned about). */
export function isBluetoothBlocked(availability: BluetoothAvailability): boolean {
  return availability === 'unsupported' || availability === 'insecure';
}
