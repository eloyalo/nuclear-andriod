import { FC, ReactNode } from 'react';

import { useIsCompactLayout } from '../../hooks/useIsCompactLayout';
import { cn } from '../../utils';
import { PlayerWorkspaceProvider } from './PlayerWorkspaceContext';
import { PlayerWorkspaceLeftSidebar } from './PlayerWorkspaceLeftSidebar';
import { PlayerWorkspaceRightSidebar } from './PlayerWorkspaceRightSidebar';

type PlayerWorkspaceProps = {
  children: ReactNode;
  className?: string;
  isCompact?: boolean;
};

type MainProps = {
  children?: ReactNode;
  className?: string;
};

const PlayerWorkspaceMain: FC<MainProps> = ({ children, className = '' }) => {
  return (
    <main
      data-testid="player-workspace-main"
      className={cn('surface-muted overflow-auto', className)}
    >
      {children}
    </main>
  );
};

type PlayerWorkspaceComponent = FC<PlayerWorkspaceProps> & {
  LeftSidebar: typeof PlayerWorkspaceLeftSidebar;
  RightSidebar: typeof PlayerWorkspaceRightSidebar;
  Main: typeof PlayerWorkspaceMain;
};

const PlayerWorkspaceImpl: FC<PlayerWorkspaceProps> = ({
  children,
  className = '',
  isCompact,
}) => {
  const isCompactLayout = useIsCompactLayout();
  // On a phone the sidebars turn into overlay drawers, so they leave the grid
  // flow entirely and the main area gets the full width.
  const compact = isCompact ?? isCompactLayout;

  return (
    <PlayerWorkspaceProvider isCompact={compact}>
      <div
        className={cn(
          'surface-muted relative grid h-full min-h-0',
          compact ? 'grid-cols-1' : 'grid-cols-[auto_1fr_auto]',
          className,
        )}
      >
        {children}
      </div>
    </PlayerWorkspaceProvider>
  );
};

export const PlayerWorkspace = PlayerWorkspaceImpl as PlayerWorkspaceComponent;
PlayerWorkspace.LeftSidebar = PlayerWorkspaceLeftSidebar;
PlayerWorkspace.RightSidebar = PlayerWorkspaceRightSidebar;
PlayerWorkspace.Main = PlayerWorkspaceMain;
