import { FC } from 'react';

import { useTranslation } from '@nuclearplayer/i18n';
import { SettingsPanel } from '@nuclearplayer/ui';

import { useSettingsModalStore } from '../stores/settingsModalStore';
import { SocialLinks } from './SocialLinks';
import { useSettingsNavigation } from './useSettingsNavigation';
import { VersionString } from './VersionString';

export const ConnectedSettingsModal: FC = () => {
  const { t: tNav } = useTranslation('navigation');
  const { isOpen, close, isNavOpen, setNavOpen } = useSettingsModalStore();
  const { sections, content } = useSettingsNavigation();

  return (
    <SettingsPanel
      isOpen={isOpen}
      onClose={close}
      sections={sections}
      isNavOpen={isNavOpen}
      onNavOpenChange={setNavOpen}
      navLabel={tNav('menu')}
      navigationFooter={
        <div className="flex flex-col items-center gap-2">
          <SocialLinks />
          <VersionString />
        </div>
      }
    >
      {content}
    </SettingsPanel>
  );
};
