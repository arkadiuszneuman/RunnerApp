import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  NativeHeartRateTransport,
  type NativeHeartRateTransportOptions,
} from './nativeHeartRateTransport';
import { cancelNativeDevicePicker, selectNativeDevice } from './nativeDevicePicker';

const { BleClient } = vi.hoisted(() => ({
  BleClient: {
    initialize: vi.fn().mockResolvedValue(undefined),
    requestLEScan: vi.fn().mockResolvedValue(undefined),
    stopLEScan: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn(),
    disconnect: vi.fn().mockResolvedValue(undefined),
    startNotifications: vi.fn().mockResolvedValue(undefined),
    stopNotifications: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@capacitor-community/bluetooth-le', async () => {
  const actual = await vi.importActual<typeof import('@capacitor-community/bluetooth-le')>(
    '@capacitor-community/bluetooth-le'
  );
  return { ...actual, BleClient };
});

// getRemembered() caches by storageKey in-memory (see rememberedDevice.ts) and only
// invalidates on remember()/forget() — each test writes to localStorage directly for
// setup, so each needs its own key to avoid reading another test's stale cache entry.
function makeOpts(storageKey: string): NativeHeartRateTransportOptions {
  return { storageKey };
}

/**
 * NativeDevicePickerDialog is what actually calls selectNativeDevice() in the app — a real
 * button tap. Here we simulate that: requestLEScan's mock delivers its scan result synchronously
 * (making the device show up in the dialog's list), then a setTimeout macrotask reliably drains
 * the pickNativeDevice()/ensureNativeBleInitialized() microtask chain before we call
 * selectNativeDevice() ourselves, same as the dialog would on a tap.
 */
async function pickFoundDevice(device: { deviceId: string; name: string }): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  selectNativeDevice(device);
}

afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  cancelNativeDevicePicker(); // no-op if the test already resolved/rejected its own picker
});

describe('NativeHeartRateTransport.connect', () => {
  it('connects to the remembered device id directly, without scanning/picking', async () => {
    const opts = makeOpts('nhrt-test-1');
    localStorage.setItem(opts.storageKey, 'AA:BB:CC:00:01:01');
    localStorage.setItem(`${opts.storageKey}Name`, 'HR-1');
    BleClient.connect.mockResolvedValue(undefined);

    const transport = new NativeHeartRateTransport(opts);
    await transport.connect();

    expect(BleClient.requestLEScan).not.toHaveBeenCalled();
    expect(BleClient.connect).toHaveBeenCalledWith('AA:BB:CC:00:01:01', expect.any(Function));
    expect(transport.isConnected()).toBe(true);
  });

  it('opens the picker filtered to the heart_rate service when nothing is remembered', async () => {
    const opts = makeOpts('nhrt-test-2');
    BleClient.requestLEScan.mockImplementation((_options, callback) => {
      callback({ device: { deviceId: 'AA:BB:CC:00:01:02', name: 'HR-2' } });
      return Promise.resolve();
    });
    BleClient.connect.mockResolvedValue(undefined);

    const transport = new NativeHeartRateTransport(opts);
    const connecting = transport.connect();
    await pickFoundDevice({ deviceId: 'AA:BB:CC:00:01:02', name: 'HR-2' });
    await connecting;

    expect(BleClient.requestLEScan).toHaveBeenCalledWith(
      { services: ['0000180d-0000-1000-8000-00805f9b34fb'] },
      expect.any(Function)
    );
    expect(localStorage.getItem(opts.storageKey)).toBe('AA:BB:CC:00:01:02');
  });

  it('rejects without opening the picker when silent and nothing is remembered', async () => {
    const opts = makeOpts('nhrt-test-3');

    const transport = new NativeHeartRateTransport(opts);
    await expect(transport.connect({ silent: true })).rejects.toThrow(
      'no remembered device to silently reconnect to'
    );

    expect(BleClient.requestLEScan).not.toHaveBeenCalled();
  });

  it('reuses the already-known device id on a later reconnect instead of re-picking', async () => {
    const opts = makeOpts('nhrt-test-4');
    BleClient.requestLEScan.mockImplementation((_options, callback) => {
      callback({ device: { deviceId: 'AA:BB:CC:00:01:04', name: 'HR-4' } });
      return Promise.resolve();
    });
    BleClient.connect.mockResolvedValue(undefined);

    const transport = new NativeHeartRateTransport(opts);
    const connecting = transport.connect();
    await pickFoundDevice({ deviceId: 'AA:BB:CC:00:01:04', name: 'HR-4' });
    await connecting;
    await transport.connect();

    expect(BleClient.requestLEScan).toHaveBeenCalledTimes(1);
    expect(BleClient.connect).toHaveBeenCalledTimes(2);
  });
});

describe('NativeHeartRateTransport.disconnect callback', () => {
  it('notifies onDisconnect listeners and flips isConnected() when the native link drops', async () => {
    const opts = makeOpts('nhrt-test-5');
    localStorage.setItem(opts.storageKey, 'AA:BB:CC:00:01:05');
    localStorage.setItem(`${opts.storageKey}Name`, 'HR-5');
    BleClient.connect.mockResolvedValue(undefined);

    const transport = new NativeHeartRateTransport(opts);
    const disconnected = vi.fn();
    transport.onDisconnect(disconnected);
    await transport.connect();

    const onNativeDisconnect = BleClient.connect.mock.calls[0][1] as () => void;
    onNativeDisconnect();

    expect(disconnected).toHaveBeenCalled();
    expect(transport.isConnected()).toBe(false);
  });
});

describe('NativeHeartRateTransport.forget', () => {
  it('disconnects and clears the remembered id', async () => {
    const opts = makeOpts('nhrt-test-6');
    localStorage.setItem(opts.storageKey, 'AA:BB:CC:00:01:06');
    localStorage.setItem(`${opts.storageKey}Name`, 'HR-6');
    BleClient.connect.mockResolvedValue(undefined);

    const transport = new NativeHeartRateTransport(opts);
    await transport.connect();
    await transport.forget();

    expect(BleClient.disconnect).toHaveBeenCalledWith('AA:BB:CC:00:01:06');
    expect(localStorage.getItem(opts.storageKey)).toBeNull();
    expect(transport.hasRemembered()).toBe(false);
    expect(transport.isConnected()).toBe(false);
  });
});
