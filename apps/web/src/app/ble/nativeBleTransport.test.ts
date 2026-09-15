import { afterEach, describe, expect, it, vi } from 'vitest';
import { NativeBleTransport, type NativeBleTransportOptions } from './nativeBleTransport';
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
    write: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@capacitor-community/bluetooth-le', () => ({ BleClient }));

// getRemembered() caches by storageKey in-memory (see rememberedDevice.ts) and only
// invalidates on remember()/forget() — each test writes to localStorage directly for
// setup, so each needs its own key to avoid reading another test's stale cache entry.
function makeOpts(storageKey: string): NativeBleTransportOptions {
  return {
    serviceUuid: 'service',
    readCharUuid: 'read',
    writeCharUuid: 'write',
    namePrefix: 'FS-',
    storageKey,
  };
}

/**
 * NativeDevicePickerDialog is what actually calls selectNativeDevice() in the app — a real
 * button tap. Here we simulate that: let requestLEScan's mock deliver its scan result (making
 * the device show up in the dialog's list) and flush the microtasks pickNativeDevice() and
 * ensureNativeBleInitialized() chain through — a setTimeout macrotask reliably drains all of
 * those first — then call selectNativeDevice() ourselves, same as the dialog would on a tap.
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

describe('NativeBleTransport.connect', () => {
  it('connects to the remembered device id directly, without scanning/picking', async () => {
    const opts = makeOpts('nbt-test-1');
    localStorage.setItem(opts.storageKey, 'AA:BB:CC:00:00:01');
    localStorage.setItem(`${opts.storageKey}Name`, 'FS-1');
    BleClient.connect.mockResolvedValue(undefined);

    const transport = new NativeBleTransport(opts);
    await transport.connect();

    expect(BleClient.requestLEScan).not.toHaveBeenCalled();
    expect(BleClient.connect).toHaveBeenCalledWith('AA:BB:CC:00:00:01', expect.any(Function));
    expect(BleClient.startNotifications).toHaveBeenCalledWith(
      'AA:BB:CC:00:00:01',
      opts.serviceUuid,
      opts.readCharUuid,
      expect.any(Function)
    );
    expect(transport.isConnected()).toBe(true);
  });

  it('opens the picker and remembers the picked device when nothing is remembered', async () => {
    const opts = makeOpts('nbt-test-2');
    BleClient.requestLEScan.mockImplementation((_options, callback) => {
      callback({ device: { deviceId: 'AA:BB:CC:00:00:02', name: 'FS-2' } });
      return Promise.resolve();
    });
    BleClient.connect.mockResolvedValue(undefined);

    const transport = new NativeBleTransport(opts);
    const connecting = transport.connect();
    await pickFoundDevice({ deviceId: 'AA:BB:CC:00:00:02', name: 'FS-2' });
    await connecting;

    expect(BleClient.requestLEScan).toHaveBeenCalledWith(
      { services: [opts.serviceUuid], namePrefix: opts.namePrefix },
      expect.any(Function)
    );
    expect(localStorage.getItem(opts.storageKey)).toBe('AA:BB:CC:00:00:02');
    expect(transport.isConnected()).toBe(true);
  });

  it('forces the picker when pick is requested, even with a remembered device', async () => {
    const opts = makeOpts('nbt-test-3');
    localStorage.setItem(opts.storageKey, 'AA:BB:CC:00:00:03');
    localStorage.setItem(`${opts.storageKey}Name`, 'FS-3');
    BleClient.requestLEScan.mockImplementation((_options, callback) => {
      callback({ device: { deviceId: 'AA:BB:CC:00:00:04', name: 'FS-4' } });
      return Promise.resolve();
    });
    BleClient.connect.mockResolvedValue(undefined);

    const transport = new NativeBleTransport(opts);
    const connecting = transport.connect({ pick: true });
    await pickFoundDevice({ deviceId: 'AA:BB:CC:00:00:04', name: 'FS-4' });
    await connecting;

    expect(BleClient.requestLEScan).toHaveBeenCalled();
    expect(localStorage.getItem(opts.storageKey)).toBe('AA:BB:CC:00:00:04');
  });

  it('rejects without opening the picker when silent and nothing is remembered', async () => {
    const opts = makeOpts('nbt-test-4');

    const transport = new NativeBleTransport(opts);
    await expect(transport.connect({ silent: true })).rejects.toThrow(
      'no remembered device to silently reconnect to'
    );

    expect(BleClient.requestLEScan).not.toHaveBeenCalled();
  });

  it('keeps the remembered device id after a failed connect attempt', async () => {
    const opts = makeOpts('nbt-test-5');
    localStorage.setItem(opts.storageKey, 'AA:BB:CC:00:00:05');
    localStorage.setItem(`${opts.storageKey}Name`, 'FS-5');
    BleClient.connect.mockRejectedValue(new Error('out of range'));

    const transport = new NativeBleTransport(opts);
    await expect(transport.connect()).rejects.toThrow('out of range');

    // Regression guard: a treadmill that's simply off/out of range must not need re-pairing.
    expect(localStorage.getItem(opts.storageKey)).toBe('AA:BB:CC:00:00:05');
    expect(transport.hasRemembered()).toBe(true);
    expect(transport.isConnected()).toBe(false);
  });

  it('re-arms notifications on every connect, and delivers them to listeners registered before reconnect', async () => {
    const opts = makeOpts('nbt-test-6');
    localStorage.setItem(opts.storageKey, 'AA:BB:CC:00:00:06');
    localStorage.setItem(`${opts.storageKey}Name`, 'FS-6');
    BleClient.connect.mockResolvedValue(undefined);

    const transport = new NativeBleTransport(opts);
    const received: Uint8Array[] = [];
    transport.onNotify((data) => received.push(data));

    await transport.connect();
    const firstCallback = BleClient.startNotifications.mock.calls[0][3] as (
      value: DataView
    ) => void;
    firstCallback(new DataView(new Uint8Array([1, 2, 3]).buffer));

    await transport.connect();
    const secondCallback = BleClient.startNotifications.mock.calls[1][3] as (
      value: DataView
    ) => void;
    secondCallback(new DataView(new Uint8Array([4, 5]).buffer));

    expect(received).toHaveLength(2);
    expect(Array.from(received[0])).toEqual([1, 2, 3]);
    expect(Array.from(received[1])).toEqual([4, 5]);
  });
});

describe('NativeBleTransport.disconnect callback', () => {
  it('notifies onDisconnect listeners and flips isConnected() when the native link drops', async () => {
    const opts = makeOpts('nbt-test-7');
    localStorage.setItem(opts.storageKey, 'AA:BB:CC:00:00:07');
    localStorage.setItem(`${opts.storageKey}Name`, 'FS-7');
    BleClient.connect.mockResolvedValue(undefined);

    const transport = new NativeBleTransport(opts);
    const disconnected = vi.fn();
    transport.onDisconnect(disconnected);
    await transport.connect();

    const onNativeDisconnect = BleClient.connect.mock.calls[0][1] as () => void;
    onNativeDisconnect();

    expect(disconnected).toHaveBeenCalled();
    expect(transport.isConnected()).toBe(false);
  });
});

describe('NativeBleTransport.forget', () => {
  it('disconnects and clears the remembered id', async () => {
    const opts = makeOpts('nbt-test-8');
    localStorage.setItem(opts.storageKey, 'AA:BB:CC:00:00:08');
    localStorage.setItem(`${opts.storageKey}Name`, 'FS-8');
    BleClient.connect.mockResolvedValue(undefined);

    const transport = new NativeBleTransport(opts);
    await transport.connect();
    await transport.forget();

    expect(BleClient.disconnect).toHaveBeenCalledWith('AA:BB:CC:00:00:08');
    expect(localStorage.getItem(opts.storageKey)).toBeNull();
    expect(transport.hasRemembered()).toBe(false);
    expect(transport.isConnected()).toBe(false);
  });
});
