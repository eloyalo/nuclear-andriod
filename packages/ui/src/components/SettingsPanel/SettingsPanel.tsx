import { MenuIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { FC, ReactNode } from 'react';

import { useIsCompactLayout } from '../../hooks/useIsCompactLayout';
import { Button } from '../Button';
import { DialogRoot } from '../Dialog/DialogRoot';
import { SettingsPanelContent } from './SettingsPanelContent';
import { SettingsPanelNav } from './SettingsPanelNav';

export type SettingsTab = {
  id: string;
  label: string;
  icon: ReactNode;
  content: () => ReactNode;
};

type SettingsPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  tabs: SettingsTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  navFooter?: ReactNode;
  /**
   * Phone-width only: the tab list becomes a drawer behind a hamburger, so its
   * open state is controlled from outside to let the Android back button close
   * it before the panel itself.
   */
  isNavOpen?: boolean;
  onNavOpenChange?: (isOpen: boolean) => void;
  navLabel?: string;
};

export const SettingsPanel: FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  tabs,
  activeTab,
  onTabChange,
  navFooter,
  isNavOpen = false,
  onNavOpenChange,
  navLabel,
}) => {
  const isCompact = useIsCompactLayout();
  const active = tabs.find((tab) => tab.id === activeTab);
  const activeTabContent = active?.content;

  if (isCompact) {
    return (
      <DialogRoot
        isOpen={isOpen}
        onClose={onClose}
        className="flex h-full w-full max-w-none flex-col overflow-hidden p-0"
      >
        {/* pr-10 keeps the title clear of the dialog's own close button */}
        <header className="border-border flex shrink-0 items-center gap-1 border-b-(length:--border-width) p-2 pr-10">
          <Button
            size="icon"
            variant="text"
            aria-label={navLabel}
            data-testid="settings-nav-toggle"
            onClick={() => onNavOpenChange?.(!isNavOpen)}
          >
            <MenuIcon size={20} />
          </Button>
          <span
            className="truncate font-bold"
            data-testid="settings-active-tab"
          >
            {active?.label}
          </span>
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <SettingsPanelContent>
            {activeTabContent && activeTabContent()}
          </SettingsPanelContent>

          <AnimatePresence>
            {isNavOpen && (
              <motion.div
                key="settings-nav-backdrop"
                data-testid="settings-nav-backdrop"
                className="absolute inset-0 z-10 bg-black/50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => onNavOpenChange?.(false)}
              />
            )}
          </AnimatePresence>

          <motion.div
            data-testid="settings-nav-drawer"
            aria-hidden={!isNavOpen}
            className="absolute inset-y-0 left-0 z-20 flex"
            animate={{ x: isNavOpen ? '0%' : '-100%' }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 30,
              mass: 0.8,
            }}
          >
            <SettingsPanelNav
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={(tabId) => {
                onTabChange(tabId);
                onNavOpenChange?.(false);
              }}
              footer={navFooter}
              className="surface-background w-[min(80vw,16rem)]"
            />
          </motion.div>
        </div>
      </DialogRoot>
    );
  }

  return (
    <DialogRoot
      isOpen={isOpen}
      onClose={onClose}
      className="flex h-[80vh] max-h-[900px] w-[80vw] max-w-6xl p-0"
    >
      <SettingsPanelNav
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
        footer={navFooter}
      />
      <SettingsPanelContent>
        {activeTabContent && activeTabContent()}
      </SettingsPanelContent>
    </DialogRoot>
  );
};
