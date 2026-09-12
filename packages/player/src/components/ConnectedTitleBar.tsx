import { getCurrentWindow } from '@tauri-apps/api/window';
import { FC } from 'react';

import { useTranslation } from '@nuclearplayer/i18n';
import { TitleBar } from '@nuclearplayer/ui';

import { useCoreSetting } from '../hooks/useCoreSetting';
import { isMobile } from '../utils/platform';

const appWindow = getCurrentWindow();

export const ConnectedTitleBar: FC = () => {
  const [isEnabled] = useCoreSetting<boolean>('appearance.customTitleBar');
  const { t } = useTranslation('titleBar');
  const [titleBarStyle] = useCoreSetting<string>('appearance.titleBarStyle');

  // Android/iOS have no window to minimize, maximize, close or drag, and the
  // matching core:window:* permissions aren't in the mobile capability.
  if (isMobile()) {
    return null;
  }

  const styleOverride =
    titleBarStyle === 'auto' || !titleBarStyle
      ? undefined
      : (titleBarStyle as 'macos' | 'windows');

  return (
    isEnabled && (
      <TitleBar
        title={t('title')}
        styleOverride={styleOverride}
        onMinimize={() => appWindow.minimize()}
        onMaximize={() => appWindow.toggleMaximize()}
        onClose={() => appWindow.close()}
        onStartDrag={() => appWindow.startDragging()}
        labels={{
          minimize: t('minimize'),
          maximize: t('maximize'),
          close: t('close'),
        }}
      />
    )
  );
};
