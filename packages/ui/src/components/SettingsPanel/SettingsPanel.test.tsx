import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BlocksIcon, PaletteIcon } from 'lucide-react';

import { SettingsNavigationSection, SettingsPanel } from './SettingsPanel';

const sections: SettingsNavigationSection[] = [
  {
    id: 'general',
    label: 'Settings',
    items: [
      { id: 'general', label: 'General' },
      { id: 'plugins', label: 'Plugins' },
    ],
    activeItemId: 'general',
    onSelect: () => {},
  },
  {
    id: 'app',
    label: 'App',
    items: [
      { id: 'plugins', label: 'Plugins', icon: <BlocksIcon /> },
      { id: 'themes', label: 'Themes', icon: <PaletteIcon /> },
    ],
    activeItemId: null,
    onSelect: () => {},
  },
];

describe('SettingsPanel', () => {
  it('(Snapshot) renders when open', () => {
    const { asFragment } = render(
      <SettingsPanel isOpen onClose={() => {}} sections={sections}>
        <div>General content</div>
      </SettingsPanel>,
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

    const activeSections = (activeItemId: string | null) =>
      sections.map((section) => ({ ...section, activeItemId }));

    const renderCompact = (overrides = {}) =>
      render(
        <SettingsPanel
          isOpen
          onClose={() => {}}
          sections={activeSections('general')}
          navLabel="Menu"
          {...overrides}
        >
          <div>General content</div>
        </SettingsPanel>,
      );

    it('(Snapshot) renders behind a hamburger', () => {
      const { asFragment } = renderCompact();
      expect(asFragment()).toMatchSnapshot();
    });

    it('names the active item in the header', () => {
      renderCompact({ sections: activeSections('themes') });

      expect(screen.getByTestId('settings-active-tab')).toHaveTextContent(
        'Themes',
      );
      expect(screen.getByText('General content')).toBeInTheDocument();
    });

    it('opens the navigation from the hamburger', async () => {
      const onNavOpenChange = vi.fn();
      renderCompact({ onNavOpenChange });

      await userEvent.click(screen.getByTestId('settings-nav-toggle'));

      expect(onNavOpenChange).toHaveBeenCalledWith(true);
    });

    it('closes the navigation after picking an item', async () => {
      const onSelect = vi.fn();
      const onNavOpenChange = vi.fn();
      renderCompact({
        isNavOpen: true,
        onNavOpenChange,
        sections: activeSections('general').map((section) =>
          section.id === 'app' ? { ...section, onSelect } : section,
        ),
      });

      await userEvent.click(
        screen.getByTestId('settings-navigation-item-themes'),
      );

      expect(onSelect).toHaveBeenCalledWith('themes');
      expect(onNavOpenChange).toHaveBeenCalledWith(false);
    });

    it('shows a backdrop only while the navigation is open', () => {
      const { rerender } = renderCompact({ isNavOpen: false });
      expect(
        screen.queryByTestId('settings-nav-backdrop'),
      ).not.toBeInTheDocument();

      rerender(
        <SettingsPanel
          isOpen
          onClose={() => {}}
          sections={activeSections('general')}
          navLabel="Menu"
          isNavOpen
        >
          <div>General content</div>
        </SettingsPanel>,
      );

      expect(screen.getByTestId('settings-nav-backdrop')).toBeInTheDocument();
    });

    it('dismisses the navigation from the backdrop', async () => {
      const onNavOpenChange = vi.fn();
      renderCompact({ isNavOpen: true, onNavOpenChange });

      await userEvent.click(screen.getByTestId('settings-nav-backdrop'));

      expect(onNavOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
