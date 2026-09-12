import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PlayerWorkspace } from './PlayerWorkspace';

describe('PlayerWorkspace', () => {
  it('(Snapshot) both sidebars expanded', () => {
    const { asFragment } = render(
      <PlayerWorkspace>
        <PlayerWorkspace.LeftSidebar
          width={200}
          isCollapsed={false}
          onWidthChange={() => {}}
          onToggle={() => {}}
        />
        <PlayerWorkspace.Main />
        <PlayerWorkspace.RightSidebar
          width={200}
          isCollapsed={false}
          onWidthChange={() => {}}
          onToggle={() => {}}
        />
      </PlayerWorkspace>,
    );

    expect(asFragment()).toMatchSnapshot();
  });

  it('(Snapshot) both sidebars collapsed', () => {
    const { asFragment } = render(
      <PlayerWorkspace>
        <PlayerWorkspace.LeftSidebar
          width={200}
          isCollapsed={true}
          onWidthChange={() => {}}
          onToggle={() => {}}
        />
        <PlayerWorkspace.Main />
        <PlayerWorkspace.RightSidebar
          width={200}
          isCollapsed={true}
          onWidthChange={() => {}}
          onToggle={() => {}}
        />
      </PlayerWorkspace>,
    );

    expect(asFragment()).toMatchSnapshot();
  });

  it('shows persistent footer in both collapsed and expanded states', () => {
    const persistentFooter = (
      <span data-testid="persistent-footer">v1.0.0</span>
    );
    const sidebarProps = {
      width: 200,
      onWidthChange: () => {},
      onToggle: () => {},
      persistentFooter,
    };

    const { rerender } = render(
      <PlayerWorkspace>
        <PlayerWorkspace.LeftSidebar {...sidebarProps} isCollapsed={true} />
        <PlayerWorkspace.Main />
      </PlayerWorkspace>,
    );

    expect(screen.getByTestId('persistent-footer')).toBeInTheDocument();

    rerender(
      <PlayerWorkspace>
        <PlayerWorkspace.LeftSidebar {...sidebarProps} isCollapsed={false} />
        <PlayerWorkspace.Main />
      </PlayerWorkspace>,
    );

    expect(screen.getByTestId('persistent-footer')).toBeInTheDocument();
  });

  describe('compact layout', () => {
    const sidebarProps = {
      width: 200,
      onWidthChange: () => {},
      onToggle: () => {},
    };

    it('(Snapshot) renders the sidebars as overlay drawers', () => {
      const { asFragment } = render(
        <PlayerWorkspace isCompact>
          <PlayerWorkspace.LeftSidebar {...sidebarProps} isCollapsed={false} />
          <PlayerWorkspace.Main />
          <PlayerWorkspace.RightSidebar {...sidebarProps} isCollapsed={true} />
        </PlayerWorkspace>,
      );

      expect(asFragment()).toMatchSnapshot();
    });

    it('renders a backdrop only for the open drawer', () => {
      render(
        <PlayerWorkspace isCompact>
          <PlayerWorkspace.LeftSidebar {...sidebarProps} isCollapsed={false} />
          <PlayerWorkspace.Main />
          <PlayerWorkspace.RightSidebar {...sidebarProps} isCollapsed={true} />
        </PlayerWorkspace>,
      );

      expect(screen.getByTestId('sidebar-backdrop-left')).toBeInTheDocument();
      expect(
        screen.queryByTestId('sidebar-backdrop-right'),
      ).not.toBeInTheDocument();
    });

    it('closes the drawer when the backdrop is tapped', async () => {
      const onToggle = vi.fn();
      render(
        <PlayerWorkspace isCompact>
          <PlayerWorkspace.LeftSidebar
            {...sidebarProps}
            isCollapsed={false}
            onToggle={onToggle}
          />
          <PlayerWorkspace.Main />
        </PlayerWorkspace>,
      );

      await userEvent.click(screen.getByTestId('sidebar-backdrop-left'));

      expect(onToggle).toHaveBeenCalledOnce();
    });

    it('keeps a closed drawer out of reach of taps', () => {
      render(
        <PlayerWorkspace isCompact>
          <PlayerWorkspace.LeftSidebar {...sidebarProps} isCollapsed={true} />
          <PlayerWorkspace.Main />
        </PlayerWorkspace>,
      );

      const drawer = screen.getByTestId('sidebar-drawer-left');
      expect(drawer).toHaveAttribute('aria-hidden', 'true');
      expect(drawer).toHaveClass('pointer-events-none');
    });

    it('does not render a resize handle', () => {
      const { container } = render(
        <PlayerWorkspace isCompact>
          <PlayerWorkspace.LeftSidebar {...sidebarProps} isCollapsed={false} />
          <PlayerWorkspace.Main />
        </PlayerWorkspace>,
      );

      expect(
        container.querySelector('.cursor-col-resize'),
      ).not.toBeInTheDocument();
    });
  });
});
