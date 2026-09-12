import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type MobileDrawer = 'navigation' | 'queue';

export interface LayoutState {
  leftSidebar: {
    isCollapsed: boolean;
    width: number;
  };
  rightSidebar: {
    isCollapsed: boolean;
    width: number;
  };
  // Which overlay drawer is open on a phone-sized screen. Only one at a time,
  // and never persisted: the app always starts with both drawers closed.
  openDrawer: MobileDrawer | null;
  toggleDrawer: (drawer: MobileDrawer) => void;
  closeDrawer: () => void;
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setLeftSidebarWidth: (width: number) => void;
  setRightSidebarWidth: (width: number) => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      leftSidebar: {
        isCollapsed: false,
        width: 200,
      },
      rightSidebar: {
        isCollapsed: false,
        width: 200,
      },
      openDrawer: null,
      toggleDrawer: (drawer: MobileDrawer) =>
        set((state) => ({
          openDrawer: state.openDrawer === drawer ? null : drawer,
        })),
      closeDrawer: () => set({ openDrawer: null }),
      toggleLeftSidebar: () =>
        set((state) => ({
          leftSidebar: {
            ...state.leftSidebar,
            isCollapsed: !state.leftSidebar.isCollapsed,
          },
        })),
      toggleRightSidebar: () =>
        set((state) => ({
          rightSidebar: {
            ...state.rightSidebar,
            isCollapsed: !state.rightSidebar.isCollapsed,
          },
        })),
      setLeftSidebarWidth: (width: number) =>
        set((state) => ({
          leftSidebar: {
            ...state.leftSidebar,
            width,
          },
        })),
      setRightSidebarWidth: (width: number) =>
        set((state) => ({
          rightSidebar: {
            ...state.rightSidebar,
            width,
          },
        })),
    }),
    {
      name: 'nuclear-layout-store',
      partialize: (state) => ({
        leftSidebar: state.leftSidebar,
        rightSidebar: state.rightSidebar,
      }),
    },
  ),
);
