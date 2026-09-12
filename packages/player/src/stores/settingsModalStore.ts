import { create } from 'zustand';

export type SettingsTab =
  | 'general'
  | 'shortcuts'
  | 'plugins'
  | 'themes'
  | 'logs'
  | 'whats-new';

type SettingsModalState = {
  isOpen: boolean;
  activeTab: SettingsTab;
  // Phone-width only: the tab list is a drawer inside the panel. It lives here
  // rather than inside SettingsPanel so the Android back button can close it
  // before the panel itself.
  isNavOpen: boolean;
  open: (tab?: SettingsTab) => void;
  close: () => void;
  setActiveTab: (tab: SettingsTab) => void;
  setNavOpen: (isNavOpen: boolean) => void;
};

export const useSettingsModalStore = create<SettingsModalState>((set) => ({
  isOpen: false,
  activeTab: 'general',
  isNavOpen: false,
  open: (tab) =>
    set((state) => ({
      isOpen: true,
      isNavOpen: false,
      ...(tab ? { activeTab: tab } : { activeTab: state.activeTab }),
    })),
  close: () => set({ isOpen: false, isNavOpen: false }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setNavOpen: (isNavOpen) => set({ isNavOpen }),
}));
