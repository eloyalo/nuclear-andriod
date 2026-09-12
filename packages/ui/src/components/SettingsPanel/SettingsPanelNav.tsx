import { FC, ReactNode } from 'react';

import { cn } from '../../utils';
import { SettingsTab } from './SettingsPanel';
import { SettingsPanelNavItem } from './SettingsPanelNavItem';

type SettingsPanelNavProps = {
  tabs: SettingsTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  footer?: ReactNode;
  className?: string;
};

export const SettingsPanelNav: FC<SettingsPanelNavProps> = ({
  tabs,
  activeTab,
  onTabChange,
  footer,
  className,
}) => (
  <nav
    className={cn(
      'border-border flex w-56 shrink-0 flex-col overflow-y-auto border-r-(length:--border-width) p-4',
      className,
    )}
  >
    <div className="flex flex-col gap-1">
      {tabs.map((tab) => (
        <SettingsPanelNavItem
          key={tab.id}
          id={tab.id}
          label={tab.label}
          icon={tab.icon}
          isActive={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
        />
      ))}
    </div>
    {footer && <div className="mt-auto">{footer}</div>}
  </nav>
);
