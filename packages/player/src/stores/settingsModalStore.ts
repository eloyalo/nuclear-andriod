import { create } from 'zustand';

type SettingsModalState = {
  isOpen: boolean;
  activeItemId: string | null;
  // Phone-width only: the nav sections are a drawer inside the panel. It lives
  // here rather than inside SettingsPanel so the Android back button can close
  // it before the panel itself.
  isNavOpen: boolean;
  open: (itemId?: string) => void;
  close: () => void;
  selectItem: (itemId: string) => void;
  setNavOpen: (isNavOpen: boolean) => void;
};

export const useSettingsModalStore = create<SettingsModalState>((set) => ({
  isOpen: false,
  activeItemId: null,
  isNavOpen: false,
  open: (itemId) =>
    set((state) => ({
      isOpen: true,
      isNavOpen: false,
      activeItemId: itemId ?? state.activeItemId,
    })),
  close: () => set({ isOpen: false, isNavOpen: false }),
  selectItem: (itemId) => set({ activeItemId: itemId }),
  setNavOpen: (isNavOpen) => set({ isNavOpen }),
}));
