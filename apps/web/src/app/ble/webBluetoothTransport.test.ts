import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebBluetoothTransport, type WebBluetoothTransportOptions } from './webBluetoothTransport';

function makeCharacteristic(): BluetoothRemoteGATTCharacteristic {
  const target = new EventTarget() as unknown as BluetoothRemoteGATTCharacteristic & EventTarget;
  Object.assign(target, {
    startNotifications: vi.fn().mockResolvedValue(target),
    stopNotifications: vi.fn().mockResolvedValue(target),
  });
  return target;
}

/** A device whose GATT chain connects successfully — mutates `gatt.connected` like a real one. */
function makeWorkingDevice(id: string, name: string): BluetoothDevice {
  const service = { getCharacteristic: vi.fn(() => Promise.resolve(makeCharacteristic())) };
  const server = { getPrimaryService: vi.fn().mockResolvedValue(service) };
  const gatt = {
    connected: false,
    connect: vi.fn(async () => {
      gatt.connected = true;
      return server;
    }),
    disconnect: vi.fn(() => {
      gatt.connected = false;
    }),
  };
  const target = new EventTarget() as unknown as BluetoothDevice & EventTarget;
  Object.assign(target, { id, name, gatt, forget: vi.fn().mockResolvedValue(undefined) });
  return target;
}

function stubBluetooth(overrides: Partial<Bluetooth>): void {
  vi.stubGlobal('navigator', { ...navigator, bluetooth: overrides as Bluetooth });
}

// getRemembered() caches by storageKey in-memory (see rememberedDevice.ts) and only
// invalidates on remember()/forget() — each test writes to localStorage directly for
// setup, so each needs its own key to avoid reading another test's stale cache entry.
function makeOpts(storageKey: string): WebBluetoothTransportOptions {
  return {
    serviceUuid: 'service',
    readCharUuid: 'read',
    writeCharUuid: 'write',
    filters: [{ namePrefix: 'FS-' }],
    storageKey,
  };
}

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('WebBluetoothTransport.connect', () => {
  it('connects to the remembered device without opening the picker', async () => {
    const opts = makeOpts('wbt-test-1');
    const device = makeWorkingDevice('d1', 'FS-1');
    localStorage.setItem(opts.storageKey, 'd1');
    localStorage.setItem(`${opts.storageKey}Name`, 'FS-1');
    const requestDevice = vi.fn();
    stubBluetooth({ getDevices: vi.fn().mockResolvedValue([device]), requestDevice });

    const transport = new WebBluetoothTransport(opts);
    await transport.connect();

    expect(requestDevice).not.toHaveBeenCalled();
    expect(transport.isConnected()).toBe(true);
  });

  it('opens the picker when nothing is remembered', async () => {
    const opts = makeOpts('wbt-test-2');
    const picked = makeWorkingDevice('d2', 'FS-2');
    const requestDevice = vi.fn().mockResolvedValue(picked);
    stubBluetooth({ getDevices: vi.fn().mockResolvedValue([]), requestDevice });

    const transport = new WebBluetoothTransport(opts);
    await transport.connect();

    expect(requestDevice).toHaveBeenCalledWith({ filters: opts.filters });
    expect(localStorage.getItem(opts.storageKey)).toBe('d2');
  });

  it('forces the picker when pick is requested, even with a remembered device', async () => {
    const opts = makeOpts('wbt-test-3');
    const remembered = makeWorkingDevice('d3', 'FS-3');
    const picked = makeWorkingDevice('d4', 'FS-4');
    localStorage.setItem(opts.storageKey, 'd3');
    localStorage.setItem(`${opts.storageKey}Name`, 'FS-3');
    const requestDevice = vi.fn().mockResolvedValue(picked);
    stubBluetooth({ getDevices: vi.fn().mockResolvedValue([remembered]), requestDevice });

    const transport = new WebBluetoothTransport(opts);
    await transport.connect({ pick: true });

    expect(requestDevice).toHaveBeenCalled();
    expect(localStorage.getItem(opts.storageKey)).toBe('d4');
  });

  it('rejects without opening the picker when silent and getDevices finds nothing', async () => {
    const opts = makeOpts('wbt-test-6');
    localStorage.setItem(opts.storageKey, 'd7');
    localStorage.setItem(`${opts.storageKey}Name`, 'FS-7');
    const requestDevice = vi.fn();
    // getDevices() not finding the remembered id — e.g. permission revoked, or the browser
    // doesn't support it at all — is exactly the case that used to fall through to the picker
    // and fail with an un-actionable SecurityError since there's no user gesture on mount.
    stubBluetooth({ getDevices: vi.fn().mockResolvedValue([]), requestDevice });

    const transport = new WebBluetoothTransport(opts);
    await expect(transport.connect({ silent: true })).rejects.toThrow(
      'no remembered device to silently reconnect to'
    );

    expect(requestDevice).not.toHaveBeenCalled();
  });

  it('keeps the remembered device id after a failed connect attempt', async () => {
    const opts = makeOpts('wbt-test-4');
    const device = makeWorkingDevice('d5', 'FS-5');
    (device.gatt as unknown as { connect: () => Promise<never> }).connect = vi
      .fn()
      .mockRejectedValue(new Error('out of range'));
    localStorage.setItem(opts.storageKey, 'd5');
    localStorage.setItem(`${opts.storageKey}Name`, 'FS-5');
    stubBluetooth({ getDevices: vi.fn().mockResolvedValue([device]), requestDevice: vi.fn() });

    const transport = new WebBluetoothTransport(opts);
    await expect(transport.connect()).rejects.toThrow('out of range');

    // Regression guard: a treadmill that's simply off/out of range must not need re-pairing.
    expect(localStorage.getItem(opts.storageKey)).toBe('d5');
    expect(transport.hasRemembered()).toBe(true);
  });
});

describe('WebBluetoothTransport.forget', () => {
  it('disconnects, revokes the browser permission, and clears the remembered id', async () => {
    const opts = makeOpts('wbt-test-5');
    const device = makeWorkingDevice('d6', 'FS-6');
    localStorage.setItem(opts.storageKey, 'd6');
    localStorage.setItem(`${opts.storageKey}Name`, 'FS-6');
    stubBluetooth({ getDevices: vi.fn().mockResolvedValue([device]), requestDevice: vi.fn() });

    const transport = new WebBluetoothTransport(opts);
    await transport.connect();
    await transport.forget();

    expect(device.forget).toHaveBeenCalled();
    expect(localStorage.getItem(opts.storageKey)).toBeNull();
    expect(transport.hasRemembered()).toBe(false);
    expect(transport.isConnected()).toBe(false);
  });
});
