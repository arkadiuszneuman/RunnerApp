import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  NativeHeartRateTransport,
  type NativeHeartRateTransportOptions,
} from './nativeHeartRateTransport';

const { BleClient } = vi.hoisted(() => ({
  BleClient: {
    initialize: vi.fn().mockResolvedValue(undefined),
    requestDevice: vi.fn(),
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

afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('NativeHeartRateTransport.connect', () => {
  it('connects to the remembered device id directly, without scanning/picking', async () => {
    const opts = makeOpts('nhrt-test-1');
    localStorage.setItem(opts.storageKey, 'AA:BB:CC:00:01:01');
    localStorage.setItem(`${opts.storageKey}Name`, 'HR-1');
    BleClient.connect.mockResolvedValue(undefined);

    const transport = new NativeHeartRateTransport(opts);
    await transport.connect();

    expect(BleClient.requestDevice).not.toHaveBeenCalled();
    expect(BleClient.connect).toHaveBeenCalledWith('AA:BB:CC:00:01:01', expect.any(Function));
    expect(transport.isConnected()).toBe(true);
  });

  it('opens the picker unfiltered when nothing is remembered (many devices only expose the heart_rate service after connecting, not in their advertisement)', async () => {
    const opts = makeOpts('nhrt-test-2');
    BleClient.requestDevice.mockResolvedValue({ deviceId: 'AA:BB:CC:00:01:02', name: 'HR-2' });
    BleClient.connect.mockResolvedValue(undefined);

    const transport = new NativeHeartRateTransport(opts);
    await transport.connect();

    expect(BleClient.requestDevice).toHaveBeenCalledWith({});
    expect(localStorage.getItem(opts.storageKey)).toBe('AA:BB:CC:00:01:02');
  });

  it('rejects without opening the picker when silent and nothing is remembered', async () => {
    const opts = makeOpts('nhrt-test-3');

    const transport = new NativeHeartRateTransport(opts);
    await expect(transport.connect({ silent: true })).rejects.toThrow(
      'no remembered device to silently reconnect to'
    );

    expect(BleClient.requestDevice).not.toHaveBeenCalled();
  });

  it('reuses the already-known device id on a later reconnect instead of re-picking', async () => {
    const opts = makeOpts('nhrt-test-4');
    BleClient.requestDevice.mockResolvedValue({ deviceId: 'AA:BB:CC:00:01:04', name: 'HR-4' });
    BleClient.connect.mockResolvedValue(undefined);

    const transport = new NativeHeartRateTransport(opts);
    await transport.connect();
    await transport.connect();

    expect(BleClient.requestDevice).toHaveBeenCalledTimes(1);
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
