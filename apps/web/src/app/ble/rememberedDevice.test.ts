import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findRememberedDevice,
  forget,
  getRemembered,
  pickDevice,
  useRememberedDevice,
} from './rememberedDevice';

/** Minimal EventTarget-backed stand-in for a BluetoothDevice. */
function makeDevice(id: string, name: string): BluetoothDevice {
  const target = new EventTarget() as unknown as BluetoothDevice & EventTarget;
  Object.assign(target, { id, name, gatt: undefined });
  return target;
}

function stubBluetooth(overrides: Partial<Bluetooth>): void {
  vi.stubGlobal('navigator', { ...navigator, bluetooth: overrides as Bluetooth });
}

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('remember / forget', () => {
  it('round-trips through pickDevice and forget, notifying subscribers', async () => {
    const device = makeDevice('device-1', 'FS-Treadmill');
    stubBluetooth({ requestDevice: vi.fn().mockResolvedValue(device) });

    const { result } = renderHook(() => useRememberedDevice('rd-test-1'));
    expect(result.current).toBeNull();

    await act(async () => {
      await pickDevice('rd-test-1', { filters: [] });
    });
    await waitFor(() => expect(result.current).toEqual({ id: 'device-1', name: 'FS-Treadmill' }));
    expect(localStorage.getItem('rd-test-1')).toBe('device-1');

    act(() => forget('rd-test-1'));
    await waitFor(() => expect(result.current).toBeNull());
    expect(localStorage.getItem('rd-test-1')).toBeNull();
  });
});

describe('findRememberedDevice', () => {
  it('returns undefined when nothing is remembered', async () => {
    stubBluetooth({ getDevices: vi.fn() });
    await expect(findRememberedDevice('rd-test-none')).resolves.toBeUndefined();
  });

  it('returns undefined when the browser has no getDevices support', async () => {
    localStorage.setItem('rd-test-2', 'device-2');
    stubBluetooth({});
    await expect(findRememberedDevice('rd-test-2')).resolves.toBeUndefined();
  });

  it('resolves once the remembered device advertises', async () => {
    const device = makeDevice('device-3', 'Polar H10');
    // Never settles on its own — the test drives it via a real advertisementreceived event.
    Object.assign(device, { watchAdvertisements: vi.fn(() => new Promise(() => {})) });
    localStorage.setItem('rd-test-3', 'device-3');
    stubBluetooth({ getDevices: vi.fn().mockResolvedValue([device]) });

    const promise = findRememberedDevice('rd-test-3', 5000);
    // Let the getDevices()/addEventListener setup microtasks run before dispatching.
    await new Promise((resolve) => setTimeout(resolve, 0));
    device.dispatchEvent(new Event('advertisementreceived'));

    await expect(promise).resolves.toBe(device);
  });

  it('resolves with the device once the timeout elapses without an advertisement', async () => {
    vi.useFakeTimers();
    const device = makeDevice('device-4', 'Polar H10');
    Object.assign(device, { watchAdvertisements: vi.fn(() => new Promise(() => {})) });
    localStorage.setItem('rd-test-4', 'device-4');
    stubBluetooth({ getDevices: vi.fn().mockResolvedValue([device]) });

    const promise = findRememberedDevice('rd-test-4', 3000);
    await vi.advanceTimersByTimeAsync(3000);

    await expect(promise).resolves.toBe(device);
  });
});

describe('getRemembered', () => {
  beforeEach(() => localStorage.clear());

  it('reads the id and name back from storage', () => {
    localStorage.setItem('rd-test-5', 'device-5');
    localStorage.setItem('rd-test-5Name', 'FS-1234');
    expect(getRemembered('rd-test-5')).toEqual({ id: 'device-5', name: 'FS-1234' });
  });
});
