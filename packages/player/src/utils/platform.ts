import { platform } from '@tauri-apps/plugin-os';

export const isMobile = () => {
  const current = platform();
  return current === 'android' || current === 'ios';
};

export const isAndroid = () => platform() === 'android';

// Desktop-only integrations (MPD, MCP, the local HTTP API, Discord presence)
// aren't compiled into the mobile binary, so their commands don't exist there.
export const skipOnMobile =
  <T>(init: () => Promise<T> | T) =>
  () =>
    isMobile() ? undefined : init();
