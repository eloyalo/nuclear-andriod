import { ComponentProps, FC } from 'react';

import { cn } from '../utils';
import { WallpaperLayer } from './Wallpaper';

type PlayerShellProps = ComponentProps<'div'>;

export const PlayerShell: FC<PlayerShellProps> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        'grid h-screen w-screen grid-rows-[auto_1fr_auto] overflow-hidden',
        // Keeps the shell clear of the Android status and navigation bars;
        // a no-op on desktop.
        'safe-area-inset',
        className,
      )}
      {...props}
    >
      <WallpaperLayer />
      {children}
    </div>
  );
};
