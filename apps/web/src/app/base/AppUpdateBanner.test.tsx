import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { resetAndroidVersionCheck } from '../androidApp';
import { isNativeApp } from '../ble/platform';
import AppUpdateBanner from './AppUpdateBanner';

vi.mock('../ble/platform', () => ({ isNativeApp: vi.fn(() => true) }));
vi.mock('@capacitor/app', () => ({
  App: { getInfo: vi.fn(async () => ({ version: '1.0.2', build: '2' })) },
}));
vi.mock('@capacitor/browser', () => ({ Browser: { open: vi.fn(async () => undefined) } }));

function publish(latest: { versionCode: number; versionName: string } | null) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(latest));
}

beforeEach(() => {
  localStorage.clear();
  resetAndroidVersionCheck();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.mocked(isNativeApp).mockReturnValue(true);
});

describe('AppUpdateBanner', () => {
  it('offers a newer published build and downloads it', async () => {
    publish({ versionCode: 5, versionName: '1.0.5' });
    render(<AppUpdateBanner />);

    fireEvent.click(await screen.findByRole('button', { name: 'Update' }));
    expect(screen.getByText(/1\.0\.5/)).toBeTruthy();
    expect(vi.mocked(Browser.open)).toHaveBeenCalledWith({
      url: expect.stringMatching(/runner\.apk$/),
    });
  });

  it('stays hidden when up to date, before anything is published, and in a browser', async () => {
    publish({ versionCode: 2, versionName: '1.0.2' });
    render(<AppUpdateBanner />);
    await vi.waitFor(() => expect(App.getInfo).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Update' })).toBeNull();
    cleanup();

    resetAndroidVersionCheck();
    publish(null);
    render(<AppUpdateBanner />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole('button', { name: 'Update' })).toBeNull();
    cleanup();

    resetAndroidVersionCheck();
    vi.mocked(isNativeApp).mockReturnValue(false);
    publish({ versionCode: 5, versionName: '1.0.5' });
    render(<AppUpdateBanner />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole('button', { name: 'Update' })).toBeNull();
  });

  it('once dismissed, comes back only for the next build', async () => {
    publish({ versionCode: 5, versionName: '1.0.5' });
    render(<AppUpdateBanner />);
    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('button', { name: 'Update' })).toBeNull();
    cleanup();

    render(<AppUpdateBanner />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole('button', { name: 'Update' })).toBeNull();
    cleanup();

    resetAndroidVersionCheck();
    publish({ versionCode: 6, versionName: '1.0.6' });
    render(<AppUpdateBanner />);
    expect(await screen.findByRole('button', { name: 'Update' })).toBeTruthy();
  });
});
