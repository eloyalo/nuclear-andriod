import { FC, useEffect, useState } from 'react';

import { useTranslation } from '@nuclearplayer/i18n';
import { Button } from '@nuclearplayer/ui';

import { isFlatpak } from '../services/tauri/commands';

const DISMISSED_KEY = 'flatpak-warning-dismissed';

export const FlatpakWarningBanner: FC = () => {
  const { t } = useTranslation('flatpak');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let wasDismissed = false;
    try {
      wasDismissed = localStorage.getItem(DISMISSED_KEY) === 'true';
    } catch {
      // localStorage can be unavailable or throw (restricted WebView
      // contexts, privacy settings); treat that the same as "not dismissed".
    }
    if (wasDismissed) {
      return;
    }

    isFlatpak()
      .then((result) => {
        if (result) {
          setVisible(true);
        }
      })
      .catch(() => {});
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, 'true');
    } catch {
      // Best-effort; worst case the banner reappears next launch.
    }
    setVisible(false);
  };

  if (!visible) {
    return null;
  }

  return (
    <div
      data-testid="flatpak-warning-banner"
      className="surface-accent-orange flex items-center justify-center gap-4 px-3 py-1 text-xs tracking-wide text-[color-mix(in_oklch,var(--accent-orange),black_50%)] uppercase"
    >
      <span>{t('sandboxWarning')}</span>
      <Button
        variant="ghost"
        size="flexible"
        onClick={dismiss}
        data-testid="flatpak-warning-dismiss"
        className="px-2 py-0.5"
      >
        {t('dismiss')}
      </Button>
    </div>
  );
};
