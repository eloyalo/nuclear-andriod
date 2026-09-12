import { useIsCompactLayout } from '@nuclearplayer/ui';

import { MobileDrawer, useLayoutStore } from '../stores/layoutStore';

type SidebarProps = {
  width: number;
  isCollapsed: boolean;
  onToggle: () => void;
  onWidthChange: (width: number) => void;
};

type WorkspaceLayout = {
  isCompact: boolean;
  openDrawer: MobileDrawer | null;
  toggleDrawer: (drawer: MobileDrawer) => void;
  closeDrawer: () => void;
  left: SidebarProps;
  right: SidebarProps;
};

/**
 * Bridges the layout store to `PlayerWorkspace`'s sidebar props. On a desktop
 * width the sidebars are resizable panels that remember their collapsed state;
 * on a phone they become overlay drawers, mutually exclusive and never
 * persisted, so `isCollapsed` means "drawer closed" there.
 */
export const useWorkspaceLayout = (): WorkspaceLayout => {
  const isCompact = useIsCompactLayout();
  const leftSidebar = useLayoutStore((state) => state.leftSidebar);
  const rightSidebar = useLayoutStore((state) => state.rightSidebar);
  const openDrawer = useLayoutStore((state) => state.openDrawer);
  const toggleDrawer = useLayoutStore((state) => state.toggleDrawer);
  const closeDrawer = useLayoutStore((state) => state.closeDrawer);
  const toggleLeftSidebar = useLayoutStore((state) => state.toggleLeftSidebar);
  const toggleRightSidebar = useLayoutStore(
    (state) => state.toggleRightSidebar,
  );
  const setLeftSidebarWidth = useLayoutStore(
    (state) => state.setLeftSidebarWidth,
  );
  const setRightSidebarWidth = useLayoutStore(
    (state) => state.setRightSidebarWidth,
  );

  return {
    isCompact,
    openDrawer,
    toggleDrawer,
    closeDrawer,
    left: {
      width: leftSidebar.width,
      isCollapsed: isCompact
        ? openDrawer !== 'navigation'
        : leftSidebar.isCollapsed,
      onToggle: isCompact
        ? () => toggleDrawer('navigation')
        : toggleLeftSidebar,
      onWidthChange: setLeftSidebarWidth,
    },
    right: {
      width: rightSidebar.width,
      isCollapsed: isCompact
        ? openDrawer !== 'queue'
        : rightSidebar.isCollapsed,
      onToggle: isCompact ? () => toggleDrawer('queue') : toggleRightSidebar,
      onWidthChange: setRightSidebarWidth,
    },
  };
};
