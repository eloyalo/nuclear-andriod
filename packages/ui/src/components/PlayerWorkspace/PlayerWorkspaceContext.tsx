import { createContext, FC, ReactNode, useContext, useMemo } from 'react';

type PlayerWorkspaceContextValue = {
  isCompact: boolean;
};

const PlayerWorkspaceContext = createContext<PlayerWorkspaceContextValue>({
  isCompact: false,
});

export const PlayerWorkspaceProvider: FC<{
  isCompact: boolean;
  children: ReactNode;
}> = ({ isCompact, children }) => {
  const value = useMemo(() => ({ isCompact }), [isCompact]);
  return (
    <PlayerWorkspaceContext.Provider value={value}>
      {children}
    </PlayerWorkspaceContext.Provider>
  );
};

export const useWorkspaceIsCompact = (): boolean =>
  useContext(PlayerWorkspaceContext).isCompact;
