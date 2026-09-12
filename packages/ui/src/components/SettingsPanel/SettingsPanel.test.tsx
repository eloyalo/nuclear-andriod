import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  BlocksIcon,
  PaletteIcon,
  ScrollTextIcon,
  Settings2Icon,
} from 'lucide-react';

import { SettingsPanel, SettingsTab } from './SettingsPanel';

const TABS: SettingsTab[] = [
  {
    id: 'general',
    label: 'General',
    icon: <Settings2Icon />,
    content: () => <div>General content</div>,
  },
  {
    id: 'plugins',
    label: 'Plugins',
    icon: <BlocksIcon />,
    content: () => <div>Plugins content</div>,
  },
  {
    id: 'themes',
    label: 'Themes',
    icon: <PaletteIcon />,
    content: () => <div>Themes content</div>,
  },
  {
    id: 'logs',
    label: 'Logs',
    icon: <ScrollTextIcon />,
    content: () => <div>Logs content</div>,
  },
];

describe('SettingsPanel', () => {
  it('(Snapshot) renders when open', () => {
    const { asFragment } = render(
      <SettingsPanel
        isOpen
        onClose={() => {}}
        tabs={TABS}
        activeTab="general"
        onTabChange={() => {}}
      />,
    );
    expect(asFragment()).toMatchSnapshot();
  });

  describe('compact layout', () => {
    const originalMatchMedia = window.matchMedia;

    const matchCompactLayout = (matches: boolean) => {
      window.matchMedia = ((query: string) => ({
        matches,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      })) as unknown as typeof window.matchMedia;
    };

    beforeEach(() => matchCompactLayout(true));
    afterEach(() => {
      window.matchMedia = originalMatchMedia;
    });

    const renderCompact = (overrides = {}) =>
      render(
        <SettingsPanel
          isOpen
          onClose={() => {}}
          tabs={TABS}
          activeTab="general"
          onTabChange={() => {}}
          navLabel="Menu"
          {...overrides}
        />,
      );

    it('(Snapshot) renders behind a hamburger', () => {
      const { asFragment } = renderCompact();
      expect(asFragment()).toMatchSnapshot();
    });

    it('names the active tab in the header', () => {
      renderCompact({ activeTab: 'themes' });

      expect(screen.getByTestId('settings-active-tab')).toHaveTextContent(
        'Themes',
      );
      expect(screen.getByText('Themes content')).toBeInTheDocument();
    });

    it('opens the tab list from the hamburger', async () => {
      const onNavOpenChange = vi.fn();
      renderCompact({ onNavOpenChange });

      await userEvent.click(screen.getByTestId('settings-nav-toggle'));

      expect(onNavOpenChange).toHaveBeenCalledWith(true);
    });

    it('closes the tab list after picking a tab', async () => {
      const onTabChange = vi.fn();
      const onNavOpenChange = vi.fn();
      renderCompact({ isNavOpen: true, onTabChange, onNavOpenChange });

      await userEvent.click(screen.getByTestId('settings-tab-logs'));

      expect(onTabChange).toHaveBeenCalledWith('logs');
      expect(onNavOpenChange).toHaveBeenCalledWith(false);
    });

    it('shows a backdrop only while the tab list is open', () => {
      const { rerender } = renderCompact({ isNavOpen: false });
      expect(
        screen.queryByTestId('settings-nav-backdrop'),
      ).not.toBeInTheDocument();

      rerender(
        <SettingsPanel
          isOpen
          onClose={() => {}}
          tabs={TABS}
          activeTab="general"
          onTabChange={() => {}}
          navLabel="Menu"
          isNavOpen
        />,
      );

      expect(screen.getByTestId('settings-nav-backdrop')).toBeInTheDocument();
    });

    it('dismisses the tab list from the backdrop', async () => {
      const onNavOpenChange = vi.fn();
      renderCompact({ isNavOpen: true, onNavOpenChange });

      await userEvent.click(screen.getByTestId('settings-nav-backdrop'));

      expect(onNavOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
