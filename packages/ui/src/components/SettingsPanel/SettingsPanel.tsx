import { MenuIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { FC, ReactNode } from 'react';

import { useIsCompactLayout } from '../../hooks/useIsCompactLayout';
import { Button } from '../Button';
import { DialogRoot } from '../Dialog/DialogRoot';
import { SettingsPanelContent } from './SettingsPanelContent';
import { SettingsPanelNavigation } from './SettingsPanelNavigation';

export type SettingsNavigationItem = {
  id: string;
  label: string;
  icon?: ReactNode;
};

export type SettingsNavigationSection = {
  id: string;
  label: string;
  items: SettingsNavigationItem[];
  activeItemId: string | null;
  onSelect: (itemId: string) => void;
};

type SettingsPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  sections: SettingsNavigationSection[];
  navigationFooter?: ReactNode;
  children: ReactNode;
  /**
   * Phone-width only: the navigation becomes a drawer behind a hamburger, so
   * its open state is controlled from outside to let the Android back button
   * close it before the panel itself.
   */
  isNavOpen?: boolean;
  onNavOpenChange?: (isOpen: boolean) => void;
  navLabel?: string;
};

export const SettingsPanel: FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  sections,
  navigationFooter,
  children,
  isNavOpen = false,
  onNavOpenChange,
  navLabel,
}) => {
  const isCompact = useIsCompactLayout();
  const activeItemId = sections[0]?.activeItemId ?? null;
  const activeItem = sections
    .flatMap((section) => section.items)
    .find((item) => item.id === activeItemId);

  if (isCompact) {
    const closingSections = sections.map((section) => ({
      ...section,
      onSelect: (itemId: string) => {
        section.onSelect(itemId);
        onNavOpenChange?.(false);
      },
    }));

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
            {activeItem?.label}
          </span>
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <SettingsPanelContent>{children}</SettingsPanelContent>

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
            <SettingsPanelNavigation
              sections={closingSections}
              footer={navigationFooter}
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
      className="narrow:inset-0 narrow:rounded-none narrow:border-0 fixed inset-8 flex w-auto max-w-none p-0"
    >
      <SettingsPanelNavigation sections={sections} footer={navigationFooter} />
      <SettingsPanelContent>{children}</SettingsPanelContent>
    </DialogRoot>
  );
};
