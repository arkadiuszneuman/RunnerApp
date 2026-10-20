import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { isNativeApp } from '../ble/platform';
import InstallAppBanner from './InstallAppBanner';

vi.mock('../ble/platform', () => ({ isNativeApp: vi.fn(() => false) }));

const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/130 Mobile';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';

function setUserAgent(ua: string) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua);
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.mocked(isNativeApp).mockReturnValue(false);
});

describe('InstallAppBanner', () => {
  it('offers the APK in an Android browser', () => {
    setUserAgent(ANDROID_UA);
    render(<InstallAppBanner />);

    expect(screen.getByRole('link', { name: 'Download' }).getAttribute('href')).toMatch(
      /runner\.apk$/
    );
  });

  it('stays hidden inside the app and on other platforms', () => {
    setUserAgent(IPHONE_UA);
    render(<InstallAppBanner />);
    expect(screen.queryByRole('link', { name: 'Download' })).toBeNull();
    cleanup();

    setUserAgent(ANDROID_UA);
    vi.mocked(isNativeApp).mockReturnValue(true);
    render(<InstallAppBanner />);
    expect(screen.queryByRole('link', { name: 'Download' })).toBeNull();
  });

  it('remembers being dismissed', () => {
    setUserAgent(ANDROID_UA);
    render(<InstallAppBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('link', { name: 'Download' })).toBeNull();
    cleanup();

    render(<InstallAppBanner />);
    expect(screen.queryByRole('link', { name: 'Download' })).toBeNull();
  });
});
