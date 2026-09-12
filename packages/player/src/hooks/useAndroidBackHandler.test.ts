import { platform } from '@tauri-apps/plugin-os';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAndroidBackHandler } from './useAndroidBackHandler';

vi.mock('@tauri-apps/plugin-os', () => ({
  platform: vi.fn(() => 'linux'),
}));

const mockedPlatform = vi.mocked(platform);

describe('useAndroidBackHandler', () => {
  beforeEach(() => {
    delete window.__nuclearOnBack__;
    mockedPlatform.mockReturnValue('android');
  });

  it('does not touch the global handler on desktop', () => {
    mockedPlatform.mockReturnValue('linux');

    renderHook(() => useAndroidBackHandler(() => true));

    expect(window.__nuclearOnBack__).toBeUndefined();
  });

  it('exposes the handler to the Android activity', () => {
    renderHook(() => useAndroidBackHandler(() => true));

    expect(window.__nuclearOnBack__?.()).toBe(true);
  });

  it('calls the latest handler after a rerender', () => {
    const { rerender } = renderHook(
      ({ handled }: { handled: boolean }) =>
        useAndroidBackHandler(() => handled),
      { initialProps: { handled: true } },
    );

    expect(window.__nuclearOnBack__?.()).toBe(true);

    rerender({ handled: false });

    expect(window.__nuclearOnBack__?.()).toBe(false);
  });

  it('removes the handler on unmount', () => {
    const { unmount } = renderHook(() => useAndroidBackHandler(() => true));

    unmount();

    expect(window.__nuclearOnBack__).toBeUndefined();
  });
});
