import { FC, ReactNode } from 'react';

import { cn } from '../../utils';
import { SettingsNavigationSection } from './SettingsPanel';
import { SettingsPanelNavigationSection } from './SettingsPanelNavigationSection';

type SettingsPanelNavigationProps = {
  sections: SettingsNavigationSection[];
  footer?: ReactNode;
  className?: string;
};

export const SettingsPanelNavigation: FC<SettingsPanelNavigationProps> = ({
  sections,
  footer,
  className,
}) => (
  <nav
    className={cn(
      'border-border flex w-56 shrink-0 flex-col gap-4 overflow-y-auto border-r-(length:--border-width) p-4',
      className,
    )}
  >
    {sections.map((section) => (
      <SettingsPanelNavigationSection key={section.id} section={section} />
    ))}
    {footer && <div className="mt-auto">{footer}</div>}
  </nav>
);
